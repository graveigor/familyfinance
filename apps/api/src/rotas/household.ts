import {
  CATEGORIAS_PADRAO,
  atualizarHouseholdSchema,
  atualizarMembroSchema,
  criarConviteSchema,
  criarGrupoSchema,
  criarMetaSchema,
  entrarComConviteSchema,
  erroConflito,
  erroNaoEncontrado,
  erroValidacao,
  zId,
  type Convite,
  type Meta,
} from '@gastos/core';
import { randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { usuarioDaRequisicao } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { serializarUsuario } from '../serializadores.js';

const paramsSchema = z.object({ id: zId });

/**
 * Código de grupo no formato `FF-9A3K2`: o prefixo é a marca (Family Finance)
 * e os 5 caracteres evitam `0/O` e `1/I/L`, porque o código vai ser ditado por
 * telefone ou digitado do WhatsApp.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function gerarCodigo(): string {
  let nucleo = '';
  for (let i = 0; i < 5; i += 1) {
    nucleo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return `FF-${nucleo}`;
}

/**
 * Move a pessoa para outro grupo levando o que é dela — gastos, recorrências e
 * importações. Os lançamentos são privados por pessoa, então mudar de grupo
 * nunca "some" com o histórico de ninguém: ele viaja junto.
 *
 * Se o grupo antigo ficar vazio, é apagado com o que sobrou nele.
 */
async function moverParaGrupo(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0] extends infer T ? T : never,
  usuarioId: string,
  grupoAntigoId: string,
  grupoNovoId: string,
  papel: 'ADMIN' | 'MEMBRO',
): Promise<void> {
  await tx.user.update({
    where: { id: usuarioId },
    data: { householdId: grupoNovoId, papel },
  });
  await tx.gasto.updateMany({
    where: { userId: usuarioId },
    data: { householdId: grupoNovoId },
  });
  await tx.recorrencia.updateMany({
    where: { userId: usuarioId },
    data: { householdId: grupoNovoId },
  });

  const restantes = await tx.user.count({ where: { householdId: grupoAntigoId } });
  if (restantes === 0) {
    await tx.gasto.updateMany({
      where: { householdId: grupoAntigoId },
      data: { categoriaId: null },
    });
    await tx.categoria.deleteMany({ where: { householdId: grupoAntigoId } });
    await tx.convite.deleteMany({ where: { householdId: grupoAntigoId } });
    await tx.meta.deleteMany({ where: { householdId: grupoAntigoId } });
    await tx.importacao.deleteMany({ where: { householdId: grupoAntigoId } });
    await tx.household.delete({ where: { id: grupoAntigoId } });
  }
}

const INCLUDE_META = { criadoPor: { select: { id: true, nome: true } } } as const;

type MetaComAutor = Awaited<
  ReturnType<typeof prisma.meta.findFirstOrThrow<{ include: typeof INCLUDE_META }>>
>;

