import { dataUTC } from '@gastos/core';
import type { Previsao } from '@gastos/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { gerarPendentes } from '../servicos/recorrencias.js';
import { criarConta, limparBanco, novoServidor } from './ajuda.js';

/**
 * "Quanto do mês que vem já está comprometido."
 *
 * A conta não é "somar os gastos do mês que vem": as parcelas já existem como
 * lançamento lá na frente, mas as contas fixas não — elas só viram gasto no
 * dia. Somar só o que existe deixaria o aluguel de fora.
 */

let app: FastifyInstance;

beforeEach(async () => {
  await limparBanco();
  app ??= await novoServidor();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

const previsao = (headers: { authorization: string }, ano: number, mes: number) =>
  app
    .inject({ method: 'GET', url: `/api/v1/resumos/previsao?ano=${ano}&mes=${mes}`, headers })
    .then((r) => r.json<Previsao>());

describe('previsão do mês', () => {
  it('soma as parcelas já lançadas no mês futuro', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    // Um gasto parcelado deixa uma linha por mês; aqui basta uma no futuro.
    await prisma.gasto.create({
      data: {
        descricao: 'Geladeira 2/10',
        valorCentavos: 30000,
        data: dataUTC(2027, 1, 5),
        userId: sessao.usuario.id,
        householdId: sessao.usuario.householdId,
      },
    });

    const resultado = await previsao(autorizacao, 2027, 1);
    expect(resultado.lancadosCentavos).toBe(30000);
    expect(resultado.contasFixasCentavos).toBe(0);
    expect(resultado.totalCentavos).toBe(30000);
    expect(resultado.itens.map((i) => i.origem)).toEqual(['parcela']);
  });

  it('soma a conta fixa que ainda NÃO virou gasto', async () => {
    const { autorizacao } = await criarConta(app);
    await app.inject({
      method: 'POST',
      url: '/api/v1/recorrencias',
      headers: autorizacao,
      payload: {
        descricao: 'Aluguel',
        valorCentavos: 180000,
        diaDoMes: 10,
        inicioEm: '2026-01-01',
      },
    });

    const resultado = await previsao(autorizacao, 2027, 3);
    expect(resultado.contasFixasCentavos, 'o aluguel precisa entrar mesmo sem linha no banco').toBe(
      180000,
    );
    expect(resultado.itens.map((i) => i.origem)).toEqual(['conta-fixa']);
    expect(resultado.itens[0]?.data).toBe('2027-03-10');
  });

  it('não conta duas vezes a conta fixa que já foi lançada', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    await app.inject({
      method: 'POST',
      url: '/api/v1/recorrencias',
      headers: autorizacao,
      payload: {
        descricao: 'Internet',
        valorCentavos: 12000,
        diaDoMes: 10,
        inicioEm: '2026-01-01',
      },
    });
    await prisma.gasto.deleteMany();
    await prisma.recorrencia.updateMany({ data: { ultimoMesGerado: null } });
    await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 1, 10));

    // Janeiro já tem o lançamento: ele conta como "lançado", não como previsto.
    const resultado = await previsao(autorizacao, 2026, 1);
    expect(resultado.lancadosCentavos).toBe(12000);
    expect(resultado.contasFixasCentavos, 'seria 24.000 se contasse duas vezes').toBe(0);
    expect(resultado.totalCentavos).toBe(12000);
  });

  it('para de prever depois da data de término da conta fixa', async () => {
    const { autorizacao } = await criarConta(app);
    await app.inject({
      method: 'POST',
      url: '/api/v1/recorrencias',
      headers: autorizacao,
      payload: {
        descricao: 'Curso',
        valorCentavos: 50000,
        diaDoMes: 5,
        inicioEm: '2026-01-01',
        fimEm: '2027-06-30',
      },
    });

    // Meses no futuro de propósito: num mês que já passou a conta virou
    // lançamento, e aí ela conta como "lançado", não como previsto.
    const ultimo = await previsao(autorizacao, 2027, 6);
    expect(ultimo.contasFixasCentavos, 'junho ainda está dentro do término').toBe(50000);

    const depoisDoFim = await previsao(autorizacao, 2027, 7);
    expect(depoisDoFim.contasFixasCentavos, 'julho já passou do fim').toBe(0);
    expect(depoisDoFim.totalCentavos).toBe(0);
  });

  it('não mostra o que é de quem não compartilha', async () => {
    const dona = await criarConta(app, { email: 'ana@exemplo.com', nome: 'Ana Lima' });
    const convite = await app.inject({
      method: 'POST',
      url: '/api/v1/household/convites',
      headers: dona.autorizacao,
      payload: {},
    });
    const outra = await criarConta(app, {
      email: 'bruno@exemplo.com',
      nome: 'Bruno Dias',
      codigoConvite: convite.json<{ codigo: string }>().codigo,
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/recorrencias',
      headers: outra.autorizacao,
      payload: {
        descricao: 'Clínica',
        valorCentavos: 45000,
        diaDoMes: 8,
        inicioEm: '2026-01-01',
      },
    });

    const daAna = await previsao(dona.autorizacao, 2027, 2);
    expect(daAna.totalCentavos, 'a conta fixa do Bruno é privada').toBe(0);
    expect(daAna.itens).toHaveLength(0);

    const doBruno = await previsao(outra.autorizacao, 2027, 2);
    expect(doBruno.contasFixasCentavos).toBe(45000);
  });

  it('sem mês informado, assume o mês que vem', async () => {
    const { autorizacao } = await criarConta(app);
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/resumos/previsao',
      headers: autorizacao,
    });
    expect(resposta.statusCode).toBe(200);

    const agora = new Date();
    const esperado =
      agora.getUTCMonth() + 1 === 12
        ? { ano: agora.getUTCFullYear() + 1, mes: 1 }
        : { ano: agora.getUTCFullYear(), mes: agora.getUTCMonth() + 2 };
    const corpo = resposta.json<Previsao>();
    expect({ ano: corpo.ano, mes: corpo.mes }).toEqual(esperado);
  });
});
