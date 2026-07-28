import {
  inicioDoMes,
  inicioDoProximoMes,
  mesAnterior,
  resumoMensalSchema,
  type ResumoMensal,
  type TotalPorCategoria,
  type TotalPorPessoa,
} from '@gastos/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { usuarioDaRequisicao } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { serializarCategoria } from '../serializadores.js';

export async function rotasResumos(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.autenticar);

  app.get('/mensal', async (request: FastifyRequest): Promise<ResumoMensal> => {
    const usuario = usuarioDaRequisicao(request);
    const { ano, mes } = resumoMensalSchema.parse(request.query);

    // Intervalo semiaberto [início do mês, início do mês seguinte): não depende
    // de quantos dias o mês tem nem deixa o dia 31 de fora.
    const periodo = { gte: inicioDoMes(ano, mes), lt: inicioDoProximoMes(ano, mes) };
    const anterior = mesAnterior(ano, mes);
    const periodoAnterior = {
      gte: inicioDoMes(anterior.ano, anterior.mes),
      lt: inicioDoProximoMes(anterior.ano, anterior.mes),
    };

    const where = { householdId: usuario.householdId, data: periodo };

    const [totalGeral, porCategoriaBruto, porPessoaBruto, totalAnterior, categorias, membros] =
      await Promise.all([
        prisma.gasto.aggregate({ where, _sum: { valorCentavos: true }, _count: true }),
        prisma.gasto.groupBy({
          by: ['categoriaId'],
          where,
          _sum: { valorCentavos: true },
          _count: true,
        }),
        prisma.gasto.groupBy({
          by: ['userId'],
          where,
          _sum: { valorCentavos: true },
          _count: true,
        }),
        prisma.gasto.aggregate({
          where: { householdId: usuario.householdId, data: periodoAnterior },
          _sum: { valorCentavos: true },
        }),
        prisma.categoria.findMany({ where: { householdId: usuario.householdId } }),
        prisma.user.findMany({
          where: { householdId: usuario.householdId },
          select: { id: true, nome: true },
        }),
      ]);

    const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
    const membroPorId = new Map(membros.map((m) => [m.id, m]));

    const porCategoria: TotalPorCategoria[] = porCategoriaBruto
      .map((linha) => {
        const categoria = linha.categoriaId ? categoriaPorId.get(linha.categoriaId) : undefined;
        return {
          categoria: categoria ? serializarCategoria(categoria) : null,
          totalCentavos: linha._sum.valorCentavos ?? 0,
          quantidade: linha._count,
        };
      })
      .sort((a, b) => b.totalCentavos - a.totalCentavos);

    const porPessoa: TotalPorPessoa[] = porPessoaBruto
      .map((linha) => ({
        usuario: membroPorId.get(linha.userId) ?? { id: linha.userId, nome: 'Pessoa removida' },
        totalCentavos: linha._sum.valorCentavos ?? 0,
        quantidade: linha._count,
      }))
      .sort((a, b) => b.totalCentavos - a.totalCentavos);

    const totalCentavos = totalGeral._sum.valorCentavos ?? 0;
    const totalAnteriorCentavos = totalAnterior._sum.valorCentavos ?? 0;

    return {
      ano,
      mes,
      totalCentavos,
      quantidade: totalGeral._count,
      porCategoria,
      porPessoa,
      mesAnterior: {
        ano: anterior.ano,
        mes: anterior.mes,
        totalCentavos: totalAnteriorCentavos,
        diferencaCentavos: totalCentavos - totalAnteriorCentavos,
      },
    };
  });
}
