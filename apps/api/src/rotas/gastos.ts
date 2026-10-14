import {
  ROTULO_FORMA_PAGAMENTO,
  ROTULO_TIPO_CARTAO,
  atualizarGastoSchema,
  criarGastoSchema,
  erroNaoEncontrado,
  erroSemPermissao,
  erroValidacao,
  exportarGastosSchema,
  formatarData,
  formatarDataISO,
  listarGastosSchema,
  parseData,
  zId,
  type Gasto,
  type ListaDeGastos,
} from '@gastos/core';
import type { Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { usuarioDaRequisicao, type UsuarioAutenticado } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { INCLUDE_GASTO, nomeDoUsuario, serializarGasto } from '../serializadores.js';
import { cifrarBytes, decifrarBytes } from '../servicos/criptografia.js';
import { gerarArquivo } from '../servicos/planilha.js';
import {
  TAMANHO_MAXIMO_COMPROVANTE,
  conferirTipo,
} from '../servicos/comprovantes.js';
import {
  combinarFiltros,
  filtroDeGastosVisiveis,
} from '../servicos/visibilidade.js';

const paramsSchema = z.object({ id: zId });

/** Converte `aaaa-mm-dd` em Date de meia-noite UTC (a coluna é `date`). */
function paraData(texto: string): Date {
  const data = parseData(texto);
  if (!data) throw erroValidacao('Essa data não existe no calendário.', { data: 'Data inválida.' });
  return data;
}

async function conferirCategoria(householdId: string, categoriaId: string): Promise<void> {
  const categoria = await prisma.categoria.findFirst({
    where: { id: categoriaId, householdId },
    select: { id: true },
  });
  if (!categoria) {
    throw erroValidacao('Essa categoria não existe.', { categoriaId: 'Categoria inválida.' });
  }
}

async function conferirCartao(householdId: string, cartaoId: string): Promise<void> {
  const cartao = await prisma.cartao.findFirst({
    where: { id: cartaoId, householdId },
    select: { id: true },
  });
  if (!cartao) {
    throw erroValidacao('Esse cartão não existe.', { cartaoId: 'Cartão inválido.' });
  }
}

async function conferirMembro(householdId: string, userId: string): Promise<void> {
  const membro = await prisma.user.findFirst({
    where: { id: userId, householdId },
    select: { id: true },
  });
  if (!membro) {
    throw erroValidacao('Essa pessoa não faz parte da família.', { userId: 'Pessoa inválida.' });
  }
}

/** Membro mexe no que é seu; administrador revisa o de todo mundo. */
function conferirPermissaoDeEdicao(usuario: UsuarioAutenticado, donoDoGastoId: string): void {
  if (usuario.papel !== 'ADMIN' && usuario.id !== donoDoGastoId) {
    throw erroSemPermissao('Você só pode alterar os gastos que você lançou.');
  }
}

/**
 * O gasto que esta pessoa pode alterar — ou 404.
 *
 * São duas barreiras, e elas andam juntas: primeiro o filtro de privacidade
 * (não se mexe no que não se pode ver), depois a permissão de edição.
 *
 * Existe porque as quatro rotas que alteram um gasto repetiam este trecho, e
 * as quatro repetiam o mesmo esquecimento: filtravam só por `householdId`.
 * Isso deixava qualquer pessoa do grupo alcançar o lançamento de quem não
 * compartilha — e o `PATCH`, que devolve o gasto serializado, virava uma
 * maneira de simplesmente ler o que estava escondido. Com a regra num lugar
 * só, esquecê-la em uma rota deixa de ser possível.
 *
 * Repare que o filtro roda ANTES da permissão: administrador que não pode ver
 * o lançamento recebe 404, igual a `GET /:id` sempre fez. Quem desliga o
 * compartilhamento fica invisível para todo mundo, inclusive para quem
 * administra o grupo — que é o que a tela promete.
 */
async function gastoQuePodeAlterar(
  usuario: UsuarioAutenticado,
  id: string,
): Promise<{ id: string; userId: string; comprovante: { id: string } | null }> {
  const gasto = await prisma.gasto.findFirst({
    where: combinarFiltros(filtroDeGastosVisiveis(usuario), { id }),
    select: { id: true, userId: true, comprovante: { select: { id: true } } },
  });
  if (!gasto) throw erroNaoEncontrado('Esse gasto não existe mais.');
  conferirPermissaoDeEdicao(usuario, gasto.userId);
  return gasto;
}

export async function rotasGastos(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.autenticar);

  app.get('/', async (request: FastifyRequest): Promise<ListaDeGastos> => {
    const usuario = usuarioDaRequisicao(request);
    const filtros = listarGastosSchema.parse(request.query);

    const daTela: Prisma.GastoWhereInput = {};
    if (filtros.de || filtros.ate) {
      daTela.data = {
        ...(filtros.de ? { gte: paraData(filtros.de) } : {}),
        ...(filtros.ate ? { lte: paraData(filtros.ate) } : {}),
      };
    }
    if (filtros.userId) daTela.userId = filtros.userId;
    if (filtros.categoriaId) {
      daTela.categoriaId = filtros.categoriaId === 'sem-categoria' ? null : filtros.categoriaId;
    }
    if (filtros.cartaoId) {
      daTela.cartaoId = filtros.cartaoId === 'sem-cartao' ? null : filtros.cartaoId;
    }
    if (filtros.busca) {
      daTela.OR = [
        { descricao: { contains: filtros.busca, mode: 'insensitive' } },
        { observacao: { contains: filtros.busca, mode: 'insensitive' } },
      ];
    }

    // O filtro de privacidade entra por `AND`: os dois `OR` (o da busca e o de
    // quem compartilha) precisam valer juntos, não um no lugar do outro.
    const where = combinarFiltros(filtroDeGastosVisiveis(usuario), daTela);

    const [itens, totalItens, soma] = await Promise.all([
      prisma.gasto.findMany({
        where,
        include: INCLUDE_GASTO,
        // Data primeiro; criação como desempate para o lançamento mais novo do
        // dia aparecer no topo.
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
        skip: (filtros.pagina - 1) * filtros.porPagina,
        take: filtros.porPagina,
      }),
      prisma.gasto.count({ where }),
      prisma.gasto.aggregate({ where, _sum: { valorCentavos: true } }),
    ]);

    return {
      itens: itens.map(serializarGasto),
      paginacao: {
        pagina: filtros.pagina,
        porPagina: filtros.porPagina,
        totalItens,
        totalPaginas: Math.max(1, Math.ceil(totalItens / filtros.porPagina)),
      },
      // O total é do filtro inteiro, não só da página exibida.
      totalCentavos: soma._sum.valorCentavos ?? 0,
    };
  });

  /**
   * Exportar de volta para Excel. Existe para ninguém se sentir preso ao app:
   * o histórico sai a qualquer momento, no formato que a família já conhece.
   */
  app.get('/exportar', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const filtros = exportarGastosSchema.parse(request.query);

    const where = combinarFiltros(filtroDeGastosVisiveis(usuario), {
      ...(filtros.de || filtros.ate
        ? {
            data: {
              ...(filtros.de ? { gte: paraData(filtros.de) } : {}),
              ...(filtros.ate ? { lte: paraData(filtros.ate) } : {}),
            },
          }
        : {}),
    });

    const gastos = await prisma.gasto.findMany({
      where,
      include: INCLUDE_GASTO,
      orderBy: [{ data: 'asc' }, { criadoEm: 'asc' }],
    });

    const arquivo = gerarArquivo(
      gastos.map((gasto) => ({
        Data: formatarData(gasto.data),
        'Onde foi': gasto.descricao,
        // Reais com duas casas: é o que o Excel soma. Centavos só existem
        // dentro do app.
        Valor: gasto.valorCentavos / 100,
        Pessoa: nomeDoUsuario(gasto.user),
        Categoria: gasto.categoria?.nome ?? '',
        Cartão: gasto.cartao
          ? `${gasto.cartao.nome} (${ROTULO_TIPO_CARTAO[gasto.cartao.tipo]})`
          : '',
        'Forma de pagamento': ROTULO_FORMA_PAGAMENTO[gasto.formaPagamento],
        Observação: gasto.observacao ?? '',
      })),
      filtros.formato,
    );

    const hoje = formatarDataISO(new Date());
    const nome = `gastos-${hoje}.${filtros.formato}`;

    return reply
      .header(
        'content-type',
        filtros.formato === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header('content-disposition', `attachment; filename="${nome}"`)
      .send(arquivo);
  });

  /** Autocompletar do campo "Onde foi": descrições já usadas na casa. */
  app.get('/sugestoes', async (request: FastifyRequest): Promise<{ descricoes: string[] }> => {
    const usuario = usuarioDaRequisicao(request);
    const { termo } = z.object({ termo: z.string().trim().max(60).default('') }).parse(request.query);

    const linhas = await prisma.gasto.findMany({
      // Autocompletar também respeita a privacidade: nada de sugerir onde
      // outra pessoa gastou.
      where: combinarFiltros(
        filtroDeGastosVisiveis(usuario),
        termo ? { descricao: { contains: termo, mode: 'insensitive' } } : undefined,
      ),
      distinct: ['descricao'],
      select: { descricao: true },
      orderBy: { criadoEm: 'desc' },
      take: 8,
    });

    return { descricoes: linhas.map((linha) => linha.descricao) };
  });

  app.get('/:id', async (request: FastifyRequest): Promise<Gasto> => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    const gasto = await prisma.gasto.findFirst({
      where: combinarFiltros(filtroDeGastosVisiveis(usuario), { id }),
      include: INCLUDE_GASTO,
    });
    if (!gasto) throw erroNaoEncontrado('Esse gasto não existe mais.');

    return serializarGasto(gasto);
  });

  app.post('/', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const dados = criarGastoSchema.parse(request.body);

    const userId = dados.userId ?? usuario.id;
    if (dados.userId && dados.userId !== usuario.id) {
      await conferirMembro(usuario.householdId, dados.userId);
    }
    if (dados.categoriaId) await conferirCategoria(usuario.householdId, dados.categoriaId);
    if (dados.cartaoId) await conferirCartao(usuario.householdId, dados.cartaoId);

    const gasto = await prisma.gasto.create({
      data: {
        descricao: dados.descricao,
        valorCentavos: dados.valorCentavos,
        data: paraData(dados.data),
        formaPagamento: dados.formaPagamento,
        observacao: dados.observacao ?? null,
        categoriaId: dados.categoriaId ?? null,
        cartaoId: dados.cartaoId ?? null,
        userId,
        householdId: usuario.householdId,
      },
      include: INCLUDE_GASTO,
    });

    return reply.status(201).send(serializarGasto(gasto));
  });

  app.patch('/:id', async (request: FastifyRequest): Promise<Gasto> => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);
    const dados = atualizarGastoSchema.parse(request.body);

    await gastoQuePodeAlterar(usuario, id);

    if (dados.categoriaId) await conferirCategoria(usuario.householdId, dados.categoriaId);
    if (dados.cartaoId) await conferirCartao(usuario.householdId, dados.cartaoId);
    if (dados.userId) await conferirMembro(usuario.householdId, dados.userId);

    const atualizado = await prisma.gasto.update({
      where: { id },
      data: {
        ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
        ...(dados.valorCentavos !== undefined ? { valorCentavos: dados.valorCentavos } : {}),
        ...(dados.data !== undefined ? { data: paraData(dados.data) } : {}),
        ...(dados.formaPagamento !== undefined ? { formaPagamento: dados.formaPagamento } : {}),
        ...(dados.observacao !== undefined ? { observacao: dados.observacao } : {}),
        ...(dados.categoriaId !== undefined ? { categoriaId: dados.categoriaId } : {}),
        ...(dados.cartaoId !== undefined ? { cartaoId: dados.cartaoId } : {}),
        ...(dados.userId !== undefined ? { userId: dados.userId } : {}),
        ...(dados.pago !== undefined ? { pagoEm: dados.pago ? new Date() : null } : {}),
      },
      include: INCLUDE_GASTO,
    });

    return serializarGasto(atualizado);
  });

  app.delete('/:id', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    await gastoQuePodeAlterar(usuario, id);

    // O comprovante sai junto, por `onDelete: Cascade` no banco.
    await prisma.gasto.delete({ where: { id } });
    return reply.status(204).send();
  });

  // --- Comprovante ----------------------------------------------------------

  /** Anexa (ou troca) a foto/PDF do comprovante. */
  app.put('/:id/comprovante', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    await gastoQuePodeAlterar(usuario, id);

    const arquivo = await request.file({ limits: { fileSize: TAMANHO_MAXIMO_COMPROVANTE } });
    if (!arquivo) throw erroValidacao('Escolha uma foto ou um PDF do comprovante.');

    // O tipo é conferido antes de ler o corpo, para não carregar 4 MB à toa.
    const tipo = conferirTipo(arquivo.mimetype);

    const conteudo = await arquivo.toBuffer();
    if (arquivo.file.truncated) {
      throw erroValidacao('Esse arquivo passa de 3 MB. Tire a foto com qualidade menor.');
    }
    if (conteudo.length === 0) throw erroValidacao('O arquivo enviado está vazio.');

    // Cifrado antes de encostar no banco: é foto de nota fiscal, mostra onde a
    // pessoa esteve e quanto gastou.
    // O Prisma tipa `Bytes` como Uint8Array; o Buffer do Node é compatível em
    // memória, mas não no tipo.
    const bytes = new Uint8Array(cifrarBytes(conteudo));

    // `upsert`: trocar o comprovante substitui o anterior, sem sobra.
    await prisma.comprovante.upsert({
      where: { gastoId: id },
      create: { gastoId: id, tipo, dados: bytes },
      update: { tipo, dados: bytes },
    });

    const atualizado = await prisma.gasto.findFirstOrThrow({
      where: { id },
      include: INCLUDE_GASTO,
    });

    return reply.status(200).send(serializarGasto(atualizado));
  });

  app.get('/:id/comprovante', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    // O mesmo filtro de `GET /:id`, e pelo mesmo motivo: se o lançamento está
    // escondido, a foto da nota dele também está. Antes aqui só havia
    // `householdId` — bastava conhecer o id do gasto para baixar o comprovante
    // de quem não compartilha, sem nunca ter conseguido ver o gasto em si.
    const comprovante = await prisma.comprovante.findFirst({
      where: { gastoId: id, gasto: filtroDeGastosVisiveis(usuario) },
      select: { tipo: true, dados: true },
    });
    if (!comprovante) throw erroNaoEncontrado('Esse gasto não tem comprovante.');

    return reply
      .header('content-type', comprovante.tipo)
      .header('cache-control', 'private, max-age=3600')
      .send(decifrarBytes(Buffer.from(comprovante.dados)));
  });

  app.delete('/:id/comprovante', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    const gasto = await gastoQuePodeAlterar(usuario, id);
    if (!gasto.comprovante) throw erroNaoEncontrado('Esse gasto não tem comprovante.');

    await prisma.comprovante.delete({ where: { gastoId: id } });

    return reply.status(204).send();
  });
}
