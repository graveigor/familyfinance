import { nomeDoMes, type Idioma } from './datas.js';
import { formatarBRLCurto } from './dinheiro.js';
import type { ResumoMensal } from './tipos.js';

/**
 * Frase de comparação da tela inicial. O usuário precisa entender sem
 * interpretar número: "R$ 320 a mais que em junho".
 */
export function fraseComparacaoMensal(resumo: ResumoMensal, idioma: Idioma = 'pt'): string {
  const { diferencaCentavos, mes } = resumo.mesAnterior;
  const mesPassado = nomeDoMes(mes, idioma);
  const ingles = idioma === 'en';

  if (resumo.mesAnterior.totalCentavos === 0) {
    return ingles ? 'First month with expenses recorded.' : 'Primeiro mês com gastos registrados.';
  }
  if (diferencaCentavos === 0) {
    return ingles ? `Same as in ${mesPassado}.` : `Mesmo valor que em ${mesPassado}.`;
  }
  const valor = formatarBRLCurto(Math.abs(diferencaCentavos), idioma);
  if (ingles) {
    return diferencaCentavos > 0
      ? `${valor} more than in ${mesPassado}.`
      : `${valor} less than in ${mesPassado}.`;
  }
  return diferencaCentavos > 0
    ? `${valor} a mais que em ${mesPassado}.`
    : `${valor} a menos que em ${mesPassado}.`;
}

/** "3 gastos" / "1 gasto" — plural sem depender de biblioteca. */
export function pluralizar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/**
 * Remove acentos e caixa para comparar nomes digitados à mão
 * ("José" === "jose"). Usado no casamento de pessoas da planilha e no
 * autocompletar de descrição.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
