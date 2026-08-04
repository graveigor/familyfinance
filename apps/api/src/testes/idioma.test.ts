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

/** Mensagem geral do corpo de erro. */
function mensagem(corpo: string): string {
  return (JSON.parse(corpo) as { erro: { mensagem: string } }).erro.mensagem;
}

function campos(corpo: string): Record<string, string> {
  return (JSON.parse(corpo) as { erro: { campos?: Record<string, string> } }).erro.campos ?? {};
}

describe('idioma das mensagens do servidor', () => {
  it('responde em português por padrão', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'ninguem@exemplo.com', senha: 'senha-forte-123' },
    });
    expect(resposta.statusCode).toBe(401);
    expect(mensagem(resposta.body)).toBe('E-mail ou senha incorretos.');
  });

  it('responde em inglês quando o cliente pede', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'accept-language': 'en' },
      payload: { email: 'ninguem@exemplo.com', senha: 'senha-forte-123' },
    });
    expect(resposta.statusCode).toBe(401);
    expect(mensagem(resposta.body)).toBe('Wrong email or password.');
  });

  it('traduz também o erro de cada campo do formulário', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/registrar',
      headers: { 'accept-language': 'en-US,en;q=0.9' },
      payload: { nome: 'Ana', email: 'nao-e-email', senha: '123' },
    });
    expect(resposta.statusCode).toBe(400);
    const porCampo = campos(resposta.body);
    expect(porCampo.email).toBe("That email doesn't look right.");
    expect(porCampo.senha).toBe('Your password needs at least 8 characters.');
  });

  it('traduz mensagem que carrega nome no meio', async () => {
    const { autorizacao } = await criarConta(app);
    await app.inject({
      method: 'POST',
      url: '/api/v1/categorias',
      headers: autorizacao,
      payload: { nome: 'Pets' },
    });

    const repetida = await app.inject({
      method: 'POST',
      url: '/api/v1/categorias',
      headers: { ...autorizacao, 'accept-language': 'en' },
      payload: { nome: 'Pets' },
    });
    expect(repetida.statusCode).toBe(409);
    expect(mensagem(repetida.body)).toBe('There\'s already a category called "Pets".');
  });

  it('sem tradução, devolve o português em vez de sumir com o texto', async () => {
    const { autorizacao } = await criarConta(app);
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/endereco-que-nao-existe',
      headers: { ...autorizacao, 'accept-language': 'en' },
    });
    expect(resposta.statusCode).toBe(404);
    // Esta tem padrão; o importante é que nunca volte vazia.
    expect(mensagem(resposta.body).length).toBeGreaterThan(0);
  });
});
