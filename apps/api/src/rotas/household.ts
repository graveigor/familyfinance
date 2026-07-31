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
  erroSemPermissao,
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

type Transacao = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] extends infer T
  ? T
  : never;

/**
 * Deixa `householdId` como o grupo ativo da pessoa.
 *
 * `User.householdId` e `User.papel` são cópias do que vale na participação:
 * guardá-las evita uma consulta a mais em toda requisição autenticada. Toda
 * troca de grupo passa por aqui, para as duas cópias nunca divergirem.
 */
async function ativarGrupo(tx: Transacao, usuarioId: string, householdId: string): Promise<void> {
  const participacao = await tx.participacao.findUnique({
    where: { userId_householdId: { userId: usuarioId, householdId } },
    select: { papel: true },
  });
  if (!participacao) throw erroSemPermissao('Você não participa desse grupo.');

  await tx.user.update({
    where: { id: usuarioId },
    data: { householdId, papel: participacao.papel },
  });
}

/** Entra num grupo (ou reaproveita a participação) e passa a usá-lo. */
async function entrarEAtivar(
  tx: Transacao,
  usuarioId: string,
  householdId: string,
  papel: 'ADMIN' | 'MEMBRO',
): Promise<void> {
  await tx.participacao.upsert({
    where: { userId_householdId: { userId: usuarioId, householdId } },
    create: { userId: usuarioId, householdId, papel },
    // Já participava: manter o papel que a pessoa tem, sem rebaixar ninguém.
    update: {},
  });
  await ativarGrupo(tx, usuarioId, householdId);
}

/** Cria um grupo com as categorias padrão, já com a pessoa dentro e ativo. */
async function criarGrupoParaPessoa(
  tx: Transacao,
  usuarioId: string,
  nome: string,
): Promise<{ id: string }> {
  const grupo = await tx.household.create({ data: { nome, criadoPorId: usuarioId } });
  await tx.categoria.createMany({
    data: CATEGORIAS_PADRAO.map((categoria) => ({ ...categoria, householdId: grupo.id })),
  });
  await entrarEAtivar(tx, usuarioId, grupo.id, 'ADMIN');
  return { id: grupo.id };
}

/**
 * Tira a pessoa de um grupo e a deixa em outro que ela participe. Sem nenhum
 * outro, cria um grupo pessoal — ninguém fica sem grupo ativo.
 *
 * Os lançamentos feitos no grupo ficam nele: é o que permite voltar depois com
 * um código e reencontrar tudo no lugar.
 */
