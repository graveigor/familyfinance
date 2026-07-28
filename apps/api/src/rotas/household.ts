import {
  atualizarHouseholdSchema,
  atualizarMembroSchema,
  criarConviteSchema,
  entrarComConviteSchema,
  erroConflito,
  erroNaoEncontrado,
  erroSemPermissao,
  erroValidacao,
  zId,
  type Convite,
} from '@gastos/core';
import { randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { usuarioDaRequisicao } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { serializarUsuario } from '../serializadores.js';

const paramsSchema = z.object({ id: zId });

/**
 * Código de 6 caracteres sem `0/O` e `1/I/L`, que a pessoa vai ditar por
 * telefone ou digitar do WhatsApp.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function gerarCodigo(): string {
  let codigo = '';
  for (let i = 0; i < 6; i += 1) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return codigo;
}

export async function rotasHousehold(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.autenticar);

  app.get('/', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const household = await prisma.household.findUniqueOrThrow({
      where: { id: usuario.householdId },
      select: { id: true, nome: true, criadoEm: true },
    });
    return { id: household.id, nome: household.nome, criadoEm: household.criadoEm.toISOString() };
  });

  app.patch('/', { preHandler: [app.exigirAdmin] }, async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const dados = atualizarHouseholdSchema.parse(request.body);
    const household = await prisma.household.update({
      where: { id: usuario.householdId },
      data: dados,
      select: { id: true, nome: true, criadoEm: true },
    });
    return { id: household.id, nome: household.nome, criadoEm: household.criadoEm.toISOString() };
  });

  app.get('/membros', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const membros = await prisma.user.findMany({
      where: { householdId: usuario.householdId },
      orderBy: { nome: 'asc' },
    });
    return { itens: membros.map(serializarUsuario) };
  });

  app.patch(
    '/membros/:id',
    { preHandler: [app.exigirAdmin] },
    async (request: FastifyRequest) => {
      const usuario = usuarioDaRequisicao(request);
      const { id } = paramsSchema.parse(request.params);
      const { papel } = atualizarMembroSchema.parse(request.body);

      const membro = await prisma.user.findFirst({
        where: { id, householdId: usuario.householdId },
      });
      if (!membro) throw erroNaoEncontrado('Essa pessoa não está na sua família.');

      // Sem isso a casa poderia ficar sem ninguém para administrar.
      if (membro.papel === 'ADMIN' && papel === 'MEMBRO') {
        const totalAdmins = await prisma.user.count({
          where: { householdId: usuario.householdId, papel: 'ADMIN' },
        });
        if (totalAdmins <= 1) {
          throw erroValidacao('A família precisa de pelo menos uma pessoa administradora.');
        }
      }

      const atualizado = await prisma.user.update({ where: { id }, data: { papel } });
      return serializarUsuario(atualizado);
    },
  );

  app.post(
    '/convites',
    { preHandler: [app.exigirAdmin] },
    async (request, reply) => {
      const usuario = usuarioDaRequisicao(request);
      const { validadeDias } = criarConviteSchema.parse(request.body ?? {});

      const household = await prisma.household.findUniqueOrThrow({
        where: { id: usuario.householdId },
        select: { id: true, nome: true },
      });

      const expiraEm = new Date();
      expiraEm.setDate(expiraEm.getDate() + validadeDias);

      // Colisão de código é improvável, mas tentamos de novo em vez de falhar.
      let convite = null;
      for (let tentativa = 0; tentativa < 5 && !convite; tentativa += 1) {
        const codigo = gerarCodigo();
        const jaUsado = await prisma.convite.findUnique({ where: { codigo } });
        if (jaUsado) continue;
        convite = await prisma.convite.create({
          data: {
            codigo,
            householdId: household.id,
            criadoPorId: usuario.id,
            expiraEm,
          },
        });
      }
      if (!convite) throw erroConflito('Não conseguimos gerar o convite. Tente de novo.');

      const resposta: Convite = {
        codigo: convite.codigo,
        expiraEm: convite.expiraEm.toISOString(),
        household: { id: household.id, nome: household.nome },
      };
      return reply.status(201).send(resposta);
    },
  );

  app.get('/convites', { preHandler: [app.exigirAdmin] }, async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const convites = await prisma.convite.findMany({
      where: { householdId: usuario.householdId, usadoEm: null, expiraEm: { gt: new Date() } },
      orderBy: { criadoEm: 'desc' },
      select: { codigo: true, expiraEm: true, criadoEm: true },
    });
    return {
      itens: convites.map((c) => ({
        codigo: c.codigo,
        expiraEm: c.expiraEm.toISOString(),
        criadoEm: c.criadoEm.toISOString(),
      })),
    };
  });

  /**
   * Entrar em outra família com quem já tem conta. Só é permitido enquanto a
   * casa atual da pessoa está vazia (sem gastos e sem outros membros) — assim
   * ninguém "some" com o histórico de outra família ao mudar de lugar.
   */
  app.post('/entrar', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const { codigo } = entrarComConviteSchema.parse(request.body);

    const convite = await prisma.convite.findUnique({ where: { codigo } });
    if (!convite || convite.usadoEm || convite.expiraEm < new Date()) {
      throw erroValidacao('Esse convite não é mais válido. Peça um novo para quem te convidou.', {
        codigo: 'Convite inválido ou expirado.',
      });
    }
    if (convite.householdId === usuario.householdId) {
      throw erroConflito('Você já faz parte dessa família.');
    }

    const [outrosMembros, gastosDaCasa] = await Promise.all([
      prisma.user.count({ where: { householdId: usuario.householdId, id: { not: usuario.id } } }),
      prisma.gasto.count({ where: { householdId: usuario.householdId } }),
    ]);
    if (outrosMembros > 0 || gastosDaCasa > 0) {
      throw erroSemPermissao(
        'Você já tem uma família com dados registrados. Peça para alguém de lá remover você antes de entrar em outra.',
      );
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      const usuarioAtualizado = await tx.user.update({
        where: { id: usuario.id },
        data: { householdId: convite.householdId, papel: 'MEMBRO' },
      });
      await tx.convite.update({ where: { id: convite.id }, data: { usadoEm: new Date() } });
      // A casa antiga ficou sem ninguém: some com ela e com as categorias padrão.
      await tx.categoria.deleteMany({ where: { householdId: usuario.householdId } });
      await tx.convite.deleteMany({ where: { householdId: usuario.householdId } });
      await tx.household.delete({ where: { id: usuario.householdId } });
      return usuarioAtualizado;
    });

    return serializarUsuario(atualizado);
  });
}