function serializarMeta(meta: MetaComAutor): Meta {
  return {
    id: meta.id,
    nome: meta.nome,
    valorAlvoCentavos: meta.valorAlvoCentavos,
    criadoPor: { id: meta.criadoPor.id, nome: meta.criadoPor.nome },
    criadoEm: meta.criadoEm.toISOString(),
  };
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
      if (!membro) throw erroNaoEncontrado('Essa pessoa não está no seu grupo.');

      // Sem isso o grupo poderia ficar sem ninguém para administrar.
      if (membro.papel === 'ADMIN' && papel === 'MEMBRO') {
        const totalAdmins = await prisma.user.count({
          where: { householdId: usuario.householdId, papel: 'ADMIN' },
        });
        if (totalAdmins <= 1) {
          throw erroValidacao('O grupo precisa de pelo menos uma pessoa administradora.');
        }
      }

      const atualizado = await prisma.user.update({ where: { id }, data: { papel } });
      return serializarUsuario(atualizado);
    },
  );

  /**
   * Qualquer pessoa do grupo pode convidar — os lançamentos são privados por
   * pessoa, então convidar alguém não expõe o dinheiro de ninguém.
   */
  app.post('/convites', async (request, reply) => {
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
  });

  app.get('/convites', async (request: FastifyRequest) => {
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
   * Entrar em outro grupo com um código. Os próprios lançamentos viajam junto;
   * o que era dos outros fica com os outros.
   */
  app.post('/entrar', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const { codigo } = entrarComConviteSchema.parse(request.body);

    // O código vale para várias pessoas até expirar: a família inteira pode
    // usar o mesmo código recebido no grupo do WhatsApp.
    const convite = await prisma.convite.findUnique({ where: { codigo } });
    if (!convite || convite.expiraEm < new Date()) {
      throw erroValidacao('Esse código não é mais válido. Peça um novo para quem te convidou.', {
        codigo: 'Código inválido ou expirado.',
      });
    }
    if (convite.householdId === usuario.householdId) {
      const grupo = await prisma.household.findUnique({
        where: { id: convite.householdId },
        select: { nome: true },
      });
      throw erroConflito(
        `Esse código é do grupo "${grupo?.nome ?? 'seu grupo'}", que já é o seu grupo atual.`,
      );
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      await moverParaGrupo(tx, usuario.id, usuario.householdId, convite.householdId, 'MEMBRO');
      return tx.user.findUniqueOrThrow({ where: { id: usuario.id } });
    });

    return serializarUsuario(atualizado);
  });

  /** Criar um grupo novo. Quem cria administra o grupo que criou. */
  app.post('/nova', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { nome } = criarGrupoSchema.parse(request.body);

    const sozinho =
      (await prisma.user.count({
        where: { householdId: usuario.householdId, id: { not: usuario.id } },
      })) === 0;

    // Sozinho no grupo atual, "criar um grupo novo" é só recomeçar com outro
    // nome — sem mover nada e sem perder as categorias.
    if (sozinho) {
      await prisma.household.update({ where: { id: usuario.householdId }, data: { nome } });
      const atualizado = await prisma.user.update({
        where: { id: usuario.id },
        data: { papel: 'ADMIN' },
      });
      return reply.status(201).send(serializarUsuario(atualizado));
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      const novo = await tx.household.create({ data: { nome } });
      await tx.categoria.createMany({
        data: CATEGORIAS_PADRAO.map((categoria) => ({ ...categoria, householdId: novo.id })),
      });
      await moverParaGrupo(tx, usuario.id, usuario.householdId, novo.id, 'ADMIN');
      return tx.user.findUniqueOrThrow({ where: { id: usuario.id } });
    });

    return reply.status(201).send(serializarUsuario(atualizado));
  });

  // --- Metas conjuntas ------------------------------------------------------

  app.get('/metas', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const metas = await prisma.meta.findMany({
      where: { householdId: usuario.householdId },
      include: INCLUDE_META,
      orderBy: { criadoEm: 'asc' },
    });
    return { itens: metas.map(serializarMeta) };
  });

  app.post('/metas', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const dados = criarMetaSchema.parse(request.body);

    const meta = await prisma.meta.create({
      data: {
        nome: dados.nome,
        valorAlvoCentavos: dados.valorAlvoCentavos ?? null,
        householdId: usuario.householdId,
        criadoPorId: usuario.id,
      },
      include: INCLUDE_META,
    });

    return reply.status(201).send(serializarMeta(meta));
  });

  /** Quem criou a meta (ou administra o grupo) pode removê-la. */
  app.delete('/metas/:id', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    const meta = await prisma.meta.findFirst({
      where: { id, householdId: usuario.householdId },
      select: { id: true, criadoPorId: true },
    });
    if (!meta) throw erroNaoEncontrado('Essa meta não existe mais.');
    if (meta.criadoPorId !== usuario.id && usuario.papel !== 'ADMIN') {
      throw erroValidacao('Só quem criou a meta (ou administra o grupo) pode removê-la.');
    }

    await prisma.meta.delete({ where: { id } });
    return reply.status(204).send();
  });
}
