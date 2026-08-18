import type { Sessao } from '@gastos/core';
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

const EMAIL = 'maria@exemplo.com';

async function pedirCodigo(email = EMAIL): Promise<number> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/esqueci-senha',
    payload: { email },
  });
  return resposta.statusCode;
}

/**
 * O código só existe com hash no banco — como senha. Para testar, forçamos um
 * conhecido no lugar do que foi sorteado.
 */
async function plantarCodigo(codigo: string, expiraEm = new Date(Date.now() + 600_000)) {
  const { gerarHashSenha } = await import('../servicos/senha.js');
  const pedido = await prisma.pedidoDeSenha.findFirstOrThrow({ orderBy: { criadoEm: 'desc' } });
  await prisma.pedidoDeSenha.update({
    where: { id: pedido.id },
    data: { codigoHash: await gerarHashSenha(codigo), expiraEm },
  });
  return pedido.id;
}

function redefinir(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/v1/auth/redefinir-senha', payload });
}

function entrar(senha: string) {
  return app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: EMAIL, senha } });
}

describe('esqueci minha senha', () => {
  it('troca a senha com o código e já devolve a sessão', async () => {
    await criarConta(app, { email: EMAIL });
    expect(await pedirCodigo()).toBe(204);
    await plantarCodigo('123456');

    const resposta = await redefinir({ email: EMAIL, codigo: '123456', novaSenha: 'nova-senha-999' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json<Sessao>().usuario.email).toBe(EMAIL);

    expect((await entrar('nova-senha-999')).statusCode).toBe(200);
    expect((await entrar('senha-forte-123')).statusCode).toBe(401);
  });

  it('não conta quem tem conta: e-mail desconhecido responde igual', async () => {
    expect(await pedirCodigo('ninguem@exemplo.com')).toBe(204);
    expect(await prisma.pedidoDeSenha.count()).toBe(0);
  });

  it('o código serve uma vez só', async () => {
    await criarConta(app, { email: EMAIL });
    await pedirCodigo();
    await plantarCodigo('123456');

    expect((await redefinir({ email: EMAIL, codigo: '123456', novaSenha: 'nova-senha-999' })).statusCode).toBe(200);
    const repetido = await redefinir({ email: EMAIL, codigo: '123456', novaSenha: 'outra-senha-999' });
    expect(repetido.statusCode).toBe(400);
    // A segunda tentativa não trocou nada.
    expect((await entrar('nova-senha-999')).statusCode).toBe(200);
  });

  it('código expirado não vale', async () => {
    await criarConta(app, { email: EMAIL });
    await pedirCodigo();
    await plantarCodigo('123456', new Date(Date.now() - 60_000));

    expect((await redefinir({ email: EMAIL, codigo: '123456', novaSenha: 'nova-senha-999' })).statusCode).toBe(400);
    expect((await entrar('senha-forte-123')).statusCode).toBe(200);
  });

  it('força bruta queima o código depois de 5 erros', async () => {
    await criarConta(app, { email: EMAIL });
    await pedirCodigo();
    await plantarCodigo('123456');

    for (let i = 0; i < 5; i += 1) {
      expect((await redefinir({ email: EMAIL, codigo: '000000', novaSenha: 'nova-senha-999' })).statusCode).toBe(400);
    }
    // Agora nem o código certo passa: o pedido foi queimado.
    expect((await redefinir({ email: EMAIL, codigo: '123456', novaSenha: 'nova-senha-999' })).statusCode).toBe(400);
    expect((await entrar('senha-forte-123')).statusCode).toBe(200);
  });

  it('pedir de novo invalida o código anterior', async () => {
    await criarConta(app, { email: EMAIL });
    await pedirCodigo();
    await plantarCodigo('111111');
    await pedirCodigo();
    await plantarCodigo('222222');

    expect(await prisma.pedidoDeSenha.count()).toBe(1);
    expect((await redefinir({ email: EMAIL, codigo: '111111', novaSenha: 'nova-senha-999' })).statusCode).toBe(400);
    expect((await redefinir({ email: EMAIL, codigo: '222222', novaSenha: 'nova-senha-999' })).statusCode).toBe(200);
  });

  it('o código nunca é guardado em texto puro', async () => {
    await criarConta(app, { email: EMAIL });
    await pedirCodigo();
    const pedido = await prisma.pedidoDeSenha.findFirstOrThrow();
    expect(pedido.codigoHash).toMatch(/^scrypt\$/);
    expect(pedido.codigoHash).not.toMatch(/^\d{6}$/);
  });
});
