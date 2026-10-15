import { describe, expect, it } from 'vitest';
import { AVISO_DO_ORCAMENTO, percentualDoOrcamento, situacaoDoOrcamento } from './orcamento.js';

/**
 * A regra do semáforo. Mora no core para a tela e o teste nunca discordarem
 * sobre quando o amarelo acende.
 */

describe('situação do orçamento', () => {
  const limite = 80000; // R$ 800

  it('tranquilo bem abaixo do teto', () => {
    expect(situacaoDoOrcamento(10000, limite)).toBe('tranquilo');
    expect(situacaoDoOrcamento(63999, limite)).toBe('tranquilo');
  });

  it('atenção a partir de 80% do teto', () => {
    // 80% de 800 é 640: o centavo que completa já acende o aviso.
    expect(situacaoDoOrcamento(64000, limite)).toBe('atencao');
    expect(situacaoDoOrcamento(79999, limite)).toBe('atencao');
  });

  it('gastar exatamente o teto ainda não é estourar', () => {
    expect(situacaoDoOrcamento(limite, limite)).toBe('atencao');
  });

  it('estourado passando um centavo do teto', () => {
    expect(situacaoDoOrcamento(limite + 1, limite)).toBe('estourado');
  });

  it('teto zero não é teto, e não estoura com qualquer gasto', () => {
    // Seria verdade matemática e mentira útil: sem limite definido, nada
    // "estourou".
    expect(situacaoDoOrcamento(50000, 0)).toBe('tranquilo');
    expect(situacaoDoOrcamento(50000, -1)).toBe('tranquilo');
  });

  it('o aviso está em 80%', () => {
    expect(AVISO_DO_ORCAMENTO).toBe(0.8);
  });
});

describe('percentual do teto', () => {
  it('arredonda para inteiro', () => {
    expect(percentualDoOrcamento(40000, 80000)).toBe(50);
    expect(percentualDoOrcamento(26667, 80000)).toBe(33);
  });

  it('passa de 100 quando estoura — a barra precisa saber disso', () => {
    expect(percentualDoOrcamento(100000, 80000)).toBe(125);
  });

  it('sem teto, zero por cento (nada a dividir)', () => {
    expect(percentualDoOrcamento(50000, 0)).toBe(0);
  });
});
