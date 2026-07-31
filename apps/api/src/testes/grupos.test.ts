import type { ListaDeGastos, Usuario } from '@gastos/core';
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

type Cabecalho = { authorization: string };

interface GrupoNaLista {
  id: string;
  nome: string;
  papel: 'ADMIN' | 'MEMBRO';
  ativo: boolean;
  souDono: boolean;
  totalMembros: number;
  totalGastos: number;
  codigos: Array<{ codigo: string; expiraEm: string }>;
}

async function grupos(headers: Cabecalho): Promise<GrupoNaLista[]> {
  const resposta = await app.inject({ method: 'GET', url: '/api/v1/household/grupos', headers });
  expect(resposta.statusCode).toBe(200);
  return resposta.json<{ itens: GrupoNaLista[] }>().itens;
}

async function criarGrupo(headers: Cabecalho, nome: string): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/household/nova',
    headers,
    payload: { nome },
  });
  expect(resposta.statusCode).toBe(201);
  return resposta.json<Usuario>().householdId;
}

async function lancarGasto(headers: Cabecalho, descricao: string): Promise<void> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/gastos',
    headers,
    payload: { descricao, valorCentavos: 3000, data: '2026-07-10' },
  });
  expect(resposta.statusCode).toBe(201);
}

describe('meus grupos', () => {
  it('lista os grupos da pessoa, marcando o que está em uso', async () => {
    const { autorizacao } = await criarConta(app, { nome: 'Ivonete Souza' });
    const casaDaPraia = await criarGrupo(autorizacao, 'Casa da praia');

    const lista = await grupos(autorizacao);
    expect(lista).toHaveLength(2);
    expect(lista.map((g) => g.nome).sort()).toEqual(['Casa da praia', 'Família de Ivonete']);

    const ativo = lista.find((g) => g.ativo);
    expect(ativo?.id).toBe(casaDaPraia);
    expect(lista.every((g) => g.papel === 'ADMIN' && g.souDono)).toBe(true);
  });

  it('cada grupo guarda os próprios gastos, e alternar troca o que se vê', async () => {
    const { autorizacao } = await criarConta(app);
    const primeiro = (await grupos(autorizacao))[0]!.id;
    await lancarGasto(autorizacao, 'Mercado de casa');

    const praia = await criarGrupo(autorizacao, 'Casa da praia');
    await lancarGasto(autorizacao, 'Peixe na praia');

    const naPraia = await app.inject({ method: 'GET', url: '/api/v1/gastos', headers: autorizacao });
    expect(naPraia.json<ListaDeGastos>().itens.map((g) => g.descricao)).toEqual(['Peixe na praia']);

    const voltou = await app.inject({
      method: 'POST',
      url: `/api/v1/household/grupos/${primeiro}/ativar`,
      headers: autorizacao,
    });
    expect(voltou.statusCode).toBe(200);
    expect(voltou.json<Usuario>().householdId).toBe(primeiro);

    const emCasa = await app.inject({ method: 'GET', url: '/api/v1/gastos', headers: autorizacao });
    expect(emCasa.json<ListaDeGastos>().itens.map((g) => g.descricao)).toEqual(['Mercado de casa']);

    // Os totais de cada grupo aparecem na tela de gerenciar.
    const lista = await grupos(autorizacao);
    expect(lista.find((g) => g.id === praia)?.totalGastos).toBe(1);
    expect(lista.find((g) => g.id === primeiro)?.totalGastos).toBe(1);
  });

  it('trocar de grupo não desmancha a categoria do que já foi lançado', async () => {
    // Regressão: quando mudar de grupo levava os lançamentos junto, o gasto
    // ficava apontando para a categoria da casa antiga. A lista de Gastos
    // disfarçava, mas o Resumo mostrava tudo como "Sem categoria".
    const { autorizacao } = await criarConta(app);
    const casa = (await grupos(autorizacao))[0]!.id;

    const categorias = await app.inject({
      method: 'GET',
      url: '/api/v1/categorias',
      headers: autorizacao,
    });
    const mercado = categorias
      .json<{ itens: Array<{ id: string; nome: string }> }>()
      .itens.find((c) => c.nome === 'Mercado')!;

    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: {
        descricao: 'Feira',
        valorCentavos: 7000,
        data: '2026-07-10',
        categoriaId: mercado.id,
      },
    });

    await criarGrupo(autorizacao, 'Casa da praia');
    await app.inject({
      method: 'POST',
      url: `/api/v1/household/grupos/${casa}/ativar`,
      headers: autorizacao,
    });

    const resumo = await app.inject({
      method: 'GET',
      url: '/api/v1/resumos/mensal?ano=2026&mes=7',
      headers: autorizacao,
    });
    const porCategoria = resumo.json<{
      porCategoria: Array<{ categoria: { nome: string } | null; totalCentavos: number }>;
    }>().porCategoria;
    expect(porCategoria).toHaveLength(1);
    expect(porCategoria[0]?.categoria?.nome).toBe('Mercado');

    // E a etiqueta continua sendo do grupo onde o gasto está.
    const gasto = await prisma.gasto.findFirstOrThrow({
      where: { descricao: 'Feira' },
      include: { categoria: true },
    });
    expect(gasto.categoria?.householdId).toBe(gasto.householdId);
  });

  it('mostra os códigos ativos de cada grupo que a pessoa administra', async () => {
    const { autorizacao } = await criarConta(app);
    const casa = (await grupos(autorizacao))[0]!.id;

    for (let i = 0; i < 2; i += 1) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/household/convites',
        headers: autorizacao,
        payload: {},
      });
      expect(r.statusCode).toBe(201);
    }

    // Vários códigos valem ao mesmo tempo para o mesmo grupo.
    const lista = await grupos(autorizacao);
    expect(lista.find((g) => g.id === casa)?.codigos).toHaveLength(2);
  });

  it('não entrega o código de um grupo em que a pessoa é só membro', async () => {
    const dona = await criarConta(app, { email: 'dona@exemplo.com' });
    const convite = await app.inject({
      method: 'POST',
      url: '/api/v1/household/convites',
      headers: dona.autorizacao,
      payload: {},
    });
    const codigo = convite.json<{ codigo: string }>().codigo;

    const membro = await criarConta(app, { email: 'membro@exemplo.com', codigoConvite: codigo });
    const lista = await grupos(membro.autorizacao);
    const daFamilia = lista.find((g) => g.papel === 'MEMBRO');
    expect(daFamilia?.codigos).toEqual([]);
  });

  it('não deixa ativar grupo de que não se participa', async () => {
    const alheio = await criarConta(app, { email: 'alheio@exemplo.com' });
    const { autorizacao } = await criarConta(app, { email: 'eu@exemplo.com' });

    const resposta = await app.inject({
      method: 'POST',
      url: `/api/v1/household/grupos/${alheio.sessao.usuario.householdId}/ativar`,
      headers: autorizacao,
    });
    expect(resposta.statusCode).toBe(403);
  });
});

