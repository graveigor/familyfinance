import { describe, expect, it } from 'vitest';
import {
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
