import { describe, expect, it } from 'vitest';
import { dataUTC } from './datas.js';
import {
  diaValidoNoMes,
  faturaDaCompra,
  fechamentoDaFatura,
  periodoDaFatura,
  vencimentoDaFatura,
} from './faturas.js';

/**
 * A conta que faz o "quanto vou pagar" bater com o aplicativo do banco.
 * Os meses curtos são o que quebra: fechar "todo dia 31" em fevereiro, e
 * vencer antes de fechar.
 */

describe('encaixe do dia no mês', () => {
  it('encurta o dia 31 nos meses que não têm', () => {
    expect(diaValidoNoMes(2026, 2, 31)).toBe(28);
    expect(diaValidoNoMes(2024, 2, 31)).toBe(29); // bissexto
    expect(diaValidoNoMes(2026, 4, 31)).toBe(30);
    expect(diaValidoNoMes(2026, 1, 31)).toBe(31);
  });

  it('nunca devolve dia menor que 1', () => {
    expect(diaValidoNoMes(2026, 3, 0)).toBe(1);
    expect(diaValidoNoMes(2026, 3, -5)).toBe(1);
  });
});

describe('em qual fatura a compra cai', () => {
  it('até o fechamento é deste mês; depois, do mês seguinte', () => {
    // Fecha dia 28.
    expect(faturaDaCompra(dataUTC(2026, 3, 10), 28)).toEqual({ ano: 2026, mes: 3 });
    expect(faturaDaCompra(dataUTC(2026, 3, 28), 28)).toEqual({ ano: 2026, mes: 3 });
    // É a surpresa de quem compra dia 29 e só vê a cobrança no mês seguinte.
    expect(faturaDaCompra(dataUTC(2026, 3, 29), 28)).toEqual({ ano: 2026, mes: 4 });
  });

  it('vira o ano em dezembro', () => {
    expect(faturaDaCompra(dataUTC(2026, 12, 30), 28)).toEqual({ ano: 2027, mes: 1 });
  });

  it('fechamento no dia 31 em fevereiro: tudo do mês cabe na fatura', () => {
    // O fechamento encurta para 28, e o dia 28 ainda é o último do mês.
    expect(faturaDaCompra(dataUTC(2026, 2, 28), 31)).toEqual({ ano: 2026, mes: 2 });
  });
});

describe('vencimento da fatura', () => {
  it('vence no mesmo mês quando o dia é depois do fechamento', () => {
    // Fecha dia 5, vence dia 15: os dois em março.
    expect(vencimentoDaFatura({ ano: 2026, mes: 3 }, 5, 15)).toBe('2026-03-15');
  });

  it('vence no mês seguinte quando o dia vem antes do fechamento', () => {
    // Fecha dia 28, vence dia 5 — o arranjo mais comum que existe.
    expect(vencimentoDaFatura({ ano: 2026, mes: 3 }, 28, 5)).toBe('2026-04-05');
  });

  it('vencimento igual ao fechamento cai no mês seguinte', () => {
    expect(vencimentoDaFatura({ ano: 2026, mes: 3 }, 10, 10)).toBe('2026-04-10');
  });

  it('vira o ano', () => {
    expect(vencimentoDaFatura({ ano: 2026, mes: 12 }, 28, 5)).toBe('2027-01-05');
  });

  it('vence no mesmo mês mesmo com dia alto, se for depois do fechamento', () => {
    // Fecha 28, vence 31: os dois em janeiro.
    expect(vencimentoDaFatura({ ano: 2026, mes: 1 }, 28, 31)).toBe('2026-01-31');
  });

  it('encurta o vencimento quando ele cai num mês curto', () => {
    // Fecha 31 (janeiro tem), vence 30: como 30 <= 31, vai para fevereiro —
    // que não tem dia 30 e encurta para 28.
    expect(vencimentoDaFatura({ ano: 2026, mes: 1 }, 31, 30)).toBe('2026-02-28');
  });
});

describe('período coberto pela fatura', () => {
  it('vai do dia seguinte ao fechamento anterior até o fechamento deste mês', () => {
    expect(periodoDaFatura({ ano: 2026, mes: 3 }, 28)).toEqual({
      de: '2026-03-01', // fevereiro fecha dia 28, que é o último dia
      ate: '2026-03-28',
    });
    expect(periodoDaFatura({ ano: 2026, mes: 4 }, 10)).toEqual({
      de: '2026-03-11',
      ate: '2026-04-10',
    });
  });

  it('vira o ano para trás em janeiro', () => {
    expect(periodoDaFatura({ ano: 2026, mes: 1 }, 20)).toEqual({
      de: '2025-12-21',
      ate: '2026-01-20',
    });
  });

  it('o fechamento é o fim do período', () => {
    expect(fechamentoDaFatura({ ano: 2026, mes: 2 }, 31)).toBe('2026-02-28');
  });
});
