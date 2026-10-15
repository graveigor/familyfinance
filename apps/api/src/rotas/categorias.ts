import {
  atualizarCategoriaSchema,
  criarCategoriaSchema,
  listarCategoriasSchema,
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
import { combinarFiltros, filtroDeGastosVisiveis } from '../servicos/visibilidade.js';

const paramsSchema = z.object({ id: zId });

export async function rotasCategorias(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.autenticar);

  app.get('/', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    // Sem `tipo` vêm as duas: é o que a tela de ajustes mostra. Os formulários
    // de gasto e de receita pedem o seu, para "Salário" não aparecer num gasto.
    const { tipo } = listarCategoriasSchema.parse(request.query);
    const categorias = await prisma.categoria.findMany({
      where: { householdId: usuario.householdId, ...(tipo ? { tipo } : {}) },
      orderBy: { nome: 'asc' },
    });
    return { itens: categorias.map(serializarCategoria) };
  });

  app.post('/', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const dados = criarCategoriaSchema.parse(request.body);

    const repetida = await prisma.categoria.findFirst({
      where: {
        householdId: usuario.householdId,
        tipo: dados.tipo,
        nome: { equals: dados.nome, mode: 'insensitive' },
      },
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

    // Contado antes de apagar, e só o que esta pessoa enxerga: o número volta
    // para a tela, e o número cheio contaria os lançamentos de quem não
    // compartilha. Apagar uma categoria de propósito e ler o total seria uma
    // forma de perguntar "quantos gastos de Saúde o fulano tem?".
    const gastosVisiveis = await prisma.gasto.count({
      where: combinarFiltros(filtroDeGastosVisiveis(usuario), { categoriaId: id }),
    });

    await prisma.$transaction(async (tx) => {
      // O `updateMany` continua alcançando todos: a categoria some para o
      // grupo inteiro, e nenhum lançamento pode ficar apontando para ela.
      await tx.gasto.updateMany({ where: { categoriaId: id }, data: { categoriaId: null } });
      await tx.categoria.delete({ where: { id } });
    });

    return reply.status(200).send({ gastosSemCategoria: gastosVisiveis });
  });
}
