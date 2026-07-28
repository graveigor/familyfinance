import {
  CAMPOS_OBRIGATORIOS,
  ROTULO_CAMPO,
  confirmarImportacaoSchema,
  contarPorStatus,
  erroNaoEncontrado,
  erroValidacao,
  formatarDataISO,
  parseData,
  remapearSchema,
  zId,
  type MapeamentoColunas,
  type PreviaImportacao,
} from '@gastos/core';
import prismaPacote from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { usuarioDaRequisicao } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import {
  analisarLinhas,
  chaveDeDuplicata,
  lerPlanilha,
  mapeamentoInicial,
  type Celula,
  type ContextoDaAnalise,
} from '../servicos/planilha.js';

// `DbNull` é como o Prisma apaga uma coluna Json — `null` puro seria o valor
// JSON "null", que é coisa diferente.
const { Prisma } = prismaPacote;

const paramsSchema = z.object({ id: zId });

const EXTENSOES = ['.xlsx', '.xls', '.csv'];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

/** O que guardamos no banco entre as etapas de conferência. */
interface DadosBrutos {
  colunas: string[];
  linhas: Celula[][];
  linhaDoCabecalho: number;
  mapeamento: MapeamentoColunas;
  mesReferencia: string | null;
}

async function montarContexto(
  householdId: string,
  usuarioLogadoId: string,
  mesReferencia: string | null,
): Promise<ContextoDaAnalise> {
  const [membros, categorias, existentes] = await Promise.all([
    prisma.user.findMany({ where: { householdId }, select: { id: true, nome: true } }),
    prisma.categoria.findMany({ where: { householdId }, select: { id: true, nome: true } }),
    prisma.gasto.findMany({
      where: { householdId },
      select: { descricao: true, valorCentavos: true, data: true },
    }),
  ]);

  return {
    membros,
    categorias,
    usuarioLogadoId,
    mesReferencia,
    chavesExistentes: new Set(
      existentes.map((g) => chaveDeDuplicata(g.descricao, g.valorCentavos, formatarDataISO(g.data))),
    ),
  };
}

function montarPrevia(
  importacaoId: string,
  nomeArquivo: string,
  dados: DadosBrutos,
  contexto: ContextoDaAnalise,
): PreviaImportacao {
  const { linhas, ignoradas } = analisarLinhas(
    dados.linhas,
    dados.mapeamento,
    contexto,
    dados.linhaDoCabecalho,
  );
  const contagem = contarPorStatus(linhas);

  return {
    importacaoId,
    nomeArquivo,
    colunas: dados.colunas,
    mapeamento: dados.mapeamento,
    mesReferencia: dados.mesReferencia,
    linhas,
    totais: {
      ...contagem,
      ignoradas,
      centavosAImportar: linhas
        .filter((l) => l.incluir && l.valorCentavos !== null)
        .reduce((soma, l) => soma + (l.valorCentavos ?? 0), 0),
    },
  };
}

/** Erro amigável quando falta uma coluna sem a qual não dá para importar. */
function conferirObrigatorias(mapeamento: MapeamentoColunas): void {
  const faltando = CAMPOS_OBRIGATORIOS.filter((campo) => mapeamento[campo] === undefined);
  if (faltando.length > 0) {
    const nomes = faltando.map((campo) => `"${ROTULO_CAMPO[campo]}"`).join(' e ');
    throw erroValidacao(
      `Escolha qual coluna da planilha tem ${nomes}.`,
      Object.fromEntries(faltando.map((campo) => [campo, 'Escolha a coluna.'])),
    );
  }
}

