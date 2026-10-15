import {
  atualizarReceitaSchema,
  criarReceitaSchema,
  erroNaoEncontrado,
  erroSemPermissao,
  erroValidacao,
  listarReceitasSchema,
  zId,
  type ListaDeReceitas,
  type Receita,
} from '@gastos/core';
import type { Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { usuarioDaRequisicao, type UsuarioAutenticado } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { serializarReceita, INCLUDE_RECEITA } from '../serializadores.js';
import { paraData } from '../servicos/datas.js';
import {
  combinarFiltrosDeReceita,
  filtroDeReceitasVisiveis,
} from '../servicos/visibilidade.js';

/**
 * Receitas: o que entra.
 *
 * É o espelho de `rotas/gastos.ts`, menos o que não existe aqui — salário não
 * tem forma de pagamento, cartão nem comprovante. A privacidade é a mesma: o
 * filtro único decide o que cada pessoa enxerga, e ele vale também nas
 * escritas, que foi a lição de setembro.
 */

const paramsSchema = z.object({ id: zId });

async function conferirCategoria(householdId: string, categoriaId: string): Promise<void> {
  const categoria = await prisma.categoria.findFirst({
    where: { id: categoriaId, householdId, tipo: 'RECEITA' },
    select: { id: true },
  });
  if (!categoria) {
    // A mensagem diz o que está errado: usar categoria de gasto numa receita é
    // o engano provável, não um id inventado.
    throw erroValidacao('Essa categoria não serve para receita.', {
      categoriaId: 'Escolha uma categoria de receita.',
    });
  }
}

async function conferirMembro(householdId: string, userId: string): Promise<void> {
  const membro = await prisma.user.findFirst({ where: { id: userId, householdId }, select: { id: true } });
  if (!membro) {
    throw erroValidacao('Essa pessoa não faz parte da família.', { userId: 'Pessoa inválida.' });
  }
}

/** Membro mexe no que é seu; administrador revisa o de todo mundo. */
function conferirPermissaoDeEdicao(usuario: UsuarioAutenticado, donoId: string): void {
  if (usuario.papel !== 'ADMIN' && usuario.id !== donoId) {
    throw erroSemPermissao('Você só pode alterar as receitas que você lançou.');
  }
}

/**
 * A receita que esta pessoa pode alterar — ou 404.
 *
 * Primeiro a visibilidade, depois a permissão: quem não pode VER o salário de
 * alguém não pode alterá-lo, nem descobrir que ele existe pelo código de erro.
 */
async function receitaQuePodeAlterar(
  usuario: UsuarioAutenticado,
  id: string,
): Promise<{ id: string; userId: string }> {
  const receita = await prisma.receita.findFirst({
    where: combinarFiltrosDeReceita(filtroDeReceitasVisiveis(usuario), { id }),
    select: { id: true, userId: true },
  });
  if (!receita) throw erroNaoEncontrado('Essa receita não existe mais.');
  conferirPermissaoDeEdicao(usuario, receita.userId);
  return receita;
}

export async function rotasReceitas(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.autenticar);

  app.get('/', async (request: FastifyRequest): Promise<ListaDeReceitas> => {
    const usuario = usuarioDaRequisicao(request);
    const filtros = listarReceitasSchema.parse(request.query);

    const daTela: Prisma.ReceitaWhereInput = {};
    if (filtros.de || filtros.ate) {
      daTela.data = {
        ...(filtros.de ? { gte: paraData(filtros.de) } : {}),
        ...(filtros.ate ? { lte: paraData(filtros.ate) } : {}),
      };
    }
    if (filtros.userId) daTela.userId = filtros.userId;
    if (filtros.categoriaId) {
      daTela.categoriaId = filtros.categoriaId === 'sem-categoria' ? null : filtros.categoriaId;
    }
    if (filtros.busca) {
      daTela.OR = [
        { descricao: { contains: filtros.busca, mode: 'insensitive' } },
        { observacao: { contains: filtros.busca, mode: 'insensitive' } },
      ];
    }

    const where = combinarFiltrosDeReceita(filtroDeReceitasVisiveis(usuario), daTela);

    const [itens, totalItens, soma] = await Promise.all([
      prisma.receita.findMany({
        where,
        include: INCLUDE_RECEITA,
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
        skip: (filtros.pagina - 1) * filtros.porPagina,
        take: filtros.porPagina,
      }),
      prisma.receita.count({ where }),
      prisma.receita.aggregate({ where, _sum: { valorCentavos: true } }),
    ]);

    return {
      itens: itens.map(serializarReceita),
      paginacao: {
        pagina: filtros.pagina,
        porPagina: filtros.porPagina,
        totalItens,
        totalPaginas: Math.max(1, Math.ceil(totalItens / filtros.porPagina)),
      },
      totalCentavos: soma._sum.valorCentavos ?? 0,
    };
  });

  app.get('/:id', async (request: FastifyRequest): Promise<Receita> => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    const receita = await prisma.receita.findFirst({
      where: combinarFiltrosDeReceita(filtroDeReceitasVisiveis(usuario), { id }),
      include: INCLUDE_RECEITA,
    });
    if (!receita) throw erroNaoEncontrado('Essa receita não existe mais.');

    return serializarReceita(receita);
  });

  app.post('/', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const dados = criarReceitaSchema.parse(request.body);

    const userId = dados.userId ?? usuario.id;
    if (dados.userId && dados.userId !== usuario.id) {
      await conferirMembro(usuario.householdId, dados.userId);
    }
    if (dados.categoriaId) await conferirCategoria(usuario.householdId, dados.categoriaId);

    const receita = await prisma.receita.create({
      data: {
        descricao: dados.descricao,
        valorCentavos: dados.valorCentavos,
        data: paraData(dados.data),
        observacao: dados.observacao ?? null,
        categoriaId: dados.categoriaId ?? null,
        userId,
        householdId: usuario.householdId,
      },
      include: INCLUDE_RECEITA,
    });

    return reply.status(201).send(serializarReceita(receita));
  });

  app.patch('/:id', async (request: FastifyRequest): Promise<Receita> => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);
    const dados = atualizarReceitaSchema.parse(request.body);

    await receitaQuePodeAlterar(usuario, id);

    if (dados.categoriaId) await conferirCategoria(usuario.householdId, dados.categoriaId);
    if (dados.userId) await conferirMembro(usuario.householdId, dados.userId);

    const atualizada = await prisma.receita.update({
      where: { id },
      data: {
        ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
        ...(dados.valorCentavos !== undefined ? { valorCentavos: dados.valorCentavos } : {}),
        ...(dados.data !== undefined ? { data: paraData(dados.data) } : {}),
        ...(dados.observacao !== undefined ? { observacao: dados.observacao } : {}),
        ...(dados.categoriaId !== undefined ? { categoriaId: dados.categoriaId } : {}),
        ...(dados.userId !== undefined ? { userId: dados.userId } : {}),
      },
      include: INCLUDE_RECEITA,
    });

    return serializarReceita(atualizada);
  });

  app.delete('/:id', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    await receitaQuePodeAlterar(usuario, id);
    await prisma.receita.delete({ where: { id } });
    return reply.status(204).send();
  });
}
