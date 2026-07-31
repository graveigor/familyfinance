import { describe, expect, it } from 'vitest';
import {
  calcularParcelas,
  centavosDoTextoMascarado,
  formatarBRL,
  formatarBRLCurto,
  mascararMoeda,
  parseValorParaCentavos,
  percentual,
  somarCentavos,
} from './dinheiro.js';

describe('parseValorParaCentavos', () => {
  it('lê os formatos que aparecem na planilha', () => {
    expect(parseValorParaCentavos('1.234,56')).toBe(123456);
    expect(parseValorParaCentavos('1234,56')).toBe(123456);
    expect(parseValorParaCentavos('R$ 1.234,56')).toBe(123456);
    expect(parseValorParaCentavos('r$1.234,56')).toBe(123456);
    expect(parseValorParaCentavos('1234.56')).toBe(123456);
    expect(parseValorParaCentavos('1,234.56')).toBe(123456);
    expect(parseValorParaCentavos('  89,90  ')).toBe(8990);
    expect(parseValorParaCentavos('7')).toBe(700);
    expect(parseValorParaCentavos('0,05')).toBe(5);
  });

  it('trata separador único de 3 dígitos como milhar', () => {
    expect(parseValorParaCentavos('1.234')).toBe(123400);
    expect(parseValorParaCentavos('10.500')).toBe(1050000);
    expect(parseValorParaCentavos('1.234.567')).toBe(123456700);
    // 2 dígitos depois do separador continua sendo decimal
    expect(parseValorParaCentavos('12,50')).toBe(1250);
    expect(parseValorParaCentavos('12,5')).toBe(1250);
    // vírgula em pt-BR é sempre decimal, mesmo com 3 dígitos depois
    expect(parseValorParaCentavos('1,234')).toBe(123);
  });

  it('trata parênteses e sinal como estorno', () => {
    expect(parseValorParaCentavos('(45,90)')).toBe(-4590);
    expect(parseValorParaCentavos('-45,90')).toBe(-4590);
    expect(parseValorParaCentavos('45,90-')).toBe(-4590);
    expect(parseValorParaCentavos('-R$ 1.000,00')).toBe(-100000);
  });

  it('aceita espaço não separável do Excel', () => {
    expect(parseValorParaCentavos('R$ 1.234,56')).toBe(123456);
    expect(parseValorParaCentavos('1 234,56')).toBe(123456);
  });

  it('devolve null para o que não é valor', () => {
    expect(parseValorParaCentavos('')).toBeNull();
    expect(parseValorParaCentavos('   ')).toBeNull();
    expect(parseValorParaCentavos('total')).toBeNull();
    expect(parseValorParaCentavos('12 reais')).toBeNull();
    expect(parseValorParaCentavos('abc')).toBeNull();
  });

  it('não perde centavo por ponto flutuante', () => {
    // 0,1 + 0,2 em float dá 0,30000000000000004; em centavos é exato.
    const a = parseValorParaCentavos('0,10');
    const b = parseValorParaCentavos('0,20');
    expect(somarCentavos([a ?? 0, b ?? 0])).toBe(30);
    expect(parseValorParaCentavos('1.999,99')).toBe(199999);
    expect(parseValorParaCentavos('8,175')).toBe(818); // arredonda no 3º dígito
    expect(parseValorParaCentavos('8,174')).toBe(817);
  });

  it('aceita número vindo direto da planilha', () => {
    expect(parseValorParaCentavos(1234.56)).toBe(123456);
    expect(parseValorParaCentavos(10.07)).toBe(1007);
    expect(parseValorParaCentavos(0)).toBe(0);
    expect(parseValorParaCentavos(Number.NaN)).toBeNull();
  });
});

