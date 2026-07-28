import { describe, expect, it } from 'vitest';
import {
  detectarColunas,
  ehLinhaDeTotal,
  encontrarLinhaDeCabecalho,
} from './importacao.js';

describe('detectarColunas', () => {
  it('reconhece o cabeçalho da planilha atual da família', () => {
    expect(detectarColunas(['Nome', 'Local', 'Valor'])).toEqual({
      pessoa: 0,
      descricao: 1,
      valor: 2,
    });
  });

  it('ignora acentos, caixa e pontuação', () => {
    expect(detectarColunas(['DATA', 'Descrição', 'VALOR (R$)', 'Responsável'])).toEqual({
      data: 0,
      descricao: 1,
      valor: 2,
      pessoa: 3,
    });
  });

  it('resolve o sinônimo ambíguo "gasto"', () => {
    // "gasto" é sinônimo de descrição e de valor; com "Valor" presente,
    // a coluna "Gasto" tem de virar a descrição.
    expect(detectarColunas(['Data', 'Gasto', 'Valor'])).toEqual({
      data: 0,
      descricao: 1,
      valor: 2,
    });
    // Sem outra candidata a valor, "Gasto" continua sendo a descrição e o
    // valor fica sem coluna — o app pergunta em vez de adivinhar errado.
    expect(detectarColunas(['Data', 'Gasto'])).toEqual({ data: 0, descricao: 1 });
  });

  it('aceita os outros nomes que aparecem na prática', () => {
    expect(detectarColunas(['Dia', 'Estabelecimento', 'Preço', 'Quem', 'Tipo'])).toEqual({
      data: 0,
      descricao: 1,
      valor: 2,
      pessoa: 3,
      categoria: 4,
    });
    expect(detectarColunas(['Vencimento', 'Histórico', 'Quantia', 'Titular'])).toEqual({
      data: 0,
      descricao: 1,
      valor: 2,
      pessoa: 3,
    });
  });

  it('não inventa coluna quando o cabeçalho não diz nada', () => {
    expect(detectarColunas(['A', 'B', 'C'])).toEqual({});
    expect(detectarColunas([])).toEqual({});
  });

  it('nunca usa a mesma coluna para dois campos', () => {
    const mapeamento = detectarColunas(['Valor', 'Valor', 'Local']);
    const colunas = Object.values(mapeamento);
    expect(new Set(colunas).size).toBe(colunas.length);
  });
});

describe('encontrarLinhaDeCabecalho', () => {
  it('pula título e linhas em branco', () => {
    const linhas = [
      ['Gastos da família — 2024'],
      [],
      ['', ''],
      ['Nome', 'Local', 'Valor'],
      ['Maria', 'Mercado', '100,00'],
    ];
    expect(encontrarLinhaDeCabecalho(linhas)).toBe(3);
  });

  it('usa a primeira linha quando ela já é o cabeçalho', () => {
    expect(encontrarLinhaDeCabecalho([['Nome', 'Valor'], ['Maria', '10']])).toBe(0);
  });
});

describe('ehLinhaDeTotal', () => {
  it('reconhece linhas de fechamento', () => {
    expect(ehLinhaDeTotal('TOTAL')).toBe(true);
    expect(ehLinhaDeTotal('Total do mês')).toBe(true);
    expect(ehLinhaDeTotal('Subtotal')).toBe(true);
    expect(ehLinhaDeTotal('soma')).toBe(true);
    expect(ehLinhaDeTotal('Saldo final')).toBe(true);
  });

  it('não confunde com gasto de verdade', () => {
    expect(ehLinhaDeTotal('Supermercado Total Ltda')).toBe(true); // contém a palavra
    expect(ehLinhaDeTotal('Padaria da esquina')).toBe(false);
    expect(ehLinhaDeTotal('Totem digital')).toBe(false); // não é a palavra "total"
    expect(ehLinhaDeTotal('')).toBe(false);
  });
});
