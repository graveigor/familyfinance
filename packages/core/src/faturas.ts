import { dataUTC, fimDoMes, formatarDataISO } from './datas.js';

/**
 * A conta do cartão de crédito.
 *
 * Duas datas governam tudo: o dia em que a fatura FECHA (depois dele a compra
 * já é da próxima) e o dia em que ela VENCE. Sem elas, uma compra feita dia 28
 * aparece no mês errado e o "quanto vou pagar" nunca bate com o aplicativo do
 * banco.
 *
 * Tudo aqui é função pura de data: nenhuma consulta, nenhum fuso. As datas do
 * app são dias de calendário em UTC, e é assim que elas entram e saem daqui.
 */

/**
 * Encaixa um dia no mês. "Todo dia 31" em fevereiro vira 28 (ou 29) — pular o
 * mês seria pior, porque a fatura fecha de qualquer jeito.
 */
export function diaValidoNoMes(ano: number, mes: number, diaDesejado: number): number {
  const ultimoDia = fimDoMes(ano, mes).getUTCDate();
  return Math.min(Math.max(1, diaDesejado), ultimoDia);
}

export interface MesDaFatura {
  ano: number;
  mes: number;
}

function proximoMes({ ano, mes }: MesDaFatura): MesDaFatura {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

/**
 * Em qual fatura cai uma compra.
 *
 * Comprou até o fechamento (inclusive), é da fatura que fecha neste mês.
 * Comprou depois, já é da seguinte — que é exatamente a surpresa de quem
 * compra dia 29 e só vê a cobrança no mês seguinte.
 */
export function faturaDaCompra(data: Date, diaFechamento: number): MesDaFatura {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + 1;
  const fechamento = diaValidoNoMes(ano, mes, diaFechamento);
  const atual = { ano, mes };
  return data.getUTCDate() <= fechamento ? atual : proximoMes(atual);
}

/**
 * Quando vence a fatura que fecha em `{ano, mes}`.
 *
 * Vencimento depois do fechamento é no mesmo mês; antes ou igual, cai no mês
 * seguinte — fecha dia 28 e vence dia 5 é o arranjo mais comum que existe.
 */
export function vencimentoDaFatura(
  { ano, mes }: MesDaFatura,
  diaFechamento: number,
  diaVencimento: number,
): string {
  const fechamento = diaValidoNoMes(ano, mes, diaFechamento);
  const mesDoVencimento = diaVencimento > fechamento ? { ano, mes } : proximoMes({ ano, mes });
  const dia = diaValidoNoMes(mesDoVencimento.ano, mesDoVencimento.mes, diaVencimento);
  return formatarDataISO(dataUTC(mesDoVencimento.ano, mesDoVencimento.mes, dia));
}

/** O dia em que a fatura de `{ano, mes}` fecha, como `aaaa-mm-dd`. */
export function fechamentoDaFatura({ ano, mes }: MesDaFatura, diaFechamento: number): string {
  return formatarDataISO(dataUTC(ano, mes, diaValidoNoMes(ano, mes, diaFechamento)));
}

/**
 * O intervalo de compras que a fatura de `{ano, mes}` cobre: do dia seguinte
 * ao fechamento anterior até o fechamento deste mês, ambos inclusive.
 */
export function periodoDaFatura(
  { ano, mes }: MesDaFatura,
  diaFechamento: number,
): { de: string; ate: string } {
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  const fimAnterior = diaValidoNoMes(anterior.ano, anterior.mes, diaFechamento);
  const inicio = dataUTC(anterior.ano, anterior.mes, fimAnterior);
  inicio.setUTCDate(inicio.getUTCDate() + 1);

  return {
    de: formatarDataISO(inicio),
    ate: fechamentoDaFatura({ ano, mes }, diaFechamento),
  };
}