describe('formatação', () => {
  it('formata em reais', () => {
    expect(formatarBRL(123456).replace(/ /g, ' ')).toBe('R$ 1.234,56');
    expect(formatarBRL(0).replace(/ /g, ' ')).toBe('R$ 0,00');
    expect(formatarBRL(-4590).replace(/ /g, ' ')).toBe('-R$ 45,90');
  });

  it('omite centavos quando são zero na versão curta', () => {
    expect(formatarBRLCurto(32000).replace(/ /g, ' ')).toBe('R$ 320');
    expect(formatarBRLCurto(32050).replace(/ /g, ' ')).toBe('R$ 320,50');
  });

  it('mascara conforme o usuário digita', () => {
    expect(mascararMoeda('')).toBe('');
    expect(mascararMoeda('1').replace(/ /g, ' ')).toBe('R$ 0,01');
    expect(mascararMoeda('1234').replace(/ /g, ' ')).toBe('R$ 12,34');
    expect(centavosDoTextoMascarado('R$ 12,34')).toBe(1234);
    expect(centavosDoTextoMascarado('')).toBe(0);
  });
});

describe('percentual', () => {
  it('calcula sem dividir por zero', () => {
    expect(percentual(2500, 10000)).toBe(25);
    expect(percentual(1, 0)).toBe(0);
  });
});

describe('calcularParcelas', () => {
  it('sem juros, a soma das parcelas bate com a compra', () => {
    const { valores, totalCentavos, jurosCentavos } = calcularParcelas(120000, 3);
    expect(valores).toEqual([40000, 40000, 40000]);
    expect(totalCentavos).toBe(120000);
    expect(jurosCentavos).toBe(0);
  });

  it('sem juros, a sobra dos centavos vai na primeira parcela', () => {
    const { valores } = calcularParcelas(10000, 3);
    expect(valores).toEqual([3334, 3333, 3333]);
    expect(somarCentavos(valores)).toBe(10000);
  });

  it('com juros, usa a tabela Price e devolve parcelas iguais', () => {
    // R$ 1.200 em 12x a 2% a.m. = 12x de R$ 113,47. Conferido amortizando mês a
    // mês: a esse valor o saldo zera no fim (sobram 2 centavos); um centavo a
    // mais na parcela pagaria 11 centavos além da dívida.
    const { valores, totalCentavos, jurosCentavos } = calcularParcelas(120000, 12, 2);
    expect(valores).toHaveLength(12);
    expect(new Set(valores).size).toBe(1);
    expect(valores[0]).toBe(11347);
    expect(totalCentavos).toBe(11347 * 12);
    expect(jurosCentavos).toBe(11347 * 12 - 120000);
  });

  it('a parcela realmente quita a dívida na taxa informada', () => {
    // Independe da fórmula: amortiza mês a mês e o saldo tem de zerar.
    const { valores } = calcularParcelas(250000, 10, 3);
    let saldo = 250000;
    for (const parcela of valores) saldo = saldo * 1.03 - parcela;
    expect(Math.abs(saldo)).toBeLessThan(valores[0]! / 100);
  });

  it('o total é sempre a soma do que vai cair na fatura', () => {
    const { valores, totalCentavos } = calcularParcelas(99999, 7, 1.99);
    expect(somarCentavos(valores)).toBe(totalCentavos);
  });

  it('juros zero, vazio ou negativo caem no caso sem juros', () => {
    for (const taxa of [0, -1, Number.NaN]) {
      expect(calcularParcelas(60000, 2, taxa).jurosCentavos).toBe(0);
    }
  });

  it('uma parcela só devolve a compra inteira, mesmo com juros informado', () => {
    expect(calcularParcelas(50000, 1, 5)).toEqual({
      valores: [50000],
      totalCentavos: 50000,
      jurosCentavos: 0,
    });
  });

  it('aguenta o parcelamento mais longo aceito', () => {
    const { valores, jurosCentavos } = calcularParcelas(500000, 64, 1.5);
    expect(valores).toHaveLength(64);
    expect(jurosCentavos).toBeGreaterThan(0);
  });
});
