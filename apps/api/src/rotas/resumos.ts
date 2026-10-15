import {
  dataUTC,
  diaValidoNoMes,
  evolucaoSchema,
  formatarDataISO,
  hoje,
  inicioDoMes,
  inicioDoProximoMes,
  mesAnterior,
  nomeCurtoDoMes,
  previsaoSchema,
  resumoMensalSchema,
  somarCentavos,
  type Evolucao,
  type ItemPrevisto,
  type PontoDeEvolucao,
  type Previsao,
  type ResumoMensal,
  type TotalPorCategoria,
  type TotalPorPessoa,
} from '@gastos/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { usuarioDaRequisicao } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { nomeDoUsuario, serializarCategoria } from '../serializadores.js';
import {
  combinarFiltros,
  combinarFiltrosDeReceita,
  filtroDeGastosVisiveis,
  filtroDeReceitasVisiveis,
  filtroDeRecorrenciasVisiveis,
} from '../servicos/visibilidade.js';

/** O mês seguinte a `{ano, mes}`. */
function proximoMes(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

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

    // Toda a soma do mês passa pelo filtro de privacidade: quem não
    // compartilha não entra no total nem no "por pessoa" dos outros.
    const visivel = filtroDeGastosVisiveis(usuario);
    const where = combinarFiltros(visivel, { data: periodo });

    const [
      totalGeral,
      porCategoriaBruto,
      porPessoaBruto,
      totalAnterior,
      categorias,
      membros,
      somaDeReceitas,
    ] = await Promise.all([
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
          where: combinarFiltros(visivel, { data: periodoAnterior }),
          _sum: { valorCentavos: true },
        }),
        prisma.categoria.findMany({ where: { householdId: usuario.householdId } }),
        prisma.user.findMany({
          where: { householdId: usuario.householdId },
          select: { id: true, nome: true },
        }),
        // Receita passa pelo mesmo filtro de privacidade: quem não compartilha
        // não entra no saldo dos outros, igual ao gasto.
        prisma.receita.aggregate({
          where: combinarFiltrosDeReceita(filtroDeReceitasVisiveis(usuario), { data: periodo }),
          _sum: { valorCentavos: true },
        }),
      ]);

    const receitasCentavos = somaDeReceitas._sum.valorCentavos ?? 0;

    const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
    const membroPorId = new Map(membros.map((m) => [m.id, { id: m.id, nome: nomeDoUsuario(m) }]));

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
      receitasCentavos,
      // Negativo quer dizer que faltou — é o número que a tela pinta de
      // vermelho, e o motivo de receita existir neste app.
      saldoCentavos: receitasCentavos - totalCentavos,
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
  /**
   * O que já está comprometido num mês que ainda não começou.
   *
   * Duas origens que somam de formas diferentes: as PARCELAS já existem como
   * lançamento no mês futuro (o parcelamento cria uma linha por mês), enquanto
   * as CONTAS FIXAS ainda não existem — desde que elas passaram a nascer só no
   * dia, somar "os gastos do mês que vem" deixaria de fora justamente o
   * aluguel. Por isso as duas são calculadas separado e aparecem separadas.
   */
  app.get('/previsao', async (request: FastifyRequest): Promise<Previsao> => {
    const usuario = usuarioDaRequisicao(request);
    const pedido = previsaoSchema.parse(request.query);

    const agora = hoje();
    const padrao = proximoMes(agora.getUTCFullYear(), agora.getUTCMonth() + 1);
    const ano = pedido.ano ?? padrao.ano;
    const mes = pedido.mes ?? padrao.mes;

    const periodo = { gte: inicioDoMes(ano, mes), lt: inicioDoProximoMes(ano, mes) };
    const visivel = filtroDeGastosVisiveis(usuario);

    const [lancados, recorrencias] = await Promise.all([
      prisma.gasto.findMany({
        where: combinarFiltros(visivel, { data: periodo }),
        select: { descricao: true, valorCentavos: true, data: true },
        orderBy: { data: 'asc' },
      }),
      prisma.recorrencia.findMany({
        where: {
          ...filtroDeRecorrenciasVisiveis(usuario),
          ativa: true,
          inicioEm: { lt: inicioDoProximoMes(ano, mes) },
        },
        select: { descricao: true, valorCentavos: true, diaDoMes: true, fimEm: true, id: true },
      }),
    ]);

    // Uma conta fixa cujo lançamento daquele mês JÁ existe não pode ser contada
    // duas vezes — acontece quando se pede a previsão de um mês que já começou.
    const jaLancadas = new Set(
      (
        await prisma.gasto.findMany({
          where: combinarFiltros(visivel, { data: periodo, recorrenciaId: { not: null } }),
          select: { recorrenciaId: true },
        })
      ).flatMap((g) => (g.recorrenciaId ? [g.recorrenciaId] : [])),
    );

    const itens: ItemPrevisto[] = lancados.map((g) => ({
      descricao: g.descricao,
      valorCentavos: g.valorCentavos,
      data: formatarDataISO(g.data),
      origem: 'parcela' as const,
    }));

    let contasFixasCentavos = 0;
    for (const recorrencia of recorrencias) {
      if (jaLancadas.has(recorrencia.id)) continue;
      const dia = diaValidoNoMes(ano, mes, recorrencia.diaDoMes);
      const data = dataUTC(ano, mes, dia);
      if (recorrencia.fimEm && data > recorrencia.fimEm) continue;

      contasFixasCentavos += recorrencia.valorCentavos;
      itens.push({
        descricao: recorrencia.descricao,
        valorCentavos: recorrencia.valorCentavos,
        data: formatarDataISO(data),
        origem: 'conta-fixa' as const,
      });
    }

    const lancadosCentavos = somarCentavos(lancados.map((g) => g.valorCentavos));
    itens.sort((a, b) => a.data.localeCompare(b.data));

    return {
      ano,
      mes,
      totalCentavos: lancadosCentavos + contasFixasCentavos,
      lancadosCentavos,
      contasFixasCentavos,
      itens,
    };
  });

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
        ...combinarFiltros(filtroDeGastosVisiveis(usuario), {
          data: {
            gte: inicioDoMes(inicio.ano, inicio.mes),
            lt: inicioDoProximoMes(anoFinal, mesFinal),
          },
        }),
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
