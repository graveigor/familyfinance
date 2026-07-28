import { dataUTC, fimDoMes, formatarDataISO } from '@gastos/core';
import { prisma } from '../prisma.js';

/**
 * Geração dos lançamentos de gastos recorrentes.
 *
 * Não existe tarefa agendada rodando em segundo plano: os meses pendentes são
 * criados quando alguém abre o app. Duas coisas tornam isso seguro:
 *  - `ultimoMesGerado` guarda até onde já foi, então repetir a chamada não
 *    duplica nada;
 *  - tudo acontece numa transação por recorrência.
 */

/** `aaaa-mm` */
function chaveDoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

function mesDaChave(chave: string): { ano: number; mes: number } | null {
  const partes = /^(\d{4})-(\d{2})$/.exec(chave);
  if (!partes) return null;
  return { ano: Number(partes[1]), mes: Number(partes[2]) };
}

function proximoMes(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

/**
 * Dia do lançamento no mês. "Todo dia 31" em fevereiro vira o dia 28 (ou 29):
 * pular o mês seria pior — a conta existe de qualquer jeito.
 */
export function diaValidoNoMes(ano: number, mes: number, diaDesejado: number): number {
  const ultimoDia = fimDoMes(ano, mes).getUTCDate();
  return Math.min(diaDesejado, ultimoDia);
}

export interface ResultadoDaGeracao {
  gastosCriados: number;
  recorrenciasProcessadas: number;
}

/**
 * Cria os gastos que faltam, do mês de início (ou do último gerado) até o mês
 * de referência. Nunca gera mês futuro.
 */
export async function gerarPendentes(
  householdId: string,
  referencia: Date = new Date(),
): Promise<ResultadoDaGeracao> {
  const anoLimite = referencia.getUTCFullYear();
  const mesLimite = referencia.getUTCMonth() + 1;

  const recorrencias = await prisma.recorrencia.findMany({
    where: { householdId, ativa: true },
  });

  let gastosCriados = 0;

  for (const recorrencia of recorrencias) {
    // De onde continuar: o mês seguinte ao último gerado, ou o mês de início.
    const ultimo = recorrencia.ultimoMesGerado ? mesDaChave(recorrencia.ultimoMesGerado) : null;
    let atual = ultimo
      ? proximoMes(ultimo.ano, ultimo.mes)
      : {
          ano: recorrencia.inicioEm.getUTCFullYear(),
          mes: recorrencia.inicioEm.getUTCMonth() + 1,
        };

    const aCriar: Array<{ data: Date; chave: string }> = [];
    // O limite de 60 meses evita laço infinito se alguém gravar uma data absurda.
    for (let passo = 0; passo < 60; passo += 1) {
      if (atual.ano > anoLimite || (atual.ano === anoLimite && atual.mes > mesLimite)) break;

      const dia = diaValidoNoMes(atual.ano, atual.mes, recorrencia.diaDoMes);
      const data = dataUTC(atual.ano, atual.mes, dia);

      // Passou da data de término: para por aqui.
      if (recorrencia.fimEm && data > recorrencia.fimEm) break;

      aCriar.push({ data, chave: chaveDoMes(atual.ano, atual.mes) });
      atual = proximoMes(atual.ano, atual.mes);
    }

    if (aCriar.length === 0) continue;

    const ultimaChave = aCriar[aCriar.length - 1]?.chave;
    await prisma.$transaction(async (tx) => {
      await tx.gasto.createMany({
        data: aCriar.map((item) => ({
          descricao: recorrencia.descricao,
          valorCentavos: recorrencia.valorCentavos,
          data: item.data,
          formaPagamento: recorrencia.formaPagamento,
          observacao: recorrencia.observacao,
          categoriaId: recorrencia.categoriaId,
          userId: recorrencia.userId,
          householdId: recorrencia.householdId,
          recorrenciaId: recorrencia.id,
        })),
      });
      await tx.recorrencia.update({
        where: { id: recorrencia.id },
        data: { ultimoMesGerado: ultimaChave },
      });
    });

    gastosCriados += aCriar.length;
  }

  return { gastosCriados, recorrenciasProcessadas: recorrencias.length };
}

/** Data do próximo lançamento, para mostrar na tela. `null` se já terminou. */
export function proximoLancamento(
  recorrencia: { diaDoMes: number; ultimoMesGerado: string | null; fimEm: Date | null; ativa: boolean },
  referencia: Date = new Date(),
): string | null {
  if (!recorrencia.ativa) return null;

  const ultimo = recorrencia.ultimoMesGerado ? mesDaChave(recorrencia.ultimoMesGerado) : null;
  const base = ultimo ?? {
    ano: referencia.getUTCFullYear(),
    mes: referencia.getUTCMonth() + 1,
  };
  const seguinte = ultimo ? proximoMes(base.ano, base.mes) : base;

  const dia = diaValidoNoMes(seguinte.ano, seguinte.mes, recorrencia.diaDoMes);
  const data = dataUTC(seguinte.ano, seguinte.mes, dia);
  if (recorrencia.fimEm && data > recorrencia.fimEm) return null;

  return formatarDataISO(data);
}
