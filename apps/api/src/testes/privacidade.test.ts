import type { ListaDeGastos, Meta, ResumoMensal, Usuario } from '@gastos/core';
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

/** Duas pessoas no mesmo grupo, cada uma com um gasto. */
async function grupoComDuasPessoas(): Promise<{
  ana: Awaited<ReturnType<typeof criarConta>>;
  bruno: Awaited<ReturnType<typeof criarConta>>;
}> {
  const ana = await criarConta(app, { email: 'ana@exemplo.com', nome: 'Ana Lima' });
  const codigo = (
    await app.inject({
      method: 'POST',
      url: '/api/v1/household/convites',
      headers: ana.autorizacao,
      payload: {},
    })
  ).json<{ codigo: string }>().codigo;

  const bruno = await criarConta(app, {
    email: 'bruno@exemplo.com',
    nome: 'Bruno Dias',
    codigoConvite: codigo,
  });

  await app.inject({
    method: 'POST',
    url: '/api/v1/gastos',
    headers: ana.autorizacao,
    payload: { descricao: 'Mercado da Ana', valorCentavos: 10000, data: '2026-03-10' },
  });
  await app.inject({
    method: 'POST',
    url: '/api/v1/gastos',
    headers: bruno.autorizacao,
    payload: { descricao: 'Farmácia do Bruno', valorCentavos: 5000, data: '2026-03-11' },
  });

  return { ana, bruno };
}

const listar = (headers: { authorization: string }): Promise<ListaDeGastos> =>
  app
    .inject({ method: 'GET', url: '/api/v1/gastos', headers })
    .then((r) => r.json<ListaDeGastos>());

