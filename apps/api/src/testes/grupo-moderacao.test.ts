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

async function convidar(headers: Cabecalho): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/household/convites',
    headers,
    payload: {},
  });
  expect(resposta.statusCode).toBe(201);
  return resposta.json<{ codigo: string }>().codigo;
}

async function membros(headers: Cabecalho): Promise<Usuario[]> {
  const resposta = await app.inject({
    method: 'GET',
    url: '/api/v1/household/membros',
    headers,
  });
  return resposta.json<{ itens: Usuario[] }>().itens;
}

async function lancarGasto(headers: Cabecalho, descricao: string): Promise<void> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/gastos',
    headers,
    payload: { descricao, valorCentavos: 5000, data: '2026-07-10' },
  });
  expect(resposta.statusCode).toBe(201);
}

/** Grupo com dona (admin) e mais duas pessoas que entraram pelo código dela. */
async function grupoDeTres(): Promise<{
  dona: Cabecalho;
  filha: Cabecalho;
  neto: Cabecalho;
  donaId: string;
  filhaId: string;
}> {
  const dona = await criarConta(app, { nome: 'Ivonete Souza', email: 'ivonete@exemplo.com' });
  const codigo = await convidar(dona.autorizacao);
  const filha = await criarConta(app, {
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    codigoConvite: codigo,
  });
  const neto = await criarConta(app, {
    nome: 'Caio Souza',
    email: 'caio@exemplo.com',
    codigoConvite: codigo,
  });
  return {
    dona: dona.autorizacao,
    filha: filha.autorizacao,
    neto: neto.autorizacao,
    donaId: dona.sessao.usuario.id,
    filhaId: filha.sessao.usuario.id,
  };
}

describe('quem convida modera', () => {
  it('quem gerou o código vira moderador quando alguém entra por ele', async () => {
    const dona = await criarConta(app, { nome: 'Ivonete Souza', email: 'ivonete@exemplo.com' });
    const codigo = await convidar(dona.autorizacao);

    // A pessoa que entra é membro comum...
    const filha = await criarConta(app, {
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      codigoConvite: codigo,
    });
    expect(filha.sessao.usuario.papel).toBe('MEMBRO');

    // ...e quem convidou aparece como moderadora.
    const lista = await membros(dona.autorizacao);
    expect(lista.find((m) => m.email === 'ivonete@exemplo.com')?.papel).toBe('ADMIN');
  });

  it('um membro comum que convida também vira moderador', async () => {
    const { filha, neto } = await grupoDeTres();

    // A filha entrou como MEMBRO; ao convidar alguém de fora, passa a moderar.
    const codigoDaFilha = await convidar(filha);
    await criarConta(app, {
      nome: 'Zé Lima',
      email: 'ze@exemplo.com',
      codigoConvite: codigoDaFilha,
    });

    const lista = await membros(neto);
    expect(lista.find((m) => m.email === 'ana@exemplo.com')?.papel).toBe('ADMIN');
  });

  it('o código do próprio grupo diz quem o gerou, em vez de só recusar', async () => {
    const { dona, filha } = await grupoDeTres();
    const codigo = await convidar(dona);

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/household/entrar',
      headers: filha,
      payload: { codigo },
    });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json<{ erro: { mensagem: string } }>().erro.mensagem).toContain('Ivonete');
  });
});

describe('remover do grupo', () => {
  it('moderador tira alguém, e a pessoa leva os próprios lançamentos', async () => {
    const { dona, filha, filhaId } = await grupoDeTres();
    await lancarGasto(filha, 'Farmácia da Ana');

    const resposta = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/membros/${filhaId}`,
      headers: dona,
    });
    expect(resposta.statusCode).toBe(200);

    // Saiu da lista do grupo antigo...
    expect((await membros(dona)).map((m) => m.email)).not.toContain('ana@exemplo.com');

    // ...e continua com o gasto dela, agora num grupo só seu.
    const dela = await app.inject({ method: 'GET', url: '/api/v1/gastos', headers: filha });
    expect(dela.json<ListaDeGastos>().itens.map((g) => g.descricao)).toEqual(['Farmácia da Ana']);
    expect((await membros(filha)).map((m) => m.email)).toEqual(['ana@exemplo.com']);
  });

  it('membro comum não pode remover ninguém', async () => {
    const { neto, filhaId } = await grupoDeTres();
    const resposta = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/membros/${filhaId}`,
      headers: neto,
    });
    expect(resposta.statusCode).toBe(403);
  });

  it('moderador não se remove por engano — é mandado para "sair do grupo"', async () => {
    const { dona, donaId } = await grupoDeTres();
    const resposta = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/membros/${donaId}`,
      headers: dona,
    });
    expect(resposta.statusCode).toBe(400);
  });

  it('não alcança quem é de outra família', async () => {
    const { dona } = await grupoDeTres();
    const estranho = await criarConta(app, { email: 'estranho@exemplo.com' });

    const resposta = await app.inject({
      method: 'DELETE',
      url: `/api/v1/household/membros/${estranho.sessao.usuario.id}`,
      headers: dona,
    });
    expect(resposta.statusCode).toBe(404);
  });
});

describe('sair do grupo', () => {
  it('membro sai sozinho e leva os lançamentos dele', async () => {
    const { dona, filha } = await grupoDeTres();
    await lancarGasto(filha, 'Farmácia da Ana');

    const resposta = await app.inject({ method: 'POST', url: '/api/v1/household/sair', headers: filha });
    expect(resposta.statusCode).toBe(200);

    const agora = resposta.json<Usuario>();
    expect(agora.papel).toBe('ADMIN');
    expect((await membros(dona)).map((m) => m.email)).not.toContain('ana@exemplo.com');

    const dela = await app.inject({ method: 'GET', url: '/api/v1/gastos', headers: filha });
    expect(dela.json<ListaDeGastos>().itens.map((g) => g.descricao)).toEqual(['Farmácia da Ana']);
  });

  it('quando a única moderadora sai, alguém do grupo assume', async () => {
    const { dona, filha, neto } = await grupoDeTres();
    // Só a dona modera: filha e neto entraram pelo código dela.
    expect((await membros(dona)).filter((m) => m.papel === 'ADMIN')).toHaveLength(1);

    const saiu = await app.inject({ method: 'POST', url: '/api/v1/household/sair', headers: dona });
    expect(saiu.statusCode).toBe(200);

    // O grupo não pode ficar sem ninguém para administrar.
    const restantes = await membros(filha);
    expect(restantes).toHaveLength(2);
    expect(restantes.filter((m) => m.papel === 'ADMIN').length).toBeGreaterThanOrEqual(1);

    const pelaVisaoDoNeto = await membros(neto);
    expect(pelaVisaoDoNeto.filter((m) => m.papel === 'ADMIN').length).toBeGreaterThanOrEqual(1);
  });

  it('sozinho no grupo não há de quem sair', async () => {
    const { autorizacao } = await criarConta(app);
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/household/sair',
      headers: autorizacao,
    });
    expect(resposta.statusCode).toBe(409);
  });
});
