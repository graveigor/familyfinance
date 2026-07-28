import { describe, expect, it } from 'vitest';
import {
  dataDeSerialExcel,
  dataUTC,
  fimDoMes,
  formatarData,
  formatarDataISO,
  inicioDoProximoMes,
  mesAnterior,
  nomeDoMes,
  parseData,
  rotuloDoDia,
} from './datas.js';

describe('parseData', () => {
  it('lê os formatos da planilha e do usuário', () => {
    expect(formatarDataISO(parseData('12/03/2024')!)).toBe('2024-03-12');
    expect(formatarDataISO(parseData('12/03/24')!)).toBe('2024-03-12');
    expect(formatarDataISO(parseData('12-03-2024')!)).toBe('2024-03-12');
    expect(formatarDataISO(parseData('12.03.2024')!)).toBe('2024-03-12');
    expect(formatarDataISO(parseData('2024-03-12')!)).toBe('2024-03-12');
    expect(formatarDataISO(parseData('2024-03-12T10:30:00Z')!)).toBe('2024-03-12');
    expect(formatarDataISO(parseData('1/3/2024')!)).toBe('2024-03-01');
  });

  it('resolve ano de dois dígitos como o Excel', () => {
    expect(parseData('01/01/68')?.getUTCFullYear()).toBe(2068);
    expect(parseData('01/01/69')?.getUTCFullYear()).toBe(1969);
    expect(parseData('01/01/99')?.getUTCFullYear()).toBe(1999);
  });

  it('lê o serial numérico do Excel', () => {
    // 45364 = 12/03/2024 no sistema de datas de 1900
    expect(formatarDataISO(dataDeSerialExcel(45363)!)).toBe('2024-03-12');
    expect(formatarDataISO(parseData(45363)!)).toBe('2024-03-12');
    expect(formatarDataISO(parseData('45363')!)).toBe('2024-03-12');
    expect(dataDeSerialExcel(0)).toBeNull();
  });

  it('rejeita data que não existe', () => {
    expect(parseData('32/01/2024')).toBeNull();
    expect(parseData('30/02/2024')).toBeNull();
    expect(parseData('12/13/2024')).toBeNull();
    expect(parseData('')).toBeNull();
    expect(parseData('ontem')).toBeNull();
  });

  it('não desloca o dia por causa de fuso', () => {
    // 01/01 em fuso negativo viraria 31/12 se usássemos hora local.
    const data = parseData('01/01/2024')!;
    expect(formatarData(data)).toBe('01/01/2024');
    expect(data.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('períodos', () => {
  it('calcula limites do mês', () => {
    expect(formatarDataISO(fimDoMes(2024, 2))).toBe('2024-02-29');
    expect(formatarDataISO(fimDoMes(2023, 2))).toBe('2023-02-28');
    expect(formatarDataISO(inicioDoProximoMes(2024, 12))).toBe('2025-01-01');
    expect(mesAnterior(2024, 1)).toEqual({ ano: 2023, mes: 12 });
    expect(nomeDoMes(6)).toBe('junho');
  });
});

describe('rotuloDoDia', () => {
  const referencia = dataUTC(2024, 3, 12);

  it('usa palavras em vez de data quando é recente', () => {
    expect(rotuloDoDia(dataUTC(2024, 3, 12), referencia)).toBe('Hoje');
    expect(rotuloDoDia(dataUTC(2024, 3, 11), referencia)).toBe('Ontem');
    expect(rotuloDoDia(dataUTC(2024, 3, 9), referencia)).toBe('sábado, 9 de março');
    expect(rotuloDoDia(dataUTC(2023, 12, 25), referencia)).toBe('segunda-feira, 25 de dezembro de 2023');
  });
});