describe('privacidade dos lançamentos', () => {
  it('por padrão cada pessoa só vê o que é dela', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();

    const daAna = await listar(ana.autorizacao);
    expect(daAna.itens).toHaveLength(1);
    expect(daAna.itens[0]?.descricao).toBe('Mercado da Ana');
    // O total também: senão o valor do outro vazaria pela soma.
    expect(daAna.totalCentavos).toBe(10000);

    const doBruno = await listar(bruno.autorizacao);
    expect(doBruno.itens).toHaveLength(1);
    expect(doBruno.itens[0]?.descricao).toBe('Farmácia do Bruno');
    expect(doBruno.totalCentavos).toBe(5000);
  });

  it('ligar o compartilhamento revela os próprios gastos para o grupo', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();

    await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/eu',
      headers: bruno.autorizacao,
      payload: { compartilhaGastos: true },
    });

    // Ana passa a ver os dois...
    const daAna = await listar(ana.autorizacao);
    expect(daAna.itens).toHaveLength(2);
    expect(daAna.totalCentavos).toBe(15000);

    // ...mas Bruno continua vendo só o dele, porque Ana não compartilhou.
    const doBruno = await listar(bruno.autorizacao);
    expect(doBruno.itens).toHaveLength(1);
  });

  it('desligar de volta esconde outra vez', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();
    const alternar = (compartilhaGastos: boolean) =>
      app.inject({
        method: 'PATCH',
        url: '/api/v1/auth/eu',
        headers: bruno.autorizacao,
        payload: { compartilhaGastos },
      });

    await alternar(true);
    expect((await listar(ana.autorizacao)).itens).toHaveLength(2);

    await alternar(false);
    expect((await listar(ana.autorizacao)).itens).toHaveLength(1);
  });

  it('não entrega o gasto do outro nem pedindo pelo id direto', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();
    const doBruno = await listar(bruno.autorizacao);
    const id = doBruno.itens[0]?.id ?? '';

    const tentativa = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${id}`,
      headers: ana.autorizacao,
    });
    expect(tentativa.statusCode).toBe(404);
  });

  it('a busca e o autocompletar não vazam onde o outro gastou', async () => {
    const { ana } = await grupoComDuasPessoas();

    const busca = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos?busca=Farm',
      headers: ana.autorizacao,
    });
    expect(busca.json<ListaDeGastos>().itens).toHaveLength(0);

    const sugestoes = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos/sugestoes?termo=Farm',
      headers: ana.autorizacao,
    });
    expect(sugestoes.json<{ descricoes: string[] }>().descricoes).toEqual([]);
  });

  it('a exportação leva só o que a pessoa pode ver', async () => {
    const { ana } = await grupoComDuasPessoas();

    const arquivo = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos/exportar?formato=csv',
      headers: ana.autorizacao,
    });

    const texto = arquivo.rawPayload.toString('utf8');
    expect(texto).toContain('Mercado da Ana');
    expect(texto).not.toContain('Farmácia do Bruno');
  });

  it('o resumo do mês não soma quem não compartilha', async () => {
    const { ana } = await grupoComDuasPessoas();

    const resumo = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/resumos/mensal?ano=2026&mes=3',
        headers: ana.autorizacao,
      })
    ).json<ResumoMensal>();

    expect(resumo.totalCentavos).toBe(10000);
    expect(resumo.porPessoa).toHaveLength(1);
    expect(resumo.porPessoa[0]?.usuario.nome).toBe('Ana Lima');
  });

  it('quem está no grupo continua visível como pessoa', async () => {
    const { ana } = await grupoComDuasPessoas();

    // A privacidade é do dinheiro, não das pessoas: o Hub mostra quem está lá.
    const membros = await app.inject({
      method: 'GET',
      url: '/api/v1/household/membros',
      headers: ana.autorizacao,
    });
    const itens = membros.json<{ itens: Usuario[] }>().itens;
    expect(itens).toHaveLength(2);
    expect(itens.map((m) => m.nome).sort()).toEqual(['Ana Lima', 'Bruno Dias']);
    // E dá para saber quem compartilha, para a tela explicar o que está vendo.
    expect(itens.every((m) => m.compartilhaGastos === false)).toBe(true);
  });
});

describe('grupos', () => {
  it('cria um grupo novo levando os próprios lançamentos', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/household/nova',
      headers: bruno.autorizacao,
      payload: { nome: 'Casa do Bruno' },
    });
    expect(resposta.statusCode).toBe(201);

    const novo = resposta.json<Usuario>();
    expect(novo.householdId).not.toBe(ana.sessao.usuario.householdId);
    expect(novo.papel).toBe('ADMIN');

    // O gasto do Bruno foi junto; o da Ana ficou onde estava.
    const doBruno = await listar(bruno.autorizacao);
    expect(doBruno.itens).toHaveLength(1);
    expect(doBruno.itens[0]?.descricao).toBe('Farmácia do Bruno');

    const daAna = await listar(ana.autorizacao);
    expect(daAna.itens[0]?.descricao).toBe('Mercado da Ana');

    // O grupo novo nasce com as categorias padrão.
    const categorias = await prisma.categoria.count({ where: { householdId: novo.householdId } });
    expect(categorias).toBe(9);
  });

  it('entrar em outro grupo leva os próprios lançamentos junto', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();

    // Bruno sai para um grupo só dele e depois volta para o da Ana.
    await app.inject({
      method: 'POST',
      url: '/api/v1/household/nova',
      headers: bruno.autorizacao,
      payload: { nome: 'Casa do Bruno' },
    });

    const codigo = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/household/convites',
        headers: ana.autorizacao,
        payload: {},
      })
    ).json<{ codigo: string }>().codigo;

    const volta = await app.inject({
      method: 'POST',
      url: '/api/v1/household/entrar',
      headers: bruno.autorizacao,
      payload: { codigo },
    });

    expect(volta.statusCode).toBe(200);
    expect(volta.json<Usuario>().householdId).toBe(ana.sessao.usuario.householdId);

    const doBruno = await listar(bruno.autorizacao);
    expect(doBruno.itens).toHaveLength(1);
  });
});

describe('metas conjuntas', () => {
  it('todo mundo do grupo vê as metas', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();

    const criada = await app.inject({
      method: 'POST',
      url: '/api/v1/household/metas',
      headers: ana.autorizacao,
      payload: { nome: 'Viagem de férias', valorAlvoCentavos: 500000 },
    });
    expect(criada.statusCode).toBe(201);
    expect(criada.json<Meta>().criadoPor.nome).toBe('Ana Lima');

    // Meta é o único dado financeiro combinado — aparece para os dois.
    const doBruno = await app.inject({
      method: 'GET',
      url: '/api/v1/household/metas',
      headers: bruno.autorizacao,
    });
    expect(doBruno.json<{ itens: Meta[] }>().itens).toHaveLength(1);
  });

  it('meta de outro grupo não aparece', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();
    await app.inject({
      method: 'POST',
      url: '/api/v1/household/metas',
      headers: ana.autorizacao,
      payload: { nome: 'Viagem de férias' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/household/nova',
      headers: bruno.autorizacao,
      payload: { nome: 'Casa do Bruno' },
    });

    const doBruno = await app.inject({
      method: 'GET',
      url: '/api/v1/household/metas',
      headers: bruno.autorizacao,
    });
    expect(doBruno.json<{ itens: Meta[] }>().itens).toEqual([]);
  });
});