export async function rotasImportacoes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.autenticar);

  /** Etapa 1: recebe o arquivo, detecta as colunas e devolve a prévia. */
  app.post('/analisar', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const arquivo = await request.file({ limits: { fileSize: TAMANHO_MAXIMO } });

    if (!arquivo) throw erroValidacao('Escolha uma planilha para enviar.');

    const nomeArquivo = arquivo.filename ?? 'planilha';
    const extensao = nomeArquivo.slice(nomeArquivo.lastIndexOf('.')).toLowerCase();
    if (!EXTENSOES.includes(extensao)) {
      throw erroValidacao(
        'Esse tipo de arquivo não serve. Envie uma planilha .xlsx, .xls ou .csv.',
      );
    }

    const conteudo = await arquivo.toBuffer();
    if (arquivo.file.truncated) {
      throw erroValidacao('Esse arquivo passa de 10 MB. Divida a planilha e envie em partes.');
    }
    if (conteudo.length === 0) throw erroValidacao('O arquivo enviado está vazio.');

    const planilha = lerPlanilha(conteudo);
    const mapeamento = mapeamentoInicial(planilha.colunas);

    const dados: DadosBrutos = {
      colunas: planilha.colunas,
      linhas: planilha.linhas,
      linhaDoCabecalho: planilha.linhaDoCabecalho,
      mapeamento,
      // Sem coluna de data, a tela vai pedir o mês de referência.
      mesReferencia: null,
    };

    const importacao = await prisma.importacao.create({
      data: {
        nomeArquivo,
        status: 'PENDENTE',
        totalLinhas: planilha.linhas.length,
        householdId: usuario.householdId,
        dadosBrutos: dados as unknown as object,
      },
    });

    const contexto = await montarContexto(usuario.householdId, usuario.id, null);
    return reply.status(201).send(montarPrevia(importacao.id, nomeArquivo, dados, contexto));
  });

  /** Etapa 2: o usuário corrigiu o mapeamento (ou informou o mês). */
  app.post('/:id/mapear', async (request: FastifyRequest): Promise<PreviaImportacao> => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);
    const entrada = remapearSchema.parse(request.body);

    const importacao = await prisma.importacao.findFirst({
      where: { id, householdId: usuario.householdId, status: 'PENDENTE' },
    });
    if (!importacao?.dadosBrutos) {
      throw erroNaoEncontrado('Essa importação não está mais disponível. Envie a planilha de novo.');
    }

    const dados = importacao.dadosBrutos as unknown as DadosBrutos;

    // `null` no seletor significa "não usar esta coluna".
    const mapeamento: MapeamentoColunas = {};
    for (const [campo, coluna] of Object.entries(entrada.mapeamento)) {
      if (typeof coluna === 'number') {
        mapeamento[campo as keyof MapeamentoColunas] = coluna;
      }
    }

    const atualizados: DadosBrutos = {
      ...dados,
      mapeamento,
      mesReferencia: entrada.mesReferencia ?? null,
    };

    await prisma.importacao.update({
      where: { id },
      data: { dadosBrutos: atualizados as unknown as object },
    });

    const contexto = await montarContexto(
      usuario.householdId,
      usuario.id,
      atualizados.mesReferencia,
    );
    return montarPrevia(id, importacao.nomeArquivo, atualizados, contexto);
  });

  /** Etapa 3: grava de verdade, só o que o usuário deixou marcado. */
  app.post('/:id/confirmar', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);
    const { linhas } = confirmarImportacaoSchema.parse(request.body);

    const importacao = await prisma.importacao.findFirst({
      where: { id, householdId: usuario.householdId, status: 'PENDENTE' },
    });
    if (!importacao) {
      throw erroNaoEncontrado('Essa importação não está mais disponível. Envie a planilha de novo.');
    }

    const dados = importacao.dadosBrutos as unknown as DadosBrutos | null;
    if (dados) conferirObrigatorias(dados.mapeamento);

    // Ninguém entra em household alheio nem usa categoria de outra casa.
    const [membros, categorias] = await Promise.all([
      prisma.user.findMany({
        where: { householdId: usuario.householdId },
        select: { id: true },
      }),
      prisma.categoria.findMany({
        where: { householdId: usuario.householdId },
        select: { id: true },
      }),
    ]);
    const idsDeMembros = new Set(membros.map((m) => m.id));
    const idsDeCategorias = new Set(categorias.map((c) => c.id));

    for (const linha of linhas) {
      if (!idsDeMembros.has(linha.userId)) {
        throw erroValidacao(`A pessoa da linha ${linha.linha} não faz parte da família.`);
      }
      if (linha.categoriaId && !idsDeCategorias.has(linha.categoriaId)) {
        throw erroValidacao(`A categoria da linha ${linha.linha} não existe.`);
      }
    }

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.gasto.createMany({
        data: linhas.map((linha) => {
          const data = parseData(linha.data);
          if (!data) throw erroValidacao(`A data da linha ${linha.linha} não é válida.`);
          return {
            descricao: linha.descricao,
            valorCentavos: linha.valorCentavos,
            data,
            formaPagamento: linha.formaPagamento ?? 'OUTRO',
            categoriaId: linha.categoriaId ?? null,
            userId: linha.userId,
            householdId: usuario.householdId,
            origemImportacaoId: id,
          };
        }),
      });

      return tx.importacao.update({
        where: { id },
        data: {
          status: 'CONFIRMADA',
          linhasImportadas: linhas.length,
          // A planilha guardada já cumpriu o papel: não fica no banco.
          dadosBrutos: Prisma.DbNull,
        },
      });
    });

    return reply.status(201).send({
      importacaoId: resultado.id,
      linhasImportadas: resultado.linhasImportadas,
      totalCentavos: linhas.reduce((soma, linha) => soma + linha.valorCentavos, 0),
    });
  });

  /** Cancelar: some com a planilha guardada, sem gravar nada. */
  app.delete('/:id', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    const importacao = await prisma.importacao.findFirst({
      where: { id, householdId: usuario.householdId },
    });
    if (!importacao) throw erroNaoEncontrado('Essa importação não existe mais.');

    if (importacao.status === 'CONFIRMADA') {
      throw erroValidacao(
        'Essa importação já foi concluída. Para desfazer, exclua os gastos na tela de Gastos.',
      );
    }

    await prisma.importacao.update({
      where: { id },
      data: { status: 'CANCELADA', dadosBrutos: Prisma.DbNull },
    });
    return reply.status(204).send();
  });

  /** Histórico, para a pessoa saber o que já foi importado. */
  app.get('/', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const itens = await prisma.importacao.findMany({
      where: { householdId: usuario.householdId },
      orderBy: { criadoEm: 'desc' },
      take: 20,
      select: {
        id: true,
        nomeArquivo: true,
        status: true,
        totalLinhas: true,
        linhasImportadas: true,
        criadoEm: true,
      },
    });

    return {
      itens: itens.map((item) => ({ ...item, criadoEm: item.criadoEm.toISOString() })),
    };
  });
}
