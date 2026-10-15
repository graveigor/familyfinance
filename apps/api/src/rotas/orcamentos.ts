import {
  definirOrcamentoSchema,
  erroNaoEncontrado,
  erroValidacao,
  hoje,
  inicioDoMes,
  inicioDoProximoMes,
  listarOrcamentosSchema,
  percentualDoOrcamento,
  situacaoDoOrcamento,
  zId,
  type OrcamentoDaCategoria,
} from '@gastos/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { usuarioDaRequisicao } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { serializarCategoria } from '../serializadores.js';

/**
 * Orçamento: o teto mensal que cada pessoa se dá numa categoria.
 *
 * Não existe filtro de "quem compartilha" aqui, e é de propósito: o teto é meta
 * pessoal, e ver o do outro não ajuda ninguém a cumprir o seu. Toda consulta é
 * `userId: usuario.id` — nem administrador do grupo enxerga.
 *
 * O gasto comparado contra o teto é o DA PESSOA, não o do grupo. Comparar o
 * limite de alguém com o gasto somado da família daria uma barra que não quer
 * dizer nada.
 */

const paramsSchema = z.object({ categoriaId: zId });

export async function rotasOrcamentos(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.autenticar);

  app.get('/', async (request: FastifyRequest): Promise<{ itens: OrcamentoDaCategoria[] }> => {
    const usuario = usuarioDaRequisicao(request);
    const pedido = listarOrcamentosSchema.parse(request.query);

    const agora = hoje();
    const ano = pedido.ano ?? agora.getUTCFullYear();
    const mes = pedido.mes ?? agora.getUTCMonth() + 1;
    const periodo = { gte: inicioDoMes(ano, mes), lt: inicioDoProximoMes(ano, mes) };

    const orcamentos = await prisma.orcamento.findMany({
      where: { userId: usuario.id },
      include: { categoria: true },
    });
    if (orcamentos.length === 0) return { itens: [] };

    const gastos = await prisma.gasto.groupBy({
      by: ['categoriaId'],
      where: {
        userId: usuario.id,
        householdId: usuario.householdId,
        data: periodo,
        categoriaId: { in: orcamentos.map((o) => o.categoriaId) },
      },
      _sum: { valorCentavos: true },
    });
    const gastoPorCategoria = new Map(
      gastos.flatMap((g) => (g.categoriaId ? [[g.categoriaId, g._sum.valorCentavos ?? 0]] : [])),
    );

    const itens = orcamentos
      .map((orcamento) => {
        const gastoCentavos = gastoPorCategoria.get(orcamento.categoriaId) ?? 0;
        return {
          categoria: serializarCategoria(orcamento.categoria),
          limiteCentavos: orcamento.limiteCentavos,
          gastoCentavos,
          percentual: percentualDoOrcamento(gastoCentavos, orcamento.limiteCentavos),
          situacao: situacaoDoOrcamento(gastoCentavos, orcamento.limiteCentavos),
        };
      })
      // O que está mais perto de estourar primeiro: é o que a pessoa precisa ver.
      .sort((a, b) => b.percentual - a.percentual);

    return { itens };
  });

  /** Define ou altera o teto. `PUT` porque é um por categoria — repetir não cria outro. */
  app.put('/', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const dados = definirOrcamentoSchema.parse(request.body);

    const categoria = await prisma.categoria.findFirst({
      where: { id: dados.categoriaId, householdId: usuario.householdId, tipo: 'DESPESA' },
      select: { id: true },
    });
    if (!categoria) {
      // Teto de receita não faz sentido: ninguém quer "ganhar no máximo isto".
      throw erroValidacao('Só dá para pôr limite em categoria de gasto.', {
        categoriaId: 'Escolha uma categoria de gasto.',
      });
    }

    const orcamento = await prisma.orcamento.upsert({
      where: { userId_categoriaId: { userId: usuario.id, categoriaId: dados.categoriaId } },
      create: {
        userId: usuario.id,
        categoriaId: dados.categoriaId,
        limiteCentavos: dados.limiteCentavos,
      },
      update: { limiteCentavos: dados.limiteCentavos },
      include: { categoria: true },
    });

    return reply.status(200).send({
      categoria: serializarCategoria(orcamento.categoria),
      limiteCentavos: orcamento.limiteCentavos,
      gastoCentavos: 0,
      percentual: 0,
      situacao: 'tranquilo' as const,
    });
  });

  app.delete('/:categoriaId', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { categoriaId } = paramsSchema.parse(request.params);

    const existente = await prisma.orcamento.findUnique({
      where: { userId_categoriaId: { userId: usuario.id, categoriaId } },
      select: { id: true },
    });
    if (!existente) throw erroNaoEncontrado('Essa categoria não tem limite definido.');

    await prisma.orcamento.delete({ where: { id: existente.id } });
    return reply.status(204).send();
  });
}