async function desligarDoGrupo(
  tx: Transacao,
  usuario: { id: string; nome: string },
  householdId: string,
): Promise<void> {
  await tx.participacao.delete({
    where: { userId_householdId: { userId: usuario.id, householdId } },
  });

  const atual = await tx.user.findUniqueOrThrow({
    where: { id: usuario.id },
    select: { householdId: true },
  });
  if (atual.householdId !== householdId) return;

  const outra = await tx.participacao.findFirst({
    where: { userId: usuario.id },
    orderBy: { criadoEm: 'asc' },
    select: { householdId: true },
  });
  if (outra) {
    await ativarGrupo(tx, usuario.id, outra.householdId);
    return;
  }
  await criarGrupoParaPessoa(
    tx,
    usuario.id,
    `Família de ${usuario.nome.split(' ')[0] ?? usuario.nome}`,
  );
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

  /**
   * Quem participa do grupo ativo — e não quem está com ele aberto agora.
   * Com vários grupos, uma pessoa pode participar daqui e estar usando outro.
   */
  app.get('/membros', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const participacoes = await prisma.participacao.findMany({
      where: { householdId: usuario.householdId },
      include: { user: true },
      orderBy: { user: { nome: 'asc' } },
    });
    return {
      itens: participacoes.map((p) => ({ ...serializarUsuario(p.user), papel: p.papel })),
    };
  });

  app.patch(
    '/membros/:id',
    { preHandler: [app.exigirAdmin] },
    async (request: FastifyRequest) => {
      const usuario = usuarioDaRequisicao(request);
      const { id } = paramsSchema.parse(request.params);
      const { papel } = atualizarMembroSchema.parse(request.body);

      const participacao = await prisma.participacao.findUnique({
        where: { userId_householdId: { userId: id, householdId: usuario.householdId } },
        include: { user: true },
      });
      if (!participacao) throw erroNaoEncontrado('Essa pessoa não está no seu grupo.');

      // Sem isso o grupo poderia ficar sem ninguém para administrar.
      if (participacao.papel === 'ADMIN' && papel === 'MEMBRO') {
        const totalAdmins = await prisma.participacao.count({
          where: { householdId: usuario.householdId, papel: 'ADMIN' },
        });
        if (totalAdmins <= 1) {
          throw erroValidacao('O grupo precisa de pelo menos uma pessoa administradora.');
        }
      }

      const atualizado = await prisma.$transaction(async (tx) => {
        await tx.participacao.update({
          where: { userId_householdId: { userId: id, householdId: usuario.householdId } },
          data: { papel },
        });
        // A cópia em `User.papel` só vale para o grupo ativo da pessoa.
        if (participacao.user.householdId === usuario.householdId) {
          return tx.user.update({ where: { id }, data: { papel } });
        }
        return participacao.user;
      });

      return { ...serializarUsuario(atualizado), papel };
    },
  );

  /**
   * Tirar alguém do grupo. Os lançamentos que a pessoa fez aqui continuam no
   * grupo — remover ninguém apaga dinheiro, e se ela voltar acha tudo no lugar.
   */
  app.delete('/membros/:id', { preHandler: [app.exigirAdmin] }, async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    if (id === usuario.id) {
      throw erroValidacao('Para sair do grupo, use "Sair do grupo" — assim ninguém fica sem dono.');
    }

    const participacao = await prisma.participacao.findUnique({
      where: { userId_householdId: { userId: id, householdId: usuario.householdId } },
      include: { user: { select: { id: true, nome: true } } },
    });
    if (!participacao) throw erroNaoEncontrado('Essa pessoa não está no seu grupo.');

    await prisma.$transaction((tx) =>
      desligarDoGrupo(tx, participacao.user, usuario.householdId),
    );

    return reply.status(200).send({ removido: participacao.user.nome });
  });

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
    const convite = await prisma.convite.findUnique({
      where: { codigo },
      include: {
        household: { select: { nome: true } },
        criadoPor: { select: { id: true, nome: true } },
      },
    });
    if (!convite || convite.expiraEm < new Date()) {
      throw erroValidacao('Esse código não é mais válido. Peça um novo para quem te convidou.', {
        codigo: 'Código inválido ou expirado.',
      });
    }
    const atualizado = await prisma.$transaction(async (tx) => {
      // Entrar não move nada: a pessoa passa a participar de mais um grupo e
      // começa a usá-lo. Os lançamentos de cada grupo ficam onde foram feitos.
      await entrarEAtivar(tx, usuario.id, convite.householdId, 'MEMBRO');
      // Quem convidou passa a moderar o grupo: foi quem trouxe gente para ele.
      await tx.participacao.updateMany({
        where: { userId: convite.criadoPorId, householdId: convite.householdId },
        data: { papel: 'ADMIN' },
      });
      await tx.user.updateMany({
        where: { id: convite.criadoPorId, householdId: convite.householdId },
        data: { papel: 'ADMIN' },
      });
      return tx.user.findUniqueOrThrow({ where: { id: usuario.id } });
    });

    return serializarUsuario(atualizado);
  });

  /**
   * Sair do grupo ativo. Os lançamentos feitos nele ficam nele: voltando com um
   * código, a pessoa reencontra tudo no lugar.
   */
  app.post('/sair', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);

    const outros = await prisma.participacao.findMany({
      where: { householdId: usuario.householdId, userId: { not: usuario.id } },
      orderBy: { criadoEm: 'asc' },
      select: { userId: true, papel: true },
    });
    if (outros.length === 0) {
      throw erroConflito(
        'Você é a única pessoa deste grupo. Para se livrar dele, use "Meus grupos" e apague-o.',
      );
    }

    const eu = await prisma.user.findUniqueOrThrow({
      where: { id: usuario.id },
      select: { id: true, nome: true },
    });

    const atualizado = await prisma.$transaction(async (tx) => {
      // O grupo não pode ficar sem ninguém para administrar.
      if (usuario.papel === 'ADMIN' && !outros.some((o) => o.papel === 'ADMIN')) {
        const herdeiro = outros[0]!.userId;
        await tx.participacao.update({
          where: { userId_householdId: { userId: herdeiro, householdId: usuario.householdId } },
          data: { papel: 'ADMIN' },
        });
        await tx.user.updateMany({
          where: { id: herdeiro, householdId: usuario.householdId },
          data: { papel: 'ADMIN' },
        });
      }
      await desligarDoGrupo(tx, eu, usuario.householdId);
      return tx.user.findUniqueOrThrow({ where: { id: usuario.id } });
    });

    return reply.status(200).send(serializarUsuario(atualizado));
  });

  /**
   * Criar mais um grupo. Antes isto trocava a pessoa de grupo; agora ela passa
   * a participar de mais um e começa a usá-lo, sem deixar o anterior.
   */
  app.post('/nova', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { nome } = criarGrupoSchema.parse(request.body);

    const atualizado = await prisma.$transaction(async (tx) => {
      await criarGrupoParaPessoa(tx, usuario.id, nome);
      return tx.user.findUniqueOrThrow({ where: { id: usuario.id } });
    });

    return reply.status(201).send(serializarUsuario(atualizado));
  });

  /**
   * Todos os grupos da pessoa, para a tela "Meus grupos". Traz os códigos
   * ativos só dos grupos que ela administra — código é convite, não é público.
   */
  app.get('/grupos', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);

    const participacoes = await prisma.participacao.findMany({
      where: { userId: usuario.id },
      include: {
        household: {
          include: {
            _count: { select: { participacoes: true, gastos: true } },
            convites: {
              where: { expiraEm: { gt: new Date() } },
              orderBy: { criadoEm: 'desc' },
              select: { codigo: true, expiraEm: true },
            },
          },
        },
      },
      orderBy: { criadoEm: 'asc' },
    });

    return {
      itens: participacoes.map((p) => ({
        id: p.household.id,
        nome: p.household.nome,
        papel: p.papel,
        ativo: p.householdId === usuario.householdId,
        souDono: p.household.criadoPorId === usuario.id,
        totalMembros: p.household._count.participacoes,
        totalGastos: p.household._count.gastos,
        codigos:
          p.papel === 'ADMIN'
            ? p.household.convites.map((c) => ({
                codigo: c.codigo,
                expiraEm: c.expiraEm.toISOString(),
              }))
            : [],
        criadoEm: p.household.criadoEm.toISOString(),
      })),
    };
  });

  /** Troca o grupo que está em uso. */
  app.post('/grupos/:id/ativar', async (request: FastifyRequest) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    const atualizado = await prisma.$transaction(async (tx) => {
      await ativarGrupo(tx, usuario.id, id);
      return tx.user.findUniqueOrThrow({ where: { id: usuario.id } });
    });

    return serializarUsuario(atualizado);
  });

  /**
   * Apagar um grupo inteiro, com os lançamentos dentro dele.
   *
   * Só quem administra, e só quando não há mais ninguém no grupo: apagar levaria
   * junto o dinheiro que as outras pessoas lançaram ali. Para esvaziar antes,
   * use "tirar do grupo" em cada pessoa.
   */
  app.delete('/grupos/:id', async (request, reply) => {
    const usuario = usuarioDaRequisicao(request);
    const { id } = paramsSchema.parse(request.params);

    const participacao = await prisma.participacao.findUnique({
      where: { userId_householdId: { userId: usuario.id, householdId: id } },
    });
    if (!participacao) throw erroNaoEncontrado('Você não participa desse grupo.');
    if (participacao.papel !== 'ADMIN') {
      throw erroSemPermissao('Só quem administra o grupo pode apagá-lo.');
    }

    const outros = await prisma.participacao.count({
      where: { householdId: id, userId: { not: usuario.id } },
    });
    if (outros > 0) {
      throw erroConflito(
        `Ainda há ${outros === 1 ? 'mais uma pessoa' : `mais ${outros} pessoas`} neste grupo. Tire ${outros === 1 ? 'ela' : 'todas'} do grupo antes de apagá-lo — o que elas lançaram aqui seria apagado junto.`,
      );
    }

    const totalGrupos = await prisma.participacao.count({ where: { userId: usuario.id } });
    if (totalGrupos <= 1) {
      throw erroConflito('Este é o seu único grupo. Crie outro antes de apagar este.');
    }

    const eu = await prisma.user.findUniqueOrThrow({
      where: { id: usuario.id },
      select: { id: true, nome: true },
    });

    await prisma.$transaction(async (tx) => {
      // Sai do grupo primeiro: assim a pessoa nunca fica com um grupo ativo
      // que deixou de existir.
      await desligarDoGrupo(tx, eu, id);

      await tx.comprovante.deleteMany({ where: { gasto: { householdId: id } } });
      await tx.gasto.deleteMany({ where: { householdId: id } });
      await tx.recorrencia.deleteMany({ where: { householdId: id } });
      await tx.meta.deleteMany({ where: { householdId: id } });
      await tx.importacao.deleteMany({ where: { householdId: id } });
      await tx.convite.deleteMany({ where: { householdId: id } });
      await tx.cartao.deleteMany({ where: { householdId: id } });
      await tx.categoria.deleteMany({ where: { householdId: id } });
      await tx.household.delete({ where: { id } });
    });

    const atual = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
    return reply.status(200).send(serializarUsuario(atual));
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
