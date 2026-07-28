import {
  atualizarRecorrenciaSchema,
  criarRecorrenciaSchema,
  erroNaoEncontrado,
  erroSemPermissao,
  erroValidacao,
  formatarDataISO,
  hoje,
  parseData,
  zId,
  type Recorrencia,
} from '@gastos/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { usuarioDaRequisicao, type UsuarioAutenticado } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { serializarCategoria } from '../serializadores.js';
import { gerarPendentes, proximoLancamento } from '../servicos/recorrencias.js';

const paramsSchema = z.object({ id: zId });

type RecorrenciaComRelacoes = Awaited<
  ReturnType<typeof prisma.recorrencia.findFirstOrThrow<{ include: typeof INCLUDE }>>
>;

const INCLUDE = {
  categoria: true,
  user: { select: { id: true, nome: true } },
} as const;

function serializar(recorrencia: RecorrenciaComRelacoes): Recorrencia & { proximoEm: string | null } {
  return {
    id: recorrencia.id,
    descricao: recorrencia.descricao,
    valorCentavos: recorrencia.valorCentavos,
    diaDoMes: recorrencia.diaDoMes,
    formaPagamento: recorrencia.formaPagamento,
    observacao: recorrencia.observacao,
    categoria: recorrencia.categoria ? serializarCategoria(recorrencia.categoria) : null,
    usuario: { id: recorrencia.user.id, nome: recorrencia.user.nome },
    ativa: recorrencia.ativa,
    inicioEm: formatarDataISO(recorrencia.inicioEm),
    fimEm: recorrencia.fimEm ? formatarDataISO(recorrencia.fimEm) : null,
    ultimoMesGerado: recorrencia.ultimoMesGerado,
    criadoEm: recorrencia.criadoEm.toISOString(),
    proximoEm: proximoLancamento(recorrencia),
  };
}

/** Membro mexe no que é seu; administrador revisa o de todos. */
function conferirPermissao(usuario: UsuarioAutenticado, donoId: string): void {
  if (usuario.papel !== 'ADMIN' && usuario.id !== donoId) {
    throw erroSemPermissao('Você só pode alterar as contas fixas que você criou.');
  }
}

export async function rotasRecorrencias(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.autenticar);

  app.get('/', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const itens = await prisma.recorrencia.findMany({
      where: { householdId: usuario.householdId },
      include: INCLUDE,
      orderBy: [{ ativa: 'desc' }, { diaDoMes: 'asc' }],
    });
    return { itens: itens.map(serializar) };
  });

  /**
   * Cria os lançamentos dos meses pendentes. É chamada quando o app abre —
   * repetir não duplica nada.
   */
  app.post('/gerar', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    return gerarPendentes(usuario.householdId);
  });

  app.post('/', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const dados = criarRecorrenciaSchema.parse(request.body);

    const userId = dados.userId ?? usuario.id;
    if (dados.userId && dados.userId !== usuario.id) {
      const membro = await prisma.user.findFirst({
        where: { id: dados.userId, householdId: usuario.householdId },
        select: { id: true },
      });
      if (!membro) {
        throw erroValidacao('Essa pessoa não faz parte da família.', { userId: 'Pessoa inválida.' });
      }
    }
    if (dados.categoriaId) {
      const categoria = await prisma.categoria.findFirst({
        where: { id: dados.categoriaId, householdId: usuario.householdId },
        select: { id: true },
      });
      if (!categoria) {
        throw erroValidacao('Essa categoria não existe.', { categoriaId: 'Categoria inválida.' });
      }
    }

    // Sem data de início informada, vale a partir do mês atual.
    const referencia = hoje();
    const inicio = dados.inicioEm
      ? (parseData(dados.inicioEm) ?? referencia)
      : referencia;

    const recorrencia = await prisma.recorrencia.create({
      data: {
        descricao: dados.descricao,
        valorCentavos: dados.valorCentavos,
        diaDoMes: dados.diaDoMes,
        formaPagamento: dados.formaPagamento,
        observacao: dados.observacao ?? null,
        categoriaId: dados.categoriaId ?? null,
        userId,
        householdId: usuario.householdId,
        inicioEm: inicio,
        fimEm: dados.fimEm ? parseData(dados.fimEm) : null,
      },
      include: INCLUDE,
    });

    // Já cria o lançamento do mês corrente, para a conta aparecer na hora.
    await gerarPendentes(usuario.householdId);
    const atualizada = await prisma.recorrencia.findFirstOrThrow({
      where: { id: recorrencia.id },
      include: INCLUDE,
    });

    return reply.status(201).send(serializar(atualizada));
  });

  app.patch('/:id', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);
    const dados = atualizarRecorrenciaSchema.parse(request.body);

    const existente = await prisma.recorrencia.findFirst({
      where: { id, householdId: usuario.householdId },
      select: { id: true, userId: true },
    });
    if (!existente) throw erroNaoEncontrado('Essa conta fixa não existe mais.');
    conferirPermissao(usuario, existente.userId);

    const atualizada = await prisma.recorrencia.update({
      where: { id },
      data: {
        ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
        ...(dados.valorCentavos !== undefined ? { valorCentavos: dados.valorCentavos } : {}),
        ...(dados.diaDoMes !== undefined ? { diaDoMes: dados.diaDoMes } : {}),
        ...(dados.formaPagamento !== undefined ? { formaPagamento: dados.formaPagamento } : {}),
        ...(dados.observacao !== undefined ? { observacao: dados.observacao } : {}),
        ...(dados.categoriaId !== undefined ? { categoriaId: dados.categoriaId } : {}),
        ...(dados.userId !== undefined ? { userId: dados.userId } : {}),
        ...(dados.ativa !== undefined ? { ativa: dados.ativa } : {}),
        ...(dados.fimEm !== undefined
          ? { fimEm: dados.fimEm ? parseData(dados.fimEm) : null }
          : {}),
      },
      include: INCLUDE,
    });

    return serializar(atualizada);
  });

  /**
   * Apagar a conta fixa NÃO apaga os gastos que ela já lançou — eles são
   * história e continuam no total. Só para de gerar daqui para a frente.
   */
  app.delete('/:id', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    const existente = await prisma.recorrencia.findFirst({
      where: { id, householdId: usuario.householdId },
      select: { id: true, userId: true },
    });
    if (!existente) throw erroNaoEncontrado('Essa conta fixa não existe mais.');
    conferirPermissao(usuario, existente.userId);

    const gastosMantidos = await prisma.$transaction(async (tx) => {
      const { count } = await tx.gasto.updateMany({
        where: { recorrenciaId: id },
        data: { recorrenciaId: null },
      });
      await tx.recorrencia.delete({ where: { id } });
      return count;
    });

    return reply.status(200).send({ gastosMantidos });
  });
}
