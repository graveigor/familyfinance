import { erroValidacao, parseData } from '@gastos/core';

/**
 * Converte `aaaa-mm-dd` em Date de meia-noite UTC (as colunas são `date`).
 *
 * Mora aqui porque gastos e receitas precisam da mesma conversão, com a mesma
 * mensagem de erro — duas cópias divergiriam na primeira vez que alguém
 * melhorasse o texto de uma delas.
 */
export function paraData(texto: string): Date {
  const data = parseData(texto);
  if (!data) throw erroValidacao('Essa data não existe no calendário.', { data: 'Data inválida.' });
  return data;
}
