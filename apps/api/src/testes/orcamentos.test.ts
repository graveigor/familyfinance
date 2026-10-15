import type { OrcamentoDaCategoria } from '@gastos/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { criarConta, idDaCategoria, limparBanco, novoServidor } from './ajuda.js';

/**
 * Orçamento: o teto mensal de cada pessoa.
 *
 * Duas coisas importam: ele é ESTRITAMENTE pessoal (nem quem compartilha os
 * gastos mostra o seu teto) e o gasto comparado é o da própria pessoa — não o
 * do grupo, senão a barra não quereria dizer nada.
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

const definir = (
  headers: { authorization: string },
  categoriaId: string,
  limiteCentavos: number,
) =>
  app.inject({
    method: 'PUT',
    url: '/api/v1/orcamentos',
    headers,
    payload: { categoriaId, limiteCentavos },
  });

const listar = (headers: { authorization: string }, ano = 2026, mes = 3) =>
  app
    .inject({ method: 'GET', url: `/api/v1/orcamentos?ano=${ano}&mes=${mes}`, headers })
    .then((r) => r.json<{ itens: OrcamentoDaCategoria[] }>().itens);

const lancar = (
  headers: { authorization: string },
  categoriaId: string,
  valorCentavos: number,
  data = '2026-03-10',
) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/gastos',
    headers,
    payload: { descricao: 'Compra', valorCentavos, data, categoriaId },
  });

describe('definir o teto', () => {
  it('cria e depois altera sem duplicar', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const mercado = await idDaCategoria(sessao.usuario.householdId, 'Mercado');

    expect((await definir(autorizacao, mercado, 80000)).statusCode).toBe(200);
    expect((await definir(autorizacao, mercado, 90000)).statusCode).toBe(200);

    const itens = await listar(autorizacao);
    expect(itens).toHaveLength(1);
    expect(itens[0]?.limiteCentavos).toBe(90000);
  });

  it('recusa limite em categoria de receita', async () => {
    const { autorizacao } = await criarConta(app);
    const receita = await app.inject({
      method: 'GET',
      url: '/api/v1/categorias?tipo=RECEITA',
      headers: autorizacao,
    });
    const salario = receita.json<{ itens: Array<{ id: string }> }>().itens[0]!.id;

    const resposta = await definir(autorizacao, salario, 80000);
    expect(resposta.statusCode).toBe(400);
    expect(resposta.body).toContain('categoria de gasto');
  });

  it('remove o teto', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const mercado = await idDaCategoria(sessao.usuario.householdId, 'Mercado');
    await definir(autorizacao, mercado, 80000);

    const apagar = await app.inject({
      method: 'DELETE',
      url: `/api/v1/orcamentos/${mercado}`,
      headers: autorizacao,
    });
    expect(apagar.statusCode).toBe(204);
    expect(await listar(autorizacao)).toHaveLength(0);
  });
});

describe('quanto do teto já foi', () => {
  it('conta só o gasto do mês pedido', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const mercado = await idDaCategoria(sessao.usuario.householdId, 'Mercado');
    await definir(autorizacao, mercado, 80000);

    await lancar(autorizacao, mercado, 30000, '2026-03-05');
    await lancar(autorizacao, mercado, 10000, '2026-02-28'); // outro mês

    const [item] = await listar(autorizacao, 2026, 3);
    expect(item?.gastoCentavos, 'fevereiro não entra em março').toBe(30000);
    expect(item?.percentual).toBe(38);
    expect(item?.situacao).toBe('tranquilo');
  });

  it('acende o aviso em 80% e marca o estouro', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const mercado = await idDaCategoria(sessao.usuario.householdId, 'Mercado');
    await definir(autorizacao, mercado, 80000);

    await lancar(autorizacao, mercado, 64000);
    expect((await listar(autorizacao))[0]?.situacao).toBe('atencao');

    await lancar(autorizacao, mercado, 20000);
    const estourado = (await listar(autorizacao))[0];
    expect(estourado?.situacao).toBe('estourado');
    expect(estourado?.percentual, '84.000 de 80.000').toBe(105);
  });

  it('o mais perto de estourar vem primeiro', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const mercado = await idDaCategoria(sessao.usuario.householdId, 'Mercado');
    const lazer = await idDaCategoria(sessao.usuario.householdId, 'Lazer');
    await definir(autorizacao, mercado, 100000);
    await definir(autorizacao, lazer, 10000);
    await lancar(autorizacao, mercado, 10000); // 10%
    await lancar(autorizacao, lazer, 9000); // 90%

    const itens = await listar(autorizacao);
    expect(itens.map((i) => i.categoria.nome)).toEqual(['Lazer', 'Mercado']);
  });
});

describe('o teto é só de quem o definiu', () => {
  it('não aparece para mais ninguém do grupo, nem com gastos compartilhados', async () => {
    const ana = await criarConta(app, { email: 'ana@exemplo.com', nome: 'Ana Lima' });
    const convite = await app.inject({
      method: 'POST',
      url: '/api/v1/household/convites',
      headers: ana.autorizacao,
      payload: {},
    });
    const bruno = await criarConta(app, {
      email: 'bruno@exemplo.com',
      nome: 'Bruno Dias',
      codigoConvite: convite.json<{ codigo: string }>().codigo,
    });

    // Os dois abrem os gastos para o grupo: ainda assim o teto não vaza.
    for (const conta of [ana, bruno]) {
      await app.inject({
        method: 'PATCH',
        url: '/api/v1/auth/eu',
        headers: conta.autorizacao,
        payload: { compartilhaGastos: true },
      });
    }

    const mercado = await idDaCategoria(bruno.sessao.usuario.householdId, 'Mercado');
    await definir(bruno.autorizacao, mercado, 80000);

    expect(await listar(ana.autorizacao), 'teto é meta pessoal').toHaveLength(0);
    expect(await listar(bruno.autorizacao)).toHaveLength(1);

    // E a Ana não consegue apagar o teto do Bruno.
    const apagar = await app.inject({
      method: 'DELETE',
      url: `/api/v1/orcamentos/${mercado}`,
      headers: ana.autorizacao,
    });
    expect(apagar.statusCode).toBe(404);
    expect(await listar(bruno.autorizacao)).toHaveLength(1);
  });

  it('o gasto comparado é o da pessoa, não o do grupo', async () => {
    const ana = await criarConta(app, { email: 'ana@exemplo.com', nome: 'Ana Lima' });
    const convite = await app.inject({
      method: 'POST',
      url: '/api/v1/household/convites',
      headers: ana.autorizacao,
      payload: {},
    });
    const bruno = await criarConta(app, {
      email: 'bruno@exemplo.com',
      nome: 'Bruno Dias',
      codigoConvite: convite.json<{ codigo: string }>().codigo,
    });
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/eu',
      headers: bruno.autorizacao,
      payload: { compartilhaGastos: true },
    });

    const mercado = await idDaCategoria(ana.sessao.usuario.householdId, 'Mercado');
    await definir(ana.autorizacao, mercado, 80000);
    await lancar(ana.autorizacao, mercado, 20000);
    // O Bruno compartilha, então a Ana VÊ este gasto no resumo — mas ele não
    // pode consumir o teto dela.
    await lancar(bruno.autorizacao, mercado, 50000);

    const [item] = await listar(ana.autorizacao);
    expect(item?.gastoCentavos, 'só os 20.000 da Ana').toBe(20000);
  });
});
