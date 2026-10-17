import type { Meta } from '@gastos/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { criarConta, limparBanco, novoServidor } from './ajuda.js';

/**
 * Metas: as da família e as de cada um.
 *
 * A pessoal não é "uma meta do grupo que ninguém vê": ela não pertence a grupo
 * nenhum, e é isso que a faz seguir a pessoa quando ela troca de grupo.
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

const criarMeta = (headers: { authorization: string }, dados: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/v1/household/metas', headers, payload: dados });

const listarMetas = (headers: { authorization: string }) =>
  app
    .inject({ method: 'GET', url: '/api/v1/household/metas', headers })
    .then((r) => r.json<{ itens: Meta[] }>().itens);

/** Ana cria o grupo; Bruno entra nele. */
async function duasPessoasNoMesmoGrupo() {
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
  return { ana, bruno };
}

describe('meta da família', () => {
  it('aparece para todo mundo do grupo', async () => {
    const { ana, bruno } = await duasPessoasNoMesmoGrupo();
    await criarMeta(ana.autorizacao, { nome: 'Viagem de férias', valorAlvoCentavos: 500000 });

    const doBruno = await listarMetas(bruno.autorizacao);
    expect(doBruno).toHaveLength(1);
    expect(doBruno[0]?.nome).toBe('Viagem de férias');
    expect(doBruno[0]?.pessoal).toBe(false);
  });
});

describe('meta pessoal', () => {
  it('não aparece para mais ninguém do grupo', async () => {
    const { ana, bruno } = await duasPessoasNoMesmoGrupo();
    const criada = await criarMeta(bruno.autorizacao, { nome: 'Comprar uma bike', pessoal: true });
    expect(criada.statusCode).toBe(201);
    expect(criada.json<Meta>().pessoal).toBe(true);

    expect(await listarMetas(ana.autorizacao), 'a meta do Bruno é só dele').toHaveLength(0);
    expect(await listarMetas(bruno.autorizacao)).toHaveLength(1);
  });

  it('nem quem administra o grupo pode apagar a pessoal de outra pessoa', async () => {
    const { ana, bruno } = await duasPessoasNoMesmoGrupo();
    // A Ana criou o grupo, então ela administra.
    const criada = await criarMeta(bruno.autorizacao, { nome: 'Comprar uma bike', pessoal: true });
    const id = criada.json<Meta>().id;

    const tentativa = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/metas/${id}`,
      headers: ana.autorizacao,
    });
    expect(tentativa.statusCode, 'administrar o grupo não dá poder sobre o que é de alguém').toBe(
      404,
    );
    expect(await listarMetas(bruno.autorizacao)).toHaveLength(1);

    // O dono apaga a dele normalmente.
    const doDono = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/metas/${id}`,
      headers: bruno.autorizacao,
    });
    expect(doDono.statusCode).toBe(204);
  });

  it('quem administra continua podendo moderar a meta DO GRUPO', async () => {
    const { ana, bruno } = await duasPessoasNoMesmoGrupo();
    const criada = await criarMeta(bruno.autorizacao, { nome: 'Churrasco', pessoal: false });

    const moderada = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/metas/${criada.json<Meta>().id}`,
      headers: ana.autorizacao,
    });
    expect(moderada.statusCode).toBe(204);
  });

  it('segue com a pessoa quando ela troca de grupo', async () => {
    // É o motivo de ela não ter grupo: amarrada a um, sumiria aqui.
    const { bruno } = await duasPessoasNoMesmoGrupo();
    await criarMeta(bruno.autorizacao, { nome: 'Comprar uma bike', pessoal: true });

    const novo = await app.inject({
      method: 'POST',
      url: '/api/v1/household/nova',
      headers: bruno.autorizacao,
      payload: { nome: 'Só meu', moeda: 'BRL' },
    });
    expect(novo.statusCode).toBe(201);

    const depoisDaTroca = await listarMetas(bruno.autorizacao);
    expect(depoisDaTroca.map((m) => m.nome)).toEqual(['Comprar uma bike']);
    expect(depoisDaTroca[0]?.pessoal).toBe(true);
  });

  it('apagar o grupo leva as metas dele e deixa a pessoal', async () => {
    // Pelo caminho de verdade: a Ana sozinha no grupo dela, que ela apaga
    // depois de criar outro. Quem apaga é a rota, não o teste.
    const ana = await criarConta(app, { email: 'ana@exemplo.com', nome: 'Ana Lima' });
    const primeiroGrupo = ana.sessao.usuario.householdId;
    await criarMeta(ana.autorizacao, { nome: 'Comprar uma bike', pessoal: true });
    await criarMeta(ana.autorizacao, { nome: 'Churrasco do grupo', pessoal: false });

    await app.inject({
      method: 'POST',
      url: '/api/v1/household/nova',
      headers: ana.autorizacao,
      payload: { nome: 'Só meu', moeda: 'BRL' },
    });
    const apagado = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/grupos/${primeiroGrupo}`,
      headers: ana.autorizacao,
    });
    // 200 e não 204: apagar o grupo ativo troca o grupo em uso, e a rota
    // devolve o usuário já no outro.
    expect(apagado.statusCode).toBe(200);

    expect(await prisma.meta.count({ where: { householdId: primeiroGrupo } })).toBe(0);
    expect((await listarMetas(ana.autorizacao)).map((m) => m.nome)).toEqual(['Comprar uma bike']);
  });

  it('vem antes da meta do grupo na lista', async () => {
    // O Postgres joga nulo para o fim num `asc` comum, e meta pessoal É nulo:
    // sem o `nulls: 'first'` a ordem sai invertida.
    const { bruno } = await duasPessoasNoMesmoGrupo();
    await criarMeta(bruno.autorizacao, { nome: 'Churrasco do grupo', pessoal: false });
    await criarMeta(bruno.autorizacao, { nome: 'Comprar uma bike', pessoal: true });

    expect((await listarMetas(bruno.autorizacao)).map((m) => m.nome)).toEqual([
      'Comprar uma bike',
      'Churrasco do grupo',
    ]);
  });

  it('quem não criou nem administra não apaga a meta do grupo', async () => {
    const { ana, bruno } = await duasPessoasNoMesmoGrupo();
    const criada = await criarMeta(ana.autorizacao, { nome: 'Churrasco', pessoal: false });

    const tentativa = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/metas/${criada.json<Meta>().id}`,
      headers: bruno.autorizacao,
    });
    // 403 e não 404: o Bruno vê a meta do grupo, só não manda nela.
    expect(tentativa.statusCode).toBe(403);
    expect(await listarMetas(ana.autorizacao)).toHaveLength(1);
  });
});
