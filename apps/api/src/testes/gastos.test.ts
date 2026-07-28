import type { Gasto, ListaDeGastos } from '@gastos/core';
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

async function criarGasto(
  headers: { authorization: string },
  dados: Partial<{
    descricao: string;
    valorCentavos: number;
    data: string;
    categoriaId: string;
    userId: string;
    formaPagamento: string;
  }> = {},
): Promise<Gasto> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/gastos',
    headers,
    payload: {
      descricao: 'Supermercado Bom Preço',
      valorCentavos: 45890,
      data: '2024-03-12',
      ...dados,
    },
  });
  if (resposta.statusCode !== 201) throw new Error(resposta.body);
  return resposta.json<Gasto>();
}

describe('POST /gastos', () => {
  it('cria o gasto atribuído a quem está logado', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const gasto = await criarGasto(autorizacao);

    expect(gasto.valorCentavos).toBe(45890);
    expect(gasto.data).toBe('2024-03-12');
    expect(gasto.usuario.id).toBe(sessao.usuario.id);
    expect(gasto.formaPagamento).toBe('CARTAO');
    expect(gasto.categoria).toBeNull();
  });

  it('guarda o valor exatamente como inteiro em centavos', async () => {
    const { autorizacao } = await criarConta(app);
    await criarGasto(autorizacao, { valorCentavos: 199999 });

    const noBanco = await prisma.gasto.findFirstOrThrow();
    expect(noBanco.valorCentavos).toBe(199999);
    expect(Number.isInteger(noBanco.valorCentavos)).toBe(true);
  });

  it('aceita estorno com valor negativo', async () => {
    const { autorizacao } = await criarConta(app);
    const gasto = await criarGasto(autorizacao, { valorCentavos: -4590, descricao: 'Estorno' });
    expect(gasto.valorCentavos).toBe(-4590);
  });

  it('recusa valor zero e data que não existe', async () => {
    const { autorizacao } = await criarConta(app);

    const valorZero = await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: { descricao: 'Teste', valorCentavos: 0, data: '2024-03-12' },
    });
    expect(valorZero.statusCode).toBe(400);
    expect(
      valorZero.json<{ erro: { campos: Record<string, string> } }>().erro.campos.valorCentavos,
    ).toBe('Informe um valor maior que zero.');

    const dataInvalida = await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: { descricao: 'Teste', valorCentavos: 100, data: '2024-02-30' },
    });
    expect(dataInvalida.statusCode).toBe(400);
    expect(
      dataInvalida.json<{ erro: { campos: Record<string, string> } }>().erro.campos.data,
    ).toBe('Essa data não existe no calendário.');
  });

  it('recusa categoria de outra família', async () => {
    const casaA = await criarConta(app, { email: 'a@exemplo.com' });
    const casaB = await criarConta(app, { email: 'b@exemplo.com', nome: 'João Souza' });
    const categoriaDeB = await idDaCategoria(casaB.sessao.usuario.householdId, 'Mercado');

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: casaA.autorizacao,
      payload: {
        descricao: 'Teste',
        valorCentavos: 1000,
        data: '2024-03-12',
        categoriaId: categoriaDeB,
      },
    });

    expect(resposta.statusCode).toBe(400);
  });
});

