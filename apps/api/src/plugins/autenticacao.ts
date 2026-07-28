import { erroNaoAutenticado, erroSemPermissao, type Papel } from '@gastos/core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../prisma.js';
import { verificarAccessToken } from '../servicos/tokens.js';

export interface UsuarioAutenticado {
  id: string;
  householdId: string;
  papel: Papel;
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario: UsuarioAutenticado | null;
  }
  interface FastifyInstance {
    autenticar: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    exigirAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Devolve o usuário já autenticado ou estoura 401 — evita `!` espalhado. */
export function usuarioDaRequisicao(request: FastifyRequest): UsuarioAutenticado {
  if (!request.usuario) throw erroNaoAutenticado();
  return request.usuario;
}

export function configurarAutenticacao(app: FastifyInstance): void {
  app.decorateRequest('usuario', null);

  app.decorate('autenticar', async (request: FastifyRequest): Promise<void> => {
    const cabecalho = request.headers.authorization;
    if (!cabecalho?.startsWith('Bearer ')) {
      throw erroNaoAutenticado('Entre na sua conta para continuar.');
    }

    const conteudo = verificarAccessToken(cabecalho.slice('Bearer '.length).trim());

    // Relemos o usuário para que exclusão de conta ou troca de papel/household
    // valham já na próxima requisição, sem esperar o token expirar.
    const usuario = await prisma.user.findUnique({
      where: { id: conteudo.sub },
      select: { id: true, householdId: true, papel: true },
    });
    if (!usuario) throw erroNaoAutenticado();

    request.usuario = usuario;
  });

  app.decorate('exigirAdmin', async (request: FastifyRequest): Promise<void> => {
    const usuario = usuarioDaRequisicao(request);
    if (usuario.papel !== 'ADMIN') {
      throw erroSemPermissao('Só quem administra a família pode fazer isso.');
    }
  });
}
