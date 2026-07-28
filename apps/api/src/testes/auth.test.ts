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

describe('POST /auth/registrar', () => {
  it('cria o usuário, o household e as 9 categorias padrão', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/registrar',
      payload: { nome: 'Maria Silva', email: 'maria@exemplo.com', senha: 'senha-forte-123' },
    });

    expect(resposta.statusCode).toBe(201);
    const sessao = resposta.json<Sessao>();
    expect(sessao.usuario.papel).toBe('ADMIN');
    expect(sessao.usuario.email).toBe('maria@exemplo.com');
    expect(sessao.accessToken).toBeTruthy();
    expect(sessao.refreshToken).toBeTruthy();
    // A senha nunca volta na resposta.
    expect(JSON.stringify(sessao)).not.toContain('senha');

    const categorias = await prisma.categoria.count({
      where: { householdId: sessao.usuario.householdId },
    });
    expect(categorias).toBe(9);
  });

  it('recusa e-mail repetido com mensagem em português', async () => {
    await criarConta(app);
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/registrar',
      payload: { nome: 'Outra Pessoa', email: 'maria@exemplo.com', senha: 'senha-forte-123' },
    });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({
      erro: { codigo: 'CONFLITO', mensagem: 'Já existe uma conta com esse e-mail.' },
    });
  });

  it('devolve erro por campo quando a validação falha', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/registrar',
      payload: { nome: 'M', email: 'nao-e-email', senha: '123' },
    });

    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json<{ erro: { codigo: string; campos: Record<string, string> } }>();
    expect(corpo.erro.codigo).toBe('VALIDACAO');
    expect(corpo.erro.campos.email).toBe('Esse e-mail não parece válido.');
    expect(corpo.erro.campos.senha).toBe('A senha precisa ter pelo menos 8 caracteres.');
    expect(corpo.erro.campos.nome).toBe('O nome precisa ter pelo menos 2 letras.');
  });

  it('guarda a senha com hash, nunca em texto puro', async () => {
    await criarConta(app, { senha: 'senha-forte-123' });
    const usuario = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@exemplo.com' } });
    expect(usuario.senhaHash).not.toContain('senha-forte-123');
    expect(usuario.senhaHash.startsWith('scrypt$')).toBe(true);
  });
});

describe('POST /auth/login', () => {
  it('entra com as credenciais corretas', async () => {
    await criarConta(app, { senha: 'senha-forte-123' });
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'maria@exemplo.com', senha: 'senha-forte-123' },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json<Sessao>().usuario.nome).toBe('Maria Silva');
  });

  it('dá a mesma resposta para senha errada e e-mail inexistente', async () => {
    await criarConta(app, { senha: 'senha-forte-123' });

    const senhaErrada = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'maria@exemplo.com', senha: 'senha-errada-123' },
    });
    const emailInexistente = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'ninguem@exemplo.com', senha: 'senha-forte-123' },
    });

    expect(senhaErrada.statusCode).toBe(401);
    expect(emailInexistente.statusCode).toBe(401);
    expect(senhaErrada.json()).toEqual(emailInexistente.json());
    expect(senhaErrada.json<{ erro: { mensagem: string } }>().erro.mensagem).toBe(
      'E-mail ou senha incorretos.',
    );
  });
});

describe('POST /auth/refresh', () => {
  it('troca o refresh token por uma sessão nova', async () => {
    const { sessao } = await criarConta(app);
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: sessao.refreshToken },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json<Sessao>().usuario.id).toBe(sessao.usuario.id);
  });

  it('não aceita access token no lugar do refresh', async () => {
    const { sessao } = await criarConta(app);
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: sessao.accessToken },
    });

    expect(resposta.statusCode).toBe(401);
  });
});

describe('GET /auth/eu', () => {
  it('devolve usuário e household de quem está logado', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/eu',
      headers: autorizacao,
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json<{ usuario: { id: string }; household: { nome: string } }>();
    expect(corpo.usuario.id).toBe(sessao.usuario.id);
    expect(corpo.household.nome).toBe('Família de Maria');
  });

  it('exige token', async () => {
    const semToken = await app.inject({ method: 'GET', url: '/api/v1/auth/eu' });
    const tokenInvalido = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/eu',
      headers: { authorization: 'Bearer abc.def.ghi' },
    });

    expect(semToken.statusCode).toBe(401);
    expect(tokenInvalido.statusCode).toBe(401);
    expect(semToken.json<{ erro: { codigo: string } }>().erro.codigo).toBe('NAO_AUTENTICADO');
  });
});

describe('PATCH /auth/eu', () => {
  it('troca a senha conferindo a atual', async () => {
    const { autorizacao } = await criarConta(app, { senha: 'senha-forte-123' });

    const semSenhaAtual = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/eu',
      headers: autorizacao,
      payload: { novaSenha: 'nova-senha-456', senhaAtual: 'errada-123' },
    });
    expect(semSenhaAtual.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/eu',
      headers: autorizacao,
      payload: { novaSenha: 'nova-senha-456', senhaAtual: 'senha-forte-123' },
    });
    expect(ok.statusCode).toBe(200);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'maria@exemplo.com', senha: 'nova-senha-456' },
    });
    expect(login.statusCode).toBe(200);
  });
});