describe('GET /gastos', () => {
  it('devolve o total do período inteiro, não só o da página', async () => {
    const { autorizacao } = await criarConta(app);
    await criarGasto(autorizacao, { valorCentavos: 10000, data: '2024-03-01' });
    await criarGasto(autorizacao, { valorCentavos: 20000, data: '2024-03-02' });
    await criarGasto(autorizacao, { valorCentavos: 30050, data: '2024-03-03' });

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos?porPagina=2',
      headers: autorizacao,
    });

    const lista = resposta.json<ListaDeGastos>();
    expect(lista.itens).toHaveLength(2);
    expect(lista.paginacao.totalItens).toBe(3);
    expect(lista.paginacao.totalPaginas).toBe(2);
    expect(lista.totalCentavos).toBe(60050);
  });

  it('filtra por período, pessoa, categoria e busca', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const mercado = await idDaCategoria(sessao.usuario.householdId, 'Mercado');
    await criarGasto(autorizacao, { descricao: 'Padaria', valorCentavos: 1000, data: '2024-02-10' });
    await criarGasto(autorizacao, {
      descricao: 'Supermercado',
      valorCentavos: 5000,
      data: '2024-03-10',
      categoriaId: mercado,
    });

    const porPeriodo = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos?de=2024-03-01&ate=2024-03-31',
      headers: autorizacao,
    });
    expect(porPeriodo.json<ListaDeGastos>().totalCentavos).toBe(5000);

    const porCategoria = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos?categoriaId=${mercado}`,
      headers: autorizacao,
    });
    expect(porCategoria.json<ListaDeGastos>().itens).toHaveLength(1);

    const semCategoria = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos?categoriaId=sem-categoria',
      headers: autorizacao,
    });
    expect(semCategoria.json<ListaDeGastos>().itens[0]?.descricao).toBe('Padaria');

    // Busca ignora maiúsculas/minúsculas.
    const porBusca = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos?busca=super',
      headers: autorizacao,
    });
    expect(porBusca.json<ListaDeGastos>().itens).toHaveLength(1);
  });

  it('inclui os dois extremos do intervalo de datas', async () => {
    const { autorizacao } = await criarConta(app);
    await criarGasto(autorizacao, { valorCentavos: 100, data: '2024-03-01' });
    await criarGasto(autorizacao, { valorCentavos: 200, data: '2024-03-31' });

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos?de=2024-03-01&ate=2024-03-31',
      headers: autorizacao,
    });
    expect(resposta.json<ListaDeGastos>().totalCentavos).toBe(300);
  });

  it('nunca mostra gasto de outra família', async () => {
    const casaA = await criarConta(app, { email: 'a@exemplo.com' });
    const casaB = await criarConta(app, { email: 'b@exemplo.com', nome: 'João Souza' });
    const gastoDeB = await criarGasto(casaB.autorizacao, { descricao: 'Segredo' });

    const lista = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos',
      headers: casaA.autorizacao,
    });
    expect(lista.json<ListaDeGastos>().itens).toHaveLength(0);

    const direto = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${gastoDeB.id}`,
      headers: casaA.autorizacao,
    });
    expect(direto.statusCode).toBe(404);
  });
});

describe('PATCH e DELETE /gastos/:id', () => {
  it('altera apenas os campos enviados', async () => {
    const { autorizacao } = await criarConta(app);
    const gasto = await criarGasto(autorizacao);

    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/v1/gastos/${gasto.id}`,
      headers: autorizacao,
      payload: { valorCentavos: 50000 },
    });

    const atualizado = resposta.json<Gasto>();
    expect(atualizado.valorCentavos).toBe(50000);
    expect(atualizado.descricao).toBe('Supermercado Bom Preço');
  });

  it('exclui e some da lista', async () => {
    const { autorizacao } = await criarConta(app);
    const gasto = await criarGasto(autorizacao);

    const exclusao = await app.inject({
      method: 'DELETE',
      url: `/api/v1/gastos/${gasto.id}`,
      headers: autorizacao,
    });
    expect(exclusao.statusCode).toBe(204);

    const lista = await app.inject({ method: 'GET', url: '/api/v1/gastos', headers: autorizacao });
    expect(lista.json<ListaDeGastos>().itens).toHaveLength(0);
  });

  it('membro não altera gasto de outra pessoa, administrador altera', async () => {
    const admin = await criarConta(app, { email: 'admin@exemplo.com' });
    const convite = await app.inject({
      method: 'POST',
      url: '/api/v1/household/convites',
      headers: admin.autorizacao,
      payload: {},
    });
    const { codigo } = convite.json<{ codigo: string }>();
    const membro = await criarConta(app, {
      email: 'membro@exemplo.com',
      nome: 'João Souza',
      codigoConvite: codigo,
    });

    const gastoDoAdmin = await criarGasto(admin.autorizacao);

    const tentativaDoMembro = await app.inject({
      method: 'PATCH',
      url: `/api/v1/gastos/${gastoDoAdmin.id}`,
      headers: membro.autorizacao,
      payload: { valorCentavos: 1 },
    });
    expect(tentativaDoMembro.statusCode).toBe(403);

    const gastoDoMembro = await criarGasto(membro.autorizacao, { descricao: 'Padaria' });
    const correcaoDoAdmin = await app.inject({
      method: 'PATCH',
      url: `/api/v1/gastos/${gastoDoMembro.id}`,
      headers: admin.autorizacao,
      payload: { descricao: 'Padaria da esquina' },
    });
    expect(correcaoDoAdmin.statusCode).toBe(200);
  });
});

describe('GET /gastos/sugestoes', () => {
  it('sugere descrições já usadas, sem repetir', async () => {
    const { autorizacao } = await criarConta(app);
    await criarGasto(autorizacao, { descricao: 'Padaria da esquina' });
    await criarGasto(autorizacao, { descricao: 'Padaria da esquina' });
    await criarGasto(autorizacao, { descricao: 'Posto Ipiranga' });

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos/sugestoes?termo=pada',
      headers: autorizacao,
    });

    expect(resposta.json<{ descricoes: string[] }>().descricoes).toEqual(['Padaria da esquina']);
  });
});
