/**
 * A leitura de um teto mensal.
 *
 * A regra de "quando acender o amarelo" mora aqui, e não na tela, para o teste
 * e o que a pessoa vê concordarem sempre. 80% é o aviso: é cedo o bastante
 * para dar tempo de segurar o resto do mês, e tarde o bastante para não virar
 * alarme toda semana.
 */

export type SituacaoDoOrcamento = 'tranquilo' | 'atencao' | 'estourado';

/** A partir de quanto do teto o aviso acende. */
export const AVISO_DO_ORCAMENTO = 0.8;

export function situacaoDoOrcamento(
  gastoCentavos: number,
  limiteCentavos: number,
): SituacaoDoOrcamento {
  // Teto zero ou negativo não é teto: sem ele, qualquer gasto "estourou", o
  // que seria verdade matemática e mentira útil.
  if (limiteCentavos <= 0) return 'tranquilo';
  if (gastoCentavos > limiteCentavos) return 'estourado';
  if (gastoCentavos >= limiteCentavos * AVISO_DO_ORCAMENTO) return 'atencao';
  return 'tranquilo';
}

/** Quanto do teto já foi usado, em porcentagem inteira. Passa de 100 ao estourar. */
export function percentualDoOrcamento(gastoCentavos: number, limiteCentavos: number): number {
  if (limiteCentavos <= 0) return 0;
  return Math.round((gastoCentavos / limiteCentavos) * 100);
}
