import type { Cartao, Gasto, ListaDeGastos } from '@gastos/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { criarConta, limparBanco, novoServidor } from './ajuda.js';

let app: FastifyInstance;

beforeEach(async () => {
  await limparBanco();
  app ??= await novoServidor();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

async function criarCartao(
  autorizacao: { authorization: string },
  nome: string,
  tipo: 'CREDITO' | 'DEBITO' = 'CREDITO',
): Promise<Cartao> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/cartoes',
    headers: autorizacao,
    payload: { nome, tipo },
  });
  expect(resposta.statusCode).toBe(201);
  return resposta.json<Cartao>();
}

describe('cartões', () => {
  it('começa vazio e aceita apelido livre', async () => {
    const { autorizacao } = await criarConta(app);

    const vazio = await app.inject({ method: 'GET', url: '/api/v1/cartoes', headers: autorizacao });
    expect(vazio.json<{ itens: Cartao[] }>().itens).toHaveLength(0);

    const cartao = await criarCartao(autorizacao, 'Itaú');
    expect(cartao.nome).toBe('Itaú');
    expect(cartao.tipo).toBe('CREDITO');
  });

  it('recusa o mesmo apelido no mesmo tipo, mas aceita em crédito e débito', async () => {
    const { autorizacao } = await criarConta(app);
    await criarCartao(autorizacao, 'Bradesco', 'CREDITO');

    const repetido = await app.inject({
      method: 'POST',
      url: '/api/v1/cartoes',
      headers: autorizacao,
      payload: { nome: 'bradesco', tipo: 'CREDITO' },
    });
    expect(repetido.statusCode).toBe(409);

    // Mesmo banco, meio de pagamento diferente: é outro cartão de verdade.
    await criarCartao(autorizacao, 'Bradesco', 'DEBITO');
  });

  it('filtra os gastos por cartão e por "sem cartão"', async () => {
    const { autorizacao } = await criarConta(app);
    const itau = await criarCartao(autorizacao, 'Itaú');
    const bradesco = await criarCartao(autorizacao, 'Bradesco');

    for (const [descricao, cartaoId] of [
      ['Internet', itau.id],
      ['Mercado', bradesco.id],
      ['Feira', null],
    ] as const) {
      const criado = await app.inject({
        method: 'POST',
        url: '/api/v1/gastos',
        headers: autorizacao,
        payload: { descricao, valorCentavos: 5000, data: '2026-07-10', cartaoId },
      });
      expect(criado.statusCode).toBe(201);
    }

    const doItau = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos?cartaoId=${itau.id}`,
      headers: autorizacao,
    });
    const lista = doItau.json<ListaDeGastos>();
    expect(lista.itens).toHaveLength(1);
    expect(lista.itens[0]?.descricao).toBe('Internet');
    expect(lista.itens[0]?.cartao?.nome).toBe('Itaú');

    const semCartao = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos?cartaoId=sem-cartao',
      headers: autorizacao,
    });
    expect(semCartao.json<ListaDeGastos>().itens.map((g) => g.descricao)).toEqual(['Feira']);
  });

  it('não aceita cartão de outra família', async () => {
    const outra = await criarConta(app, { email: 'outra@exemplo.com' });
    const cartaoAlheio = await criarCartao(outra.autorizacao, 'Nubank');

    const { autorizacao } = await criarConta(app, { email: 'minha@exemplo.com' });
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: {
        descricao: 'Padaria',
        valorCentavos: 1000,
        data: '2026-07-10',
        cartaoId: cartaoAlheio.id,
      },
    });
    expect(resposta.statusCode).toBe(400);
  });

  it('excluir o cartão mantém os gastos, apenas sem cartão', async () => {
    const { autorizacao } = await criarConta(app);
    const cartao = await criarCartao(autorizacao, 'Itaú');

    const criado = await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: {
        descricao: 'Internet',
        valorCentavos: 9990,
        data: '2026-07-10',
        cartaoId: cartao.id,
      },
    });
    const gasto = criado.json<Gasto>();

    const excluido = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cartoes/${cartao.id}`,
      headers: autorizacao,
    });
    expect(excluido.json<{ gastosSemCartao: number }>().gastosSemCartao).toBe(1);

    const depois = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${gasto.id}`,
      headers: autorizacao,
    });
    expect(depois.statusCode).toBe(200);
    expect(depois.json<Gasto>().cartao).toBeNull();
  });

  it('a conta fixa passa o cartão para o gasto que ela lança', async () => {
    const { autorizacao } = await criarConta(app);
    const cartao = await criarCartao(autorizacao, 'Itaú');

    const criada = await app.inject({
      method: 'POST',
      url: '/api/v1/recorrencias',
      headers: autorizacao,
      payload: {
        descricao: 'Aluguel',
        valorCentavos: 150000,
        diaDoMes: 5,
        cartaoId: cartao.id,
      },
    });
    expect(criada.statusCode).toBe(201);

    const lancados = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos?cartaoId=${cartao.id}`,
      headers: autorizacao,
    });
    const lista = lancados.json<ListaDeGastos>();
    expect(lista.itens.length).toBeGreaterThan(0);
    expect(lista.itens[0]?.descricao).toBe('Aluguel');
  });
});
