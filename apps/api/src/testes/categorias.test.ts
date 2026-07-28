import type { Categoria, ListaDeGastos } from '@gastos/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { criarConta, idDaCategoria, limparBanco, novoServidor } from './ajuda.js';

let app: FastifyInstance;

beforeEach(async () => {
  await limparBanco();
  app ??= await novoServidor();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('categorias', () => {
  it('lista as 9 categorias padrão em ordem alfabética', async () => {
    const { autorizacao } = await criarConta(app);
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/categorias',
      headers: autorizacao,
    });

    const { itens } = resposta.json<{ itens: Categoria[] }>();
    expect(itens).toHaveLength(9);
    expect(itens[0]?.nome).toBe('Alimentação');
    expect(itens.map((c) => c.nome)).toContain('Mercado');
    expect(itens[0]?.cor).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('cria categoria nova e recusa nome repetido', async () => {
    const { autorizacao } = await criarConta(app);

    const criada = await app.inject({
      method: 'POST',
      url: '/api/v1/categorias',
      headers: autorizacao,
      payload: { nome: 'Pets', icone: 'pata', cor: '#8B5CF6' },
    });
    expect(criada.statusCode).toBe(201);
    expect(criada.json<Categoria>().nome).toBe('Pets');

    // Repetição ignora maiúsculas/minúsculas: "mercado" já existe.
    const repetida = await app.inject({
      method: 'POST',
      url: '/api/v1/categorias',
      headers: autorizacao,
      payload: { nome: 'mercado' },
    });
    expect(repetida.statusCode).toBe(409);
  });

  it('apagar categoria deixa os gastos sem categoria, sem apagar nada', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const mercado = await idDaCategoria(sessao.usuario.householdId, 'Mercado');

    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: {
        descricao: 'Supermercado',
        valorCentavos: 45890,
        data: '2024-03-12',
        categoriaId: mercado,
      },
    });

    const exclusao = await app.inject({
      method: 'DELETE',
      url: `/api/v1/categorias/${mercado}`,
      headers: autorizacao,
    });
    expect(exclusao.statusCode).toBe(200);
    expect(exclusao.json<{ gastosSemCategoria: number }>().gastosSemCategoria).toBe(1);

    const lista = await app.inject({ method: 'GET', url: '/api/v1/gastos', headers: autorizacao });
    const { itens, totalCentavos } = lista.json<ListaDeGastos>();
    expect(itens).toHaveLength(1);
    expect(itens[0]?.categoria).toBeNull();
    expect(totalCentavos).toBe(45890);
  });

  it('não deixa mexer em categoria de outra família', async () => {
    const casaA = await criarConta(app, { email: 'a@exemplo.com' });
    const casaB = await criarConta(app, { email: 'b@exemplo.com', nome: 'João Souza' });
    const categoriaDeB = await idDaCategoria(casaB.sessao.usuario.householdId, 'Mercado');

    const alteracao = await app.inject({
      method: 'PATCH',
      url: `/api/v1/categorias/${categoriaDeB}`,
      headers: casaA.autorizacao,
      payload: { nome: 'Invadida' },
    });
    expect(alteracao.statusCode).toBe(404);
  });
});
