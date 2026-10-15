import { dataUTC, type ListaDeReceitas, type Receita, type ResumoMensal } from '@gastos/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { gerarPendentes } from '../servicos/recorrencias.js';
import { criarConta, limparBanco, novoServidor } from './ajuda.js';

/**
 * Receitas: o que entra.
 *
 * O que mais importa aqui é a privacidade — salário é tão privado quanto
 * gasto — e o saldo, que é o número pelo qual receita existe neste app.
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

async function categoriaDeReceita(headers: { authorization: string }): Promise<string> {
  const r = await app.inject({
    method: 'GET',
    url: '/api/v1/categorias?tipo=RECEITA',
    headers,
  });
  return r.json<{ itens: Array<{ id: string; nome: string }> }>().itens[0]!.id;
}

const criarReceita = (
  headers: { authorization: string },
  dados: Record<string, unknown> = {},
) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/receitas',
    headers,
    payload: { descricao: 'Salário', valorCentavos: 450000, data: '2026-03-05', ...dados },
  });

describe('registrar receita', () => {
  it('cria e devolve a entrada', async () => {
    const { autorizacao } = await criarConta(app);
    const resposta = await criarReceita(autorizacao);
    expect(resposta.statusCode).toBe(201);

    const receita = resposta.json<Receita>();
    expect(receita.descricao).toBe('Salário');
    expect(receita.valorCentavos).toBe(450000);
    expect(receita.data).toBe('2026-03-05');
  });

  it('recusa categoria de despesa numa receita', async () => {
    const { autorizacao } = await criarConta(app);
    const despesa = await app.inject({
      method: 'GET',
      url: '/api/v1/categorias?tipo=DESPESA',
      headers: autorizacao,
    });
    const categoriaDeGasto = despesa.json<{ itens: Array<{ id: string }> }>().itens[0]!.id;

    const resposta = await criarReceita(autorizacao, { categoriaId: categoriaDeGasto });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.body).toContain('não serve para receita');
  });

  it('aceita categoria de receita', async () => {
    const { autorizacao } = await criarConta(app);
    const resposta = await criarReceita(autorizacao, {
      categoriaId: await categoriaDeReceita(autorizacao),
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json<Receita>().categoria?.tipo).toBe('RECEITA');
  });

  it('lista com total do período', async () => {
    const { autorizacao } = await criarConta(app);
    await criarReceita(autorizacao, { valorCentavos: 450000 });
    await criarReceita(autorizacao, { descricao: 'Freela', valorCentavos: 80000 });

    const lista = await app
      .inject({ method: 'GET', url: '/api/v1/receitas', headers: autorizacao })
      .then((r) => r.json<ListaDeReceitas>());
    expect(lista.itens).toHaveLength(2);
    expect(lista.totalCentavos).toBe(530000);
  });
});

describe('privacidade da receita', () => {
  it('não mostra o salário de quem não compartilha', async () => {
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

    const criada = await criarReceita(bruno.autorizacao, { valorCentavos: 900000 });
    const idDoBruno = criada.json<Receita>().id;

    const listaDaAna = await app
      .inject({ method: 'GET', url: '/api/v1/receitas', headers: ana.autorizacao })
      .then((r) => r.json<ListaDeReceitas>());
    expect(listaDaAna.itens, 'salário é tão privado quanto gasto').toHaveLength(0);
    expect(listaDaAna.totalCentavos).toBe(0);

    // Nem pelo id direto, nem para alterar — a escrita usa o mesmo filtro.
    const porId = await app.inject({
      method: 'GET',
      url: `/api/v1/receitas/${idDoBruno}`,
      headers: ana.autorizacao,
    });
    expect(porId.statusCode).toBe(404);

    const alterar = await app.inject({
      method: 'PATCH',
      url: `/api/v1/receitas/${idDoBruno}`,
      headers: ana.autorizacao,
      payload: { valorCentavos: 1 },
    });
    expect(alterar.statusCode).toBe(404);

    const apagar = await app.inject({
      method: 'DELETE',
      url: `/api/v1/receitas/${idDoBruno}`,
      headers: ana.autorizacao,
    });
    expect(apagar.statusCode).toBe(404);

    // E continua intacta.
    const conferir = await prisma.receita.findUniqueOrThrow({ where: { id: idDoBruno } });
    expect(conferir.valorCentavos).toBe(900000);
  });
});

describe('saldo do mês', () => {
  it('receitas menos despesas, e negativo quando falta', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    await criarReceita(autorizacao, { valorCentavos: 300000, data: '2026-03-05' });
    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: { descricao: 'Mercado', valorCentavos: 100000, data: '2026-03-10' },
    });

    const resumo = await app
      .inject({ method: 'GET', url: '/api/v1/resumos/mensal?ano=2026&mes=3', headers: autorizacao })
      .then((r) => r.json<ResumoMensal>());
    expect(resumo.receitasCentavos).toBe(300000);
    expect(resumo.totalCentavos).toBe(100000);
    expect(resumo.saldoCentavos).toBe(200000);

    // Gastando mais do que entrou, o saldo fica negativo.
    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: { descricao: 'Conserto', valorCentavos: 400000, data: '2026-03-11' },
    });
    const apertado = await app
      .inject({ method: 'GET', url: '/api/v1/resumos/mensal?ano=2026&mes=3', headers: autorizacao })
      .then((r) => r.json<ResumoMensal>());
    expect(apertado.saldoCentavos).toBe(-200000);
    expect(sessao.usuario.householdId).toBeTruthy();
  });

  it('o saldo não enxerga a receita de quem não compartilha', async () => {
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
    await criarReceita(bruno.autorizacao, { valorCentavos: 900000, data: '2026-03-05' });

    const daAna = await app
      .inject({
        method: 'GET',
        url: '/api/v1/resumos/mensal?ano=2026&mes=3',
        headers: ana.autorizacao,
      })
      .then((r) => r.json<ResumoMensal>());
    expect(daAna.receitasCentavos).toBe(0);
    expect(daAna.saldoCentavos).toBe(0);
  });
});

describe('receita fixa (salário)', () => {
  it('o mesmo motor das contas fixas gera receita, não gasto', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const criada = await app.inject({
      method: 'POST',
      url: '/api/v1/recorrencias',
      headers: autorizacao,
      payload: {
        tipo: 'RECEITA',
        descricao: 'Salário',
        valorCentavos: 450000,
        diaDoMes: 5,
        inicioEm: '2026-01-01',
      },
    });
    expect(criada.statusCode).toBe(201);

    await prisma.gasto.deleteMany();
    await prisma.receita.deleteMany();
    await prisma.recorrencia.updateMany({ data: { ultimoMesGerado: null } });

    const resultado = await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 3, 5));
    expect(resultado.receitasCriadas, 'janeiro, fevereiro e março').toBe(3);
    expect(resultado.gastosCriados, 'nenhum gasto: a recorrência é de receita').toBe(0);

    const receitas = await prisma.receita.findMany({ orderBy: { data: 'asc' } });
    expect(receitas.map((r) => r.data.toISOString().slice(0, 10))).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
    ]);
    expect(await prisma.gasto.count()).toBe(0);
  });

  it('a regra de não lançar no futuro também vale para o salário', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    await app.inject({
      method: 'POST',
      url: '/api/v1/recorrencias',
      headers: autorizacao,
      payload: {
        tipo: 'RECEITA',
        descricao: 'Salário',
        valorCentavos: 450000,
        diaDoMes: 20,
        inicioEm: '2026-03-01',
      },
    });
    await prisma.receita.deleteMany();
    await prisma.recorrencia.updateMany({ data: { ultimoMesGerado: null } });

    const antes = await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 3, 1));
    expect(antes.receitasCriadas).toBe(0);

    const noDia = await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 3, 20));
    expect(noDia.receitasCriadas).toBe(1);
  });
});