describe('apagar grupo', () => {
  it('apaga o grupo vazio e leva junto os lançamentos dele', async () => {
    const { autorizacao } = await criarConta(app);
    const casa = (await grupos(autorizacao))[0]!.id;
    const praia = await criarGrupo(autorizacao, 'Casa da praia');
    await lancarGasto(autorizacao, 'Peixe na praia');

    const resposta = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/grupos/${praia}`,
      headers: autorizacao,
    });
    expect(resposta.statusCode).toBe(200);
    // Quem apaga o grupo ativo cai no outro grupo que já tinha.
    expect(resposta.json<Usuario>().householdId).toBe(casa);

    expect(await grupos(autorizacao)).toHaveLength(1);
    expect(await prisma.household.count({ where: { id: praia } })).toBe(0);
    expect(await prisma.gasto.count({ where: { householdId: praia } })).toBe(0);
  });

  it('recusa apagar grupo com outras pessoas dentro', async () => {
    const dona = await criarConta(app, { nome: 'Ivonete Souza', email: 'dona@exemplo.com' });
    await criarGrupo(dona.autorizacao, 'Casa da praia');

    // Volta para o grupo da família e convida alguém.
    const familia = (await grupos(dona.autorizacao)).find((g) => !g.ativo)!.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/household/grupos/${familia}/ativar`,
      headers: dona.autorizacao,
    });
    const convite = await app.inject({
      method: 'POST',
      url: '/api/v1/household/convites',
      headers: dona.autorizacao,
      payload: {},
    });
    await criarConta(app, {
      email: 'filha@exemplo.com',
      codigoConvite: convite.json<{ codigo: string }>().codigo,
    });

    const resposta = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/grupos/${familia}`,
      headers: dona.autorizacao,
    });
    expect(resposta.statusCode).toBe(409);
    expect(await prisma.household.count({ where: { id: familia } })).toBe(1);
  });

  it('membro comum não apaga o grupo', async () => {
    const dona = await criarConta(app, { email: 'dona@exemplo.com' });
    const convite = await app.inject({
      method: 'POST',
      url: '/api/v1/household/convites',
      headers: dona.autorizacao,
      payload: {},
    });
    const membro = await criarConta(app, {
      email: 'membro@exemplo.com',
      codigoConvite: convite.json<{ codigo: string }>().codigo,
    });

    const resposta = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/grupos/${membro.sessao.usuario.householdId}`,
      headers: membro.autorizacao,
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('não deixa apagar o único grupo que a pessoa tem', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const resposta = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/grupos/${sessao.usuario.householdId}`,
      headers: autorizacao,
    });
    expect(resposta.statusCode).toBe(409);
  });
});
