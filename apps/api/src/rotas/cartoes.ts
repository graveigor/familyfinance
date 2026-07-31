import {
  ROTULO_TIPO_CARTAO,
  atualizarCartaoSchema,
  criarCartaoSchema,
  erroConflito,
  erroNaoEncontrado,
  zId,
  type Cartao,
} from '@gastos/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { usuarioDaRequisicao } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { serializarCartao } from '../serializadores.js';

const paramsSchema = z.object({ id: zId });

/**
 * Cartões da casa. São do grupo, e não de cada pessoa: quem divide o cartão do
 * Itaú divide o apelido também. O que continua privado é o gasto, não o cartão.
 */
export async function rotasCartoes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.autenticar);

  app.get('/', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const cartoes = await prisma.cartao.findMany({
      where: { householdId: usuario.householdId },
      orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    });
    return { itens: cartoes.map(serializarCartao) };
  });

  app.post('/', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const dados = criarCartaoSchema.parse(request.body);

    const repetido = await prisma.cartao.findFirst({
      where: {
        householdId: usuario.householdId,
        tipo: dados.tipo,
        nome: { equals: dados.nome, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (repetido) {
      throw erroConflito(
        `Já existe um cartão "${dados.nome}" de ${ROTULO_TIPO_CARTAO[dados.tipo].toLowerCase()}.`,
      );
    }

    const cartao = await prisma.cartao.create({
      data: { ...dados, householdId: usuario.householdId },
    });
    return reply.status(201).send(serializarCartao(cartao));
  });

  app.patch('/:id', async (request: FastifyRequest): Promise<Cartao> => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);
    const dados = atualizarCartaoSchema.parse(request.body);

    const existente = await prisma.cartao.findFirst({
      where: { id, householdId: usuario.householdId },
    });
    if (!existente) throw erroNaoEncontrado('Esse cartão não existe mais.');

    // O par nome+tipo é o que precisa ser único; mudar só a cor não conflita.
    const nome = dados.nome ?? existente.nome;
    const tipo = dados.tipo ?? existente.tipo;
    if (dados.nome !== undefined || dados.tipo !== undefined) {
      const repetido = await prisma.cartao.findFirst({
        where: {
          householdId: usuario.householdId,
          tipo,
          nome: { equals: nome, mode: 'insensitive' },
          id: { not: id },
        },
        select: { id: true },
      });
      if (repetido) {
        throw erroConflito(
          `Já existe um cartão "${nome}" de ${ROTULO_TIPO_CARTAO[tipo].toLowerCase()}.`,
        );
      }
    }

    const cartao = await prisma.cartao.update({ where: { id }, data: dados });
    return serializarCartao(cartao);
  });

  /**
   * Apagar cartão NUNCA apaga gasto — pela mesma razão das categorias: o
   * histórico é da família, a etiqueta é só organização.
   */
  app.delete('/:id', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    const existente = await prisma.cartao.findFirst({
      where: { id, householdId: usuario.householdId },
      select: { id: true },
    });
    if (!existente) throw erroNaoEncontrado('Esse cartão não existe mais.');

    const gastosAfetados = await prisma.$transaction(async (tx) => {
      const { count } = await tx.gasto.updateMany({
        where: { cartaoId: id },
        data: { cartaoId: null },
      });
      await tx.recorrencia.updateMany({ where: { cartaoId: id }, data: { cartaoId: null } });
      await tx.cartao.delete({ where: { id } });
      return count;
    });

    return reply.status(200).send({ gastosSemCartao: gastosAfetados });
  });
}
