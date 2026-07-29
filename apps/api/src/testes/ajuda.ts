import type { FastifyInstance } from 'fastify';
import type { Sessao } from '@gastos/core';
import { prisma } from '../prisma.js';
import { criarServidor } from '../servidor.js';

/** Zera o banco de teste entre os casos, preservando a estrutura das tabelas. */
export async function limparBanco(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Comprovante", "Gasto", "Recorrencia", "Meta", "Importacao", "Convite", "Categoria", "User", "Household" RESTART IDENTITY CASCADE',
  );
}

export async function novoServidor(): Promise<FastifyInstance> {
  const app = await criarServidor();
  await app.ready();
  return app;
}

interface ContaCriada {
  sessao: Sessao;
  autorizacao: { authorization: string };
}

/** Cria uma conta pela própria API — os testes exercitam o fluxo real. */
export async function criarConta(
  app: FastifyInstance,
  opcoes: { nome?: string; email?: string; senha?: string; codigoConvite?: string } = {},
): Promise<ContaCriada> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/registrar',
    payload: {
      nome: opcoes.nome ?? 'Maria Silva',
      email: opcoes.email ?? 'maria@exemplo.com',
      senha: opcoes.senha ?? 'senha-forte-123',
      ...(opcoes.codigoConvite ? { codigoConvite: opcoes.codigoConvite } : {}),
    },
  });

  if (resposta.statusCode !== 201) {
    throw new Error(`Falha ao criar conta de teste: ${resposta.body}`);
  }

  const sessao = resposta.json<Sessao>();
  return {
    sessao,
    autorizacao: { authorization: `Bearer ${sessao.accessToken}` },
  };
}

export async function idDaCategoria(householdId: string, nome: string): Promise<string> {
  const categoria = await prisma.categoria.findFirstOrThrow({
    where: { householdId, nome },
    select: { id: true },
  });
  return categoria.id;
}
