import {
  atualizarCategoriaSchema,
  criarCategoriaSchema,
  erroConflito,
  erroNaoEncontrado,
  zId,
  type Categoria,
} from '@gastos/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { usuarioDaRequisicao } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { serializarCategoria } from '../serializadores.js';

const paramsSchema = z.object({ id: zId });

export async function rotasCategorias(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.autenticar);

  app.get('/', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const categorias = await prisma.categoria.findMany({
      where: { householdId: usuario.householdId },
      orderBy: { nome: 'asc' },
    });
    return { itens: categorias.map(serializarCategoria) };
  });

  app.post('/', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const dados = criarCategoriaSchema.parse(request.body);

    const repetida = await prisma.categoria.findFirst({
      where: { householdId: usuario.householdId, nome: { equals: dados.nome, mode: 'insensitive' } },
      select: { id: true },
    });
    if (repetida) throw erroConflito(`Já existe uma categoria chamada "${dados.nome}".`);

    const categoria = await prisma.categoria.create({
      data: { ...dados, householdId: usuario.householdId },
    });
    return reply.status(201).send(serializarCategoria(categoria));
  });

  app.patch('/:id', async (request: FastifyRequest): Promise<Categoria> => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);
    const dados = atualizarCategoriaSchema.parse(request.body);

    const existente = await prisma.categoria.findFirst({
      where: { id, householdId: usuario.householdId },
      select: { id: true },
    });
    if (!existente) throw erroNaoEncontrado('Essa categoria não existe mais.');

    if (dados.nome) {
      const repetida = await prisma.categoria.findFirst({
        where: {
          householdId: usuario.householdId,
          nome: { equals: dados.nome, mode: 'insensitive' },
          id: { not: id },
        },
        select: { id: true },
      });
      if (repetida) throw erroConflito(`Já existe uma categoria chamada "${dados.nome}".`);
    }

    const categoria = await prisma.categoria.update({ where: { id }, data: dados });
    return serializarCategoria(categoria);
  });

  /**
   * Apagar categoria NUNCA apaga gasto: os lançamentos apenas ficam sem
   * categoria e continuam contando no total do mês.
   */
  app.delete('/:id', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    const existente = await prisma.categoria.findFirst({
      where: { id, householdId: usuario.householdId },
      select: { id: true },
    });
    if (!existente) throw erroNaoEncontrado('Essa categoria não existe mais.');

    const gastosAfetados = await prisma.$transaction(async (tx) => {
      const { count } = await tx.gasto.updateMany({
        where: { categoriaId: id },
        data: { categoriaId: null },
      });
      await tx.categoria.delete({ where: { id } });
      return count;
    });

    return reply.status(200).send({ gastosSemCategoria: gastosAfetados });
  });
}
