import {
  evolucaoSchema,
  inicioDoMes,
  inicioDoProximoMes,
  mesAnterior,
  nomeCurtoDoMes,
  resumoMensalSchema,
  type Evolucao,
  type PontoDeEvolucao,
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

  /**
   * Evolução mês a mês, para o gráfico de barras. Uma consulta só agrupando
   * por mês — puxar gasto por gasto para somar no servidor seria desperdício.
   */
  app.get('/evolucao', async (request: FastifyRequest): Promise<Evolucao> => {
    const usuario = usuarioDaRequisicao(request);
    const { meses } = evolucaoSchema.parse(request.query);

    const agora = new Date();
    const anoFinal = agora.getUTCFullYear();
    const mesFinal = agora.getUTCMonth() + 1;

    // Janela: os `meses` últimos meses, terminando no mês atual.
    let inicio = { ano: anoFinal, mes: mesFinal };
    for (let i = 1; i < meses; i += 1) inicio = mesAnterior(inicio.ano, inicio.mes);

    const totais = await prisma.gasto.groupBy({
      by: ['data'],
      where: {
        householdId: usuario.householdId,
        data: {
          gte: inicioDoMes(inicio.ano, inicio.mes),
          lt: inicioDoProximoMes(anoFinal, mesFinal),
        },
      },
      _sum: { valorCentavos: true },
      _count: true,
    });

    // O agrupamento vem por dia; juntamos por mês aqui, que é barato.
    const porMes = new Map<string, { total: number; quantidade: number }>();
    for (const linha of totais) {
      const chave = `${linha.data.getUTCFullYear()}-${linha.data.getUTCMonth() + 1}`;
      const atual = porMes.get(chave) ?? { total: 0, quantidade: 0 };
      atual.total += linha._sum.valorCentavos ?? 0;
      atual.quantidade += linha._count;
      porMes.set(chave, atual);
    }

    const pontos: PontoDeEvolucao[] = [];
    let cursor = inicio;
    for (let i = 0; i < meses; i += 1) {
      const dados = porMes.get(`${cursor.ano}-${cursor.mes}`);
      pontos.push({
        ano: cursor.ano,
        mes: cursor.mes,
        rotulo: nomeCurtoDoMes(cursor.mes),
        totalCentavos: dados?.total ?? 0,
        quantidade: dados?.quantidade ?? 0,
      });
      cursor = cursor.mes === 12 ? { ano: cursor.ano + 1, mes: 1 } : { ano: cursor.ano, mes: cursor.mes + 1 };
    }

    // Média só dos meses que tiveram gasto: incluir mês vazio afundaria a
    // linha de referência e daria uma impressão errada.
    const comGasto = pontos.filter((ponto) => ponto.quantidade > 0);
    const soma = comGasto.reduce((total, ponto) => total + ponto.totalCentavos, 0);

    return {
      pontos,
      mediaCentavos: comGasto.length > 0 ? Math.round(soma / comGasto.length) : 0,
      maiorCentavos: pontos.reduce((maior, ponto) => Math.max(maior, ponto.totalCentavos), 0),
    };
  });
}
