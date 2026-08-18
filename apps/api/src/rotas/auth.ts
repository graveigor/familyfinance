import {
  type Moeda,
  CATEGORIAS_PADRAO,
  atualizarPerfilSchema,
  erroConflito,
  erroNaoAutenticado,
  erroValidacao,
  esqueciSenhaSchema,
  loginSchema,
  redefinirSenhaSchema,
  refreshSchema,
  registrarSchema,
  type Sessao,
} from '@gastos/core';
import { randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { usuarioDaRequisicao } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { serializarUsuario } from '../serializadores.js';
import { enviarEmail } from '../servicos/email.js';
import { conferirSenha, gerarHashSenha } from '../servicos/senha.js';
import { gerarAccessToken, gerarRefreshToken, verificarRefreshToken } from '../servicos/tokens.js';

/** Moeda de um grupo, para preencher o usuário devolvido pela rota. */
async function moedaDoGrupo(householdId: string): Promise<Moeda> {
  const grupo = await prisma.household.findUnique({
    where: { id: householdId },
    select: { moeda: true },
  });
  return grupo?.moeda === 'USD' ? 'USD' : 'BRL';
}


/** Tempo de vida do código e teto de tentativas — segredo curto pede os dois. */
const VALIDADE_DO_CODIGO_MIN = 15;
const MAXIMO_DE_TENTATIVAS = 5;

async function montarSessao(usuario: {
  id: string;
  householdId: string;
  papel: 'ADMIN' | 'MEMBRO';
}): Promise<Pick<Sessao, 'accessToken' | 'refreshToken'>> {
  const dados = { sub: usuario.id, householdId: usuario.householdId, papel: usuario.papel };
  const [accessToken, refreshToken] = await Promise.all([
    gerarAccessToken(dados),
    gerarRefreshToken(dados),
  ]);
  return { accessToken, refreshToken };
}

export async function rotasAuth(app: FastifyInstance): Promise<void> {
  /**
   * Cria a conta. Sem código de convite, o usuário vira ADMIN de um household
   * novo (já com as categorias padrão). Com código, entra na família existente.
   */
  app.post('/registrar', async (request, reply) => {
    const dados = registrarSchema.parse(request.body);

    const jaExiste = await prisma.user.findUnique({ where: { email: dados.email } });
    if (jaExiste) {
      throw erroConflito('Já existe uma conta com esse e-mail.');
    }

    const senhaHash = await gerarHashSenha(dados.senha);

    const usuario = await prisma.$transaction(async (tx) => {
      if (dados.codigoConvite) {
        // O código serve para várias pessoas até expirar — não é de uso único.
        const convite = await tx.convite.findUnique({
          where: { codigo: dados.codigoConvite },
        });
        if (!convite || convite.expiraEm < new Date()) {
          throw erroValidacao('Esse convite não é mais válido. Peça um novo para quem te convidou.', {
            codigoConvite: 'Convite inválido ou expirado.',
          });
        }

        const novo = await tx.user.create({
          data: {
            nome: dados.nome,
            email: dados.email,
            senhaHash,
            papel: 'MEMBRO',
            householdId: convite.householdId,
            participacoes: { create: { householdId: convite.householdId, papel: 'MEMBRO' } },
          },
        });
        // Quem convidou passa a moderar o grupo: foi quem trouxe gente para ele.
        await tx.participacao.updateMany({
          where: { userId: convite.criadoPorId, householdId: convite.householdId },
          data: { papel: 'ADMIN' },
        });
        await tx.user.updateMany({
          where: { id: convite.criadoPorId, householdId: convite.householdId },
          data: { papel: 'ADMIN' },
        });
        return novo;
      }

      const household = await tx.household.create({
        data: {
          nome: dados.nomeHousehold ?? `Família de ${dados.nome.split(' ')[0] ?? dados.nome}`,
          categorias: { create: CATEGORIAS_PADRAO.map((c) => ({ ...c })) },
        },
      });

      const dono = await tx.user.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senhaHash,
          papel: 'ADMIN',
          householdId: household.id,
          participacoes: { create: { householdId: household.id, papel: 'ADMIN' } },
        },
      });
      await tx.household.update({ where: { id: household.id }, data: { criadoPorId: dono.id } });
      return dono;
    });

    const sessao: Sessao = {
      ...(await montarSessao(usuario)),
      usuario: serializarUsuario(usuario, await moedaDoGrupo(usuario.householdId)),
    };
    return reply.status(201).send(sessao);
  });

  app.post('/login', async (request) => {
    const dados = loginSchema.parse(request.body);
    const usuario = await prisma.user.findUnique({ where: { email: dados.email } });

    // Mensagem igual para e-mail inexistente e senha errada: não entregamos
    // quais e-mails existem. A conferência roda mesmo sem usuário para o tempo
    // de resposta não denunciar a diferença.
    const hashReferencia =
      usuario?.senhaHash ??
      'scrypt$16384$8$1$00000000000000000000000000000000$' + '0'.repeat(128);
    const senhaConfere = await conferirSenha(dados.senha, hashReferencia);

    if (!usuario || !senhaConfere) {
      throw erroNaoAutenticado('E-mail ou senha incorretos.');
    }

    const sessao: Sessao = {
      ...(await montarSessao(usuario)),
      usuario: serializarUsuario(usuario, await moedaDoGrupo(usuario.householdId)),
    };
    return sessao;
  });

  app.post('/refresh', async (request) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const conteudo = await verificarRefreshToken(refreshToken);

    const usuario = await prisma.user.findUnique({ where: { id: conteudo.sub } });
    if (!usuario) throw erroNaoAutenticado();

    const sessao: Sessao = {
      ...(await montarSessao(usuario)),
      usuario: serializarUsuario(usuario, await moedaDoGrupo(usuario.householdId)),
    };
    return sessao;
  });

  app.get(
    '/eu',
    { preHandler: [app.autenticar] },
    async (request: FastifyRequest) => {
      const autenticado = usuarioDaRequisicao(request);
      const usuario = await prisma.user.findUniqueOrThrow({ where: { id: autenticado.id } });
      const household = await prisma.household.findUniqueOrThrow({
        where: { id: usuario.householdId },
        select: { id: true, nome: true, moeda: true, criadoEm: true },
      });

      const moeda: Moeda = household.moeda === 'USD' ? 'USD' : 'BRL';
      return {
        usuario: serializarUsuario(usuario, moeda),
        household: {
          id: household.id,
          nome: household.nome,
          moeda,
          criadoEm: household.criadoEm.toISOString(),
        },
      };
    },
  );

  app.patch('/eu', { preHandler: [app.autenticar] }, async (request: FastifyRequest) => {
    const autenticado = usuarioDaRequisicao(request);
    const dados = atualizarPerfilSchema.parse(request.body);
    const usuario = await prisma.user.findUniqueOrThrow({ where: { id: autenticado.id } });

    const atualizacao: { nome?: string; senhaHash?: string; compartilhaGastos?: boolean } = {};
    if (dados.nome) atualizacao.nome = dados.nome;
    if (dados.compartilhaGastos !== undefined) {
      atualizacao.compartilhaGastos = dados.compartilhaGastos;
    }

    if (dados.novaSenha) {
      const confere = await conferirSenha(dados.senhaAtual ?? '', usuario.senhaHash);
      if (!confere) {
        throw erroValidacao('A senha atual não confere.', { senhaAtual: 'Senha incorreta.' });
      }
      atualizacao.senhaHash = await gerarHashSenha(dados.novaSenha);
    }

    const atualizado = await prisma.user.update({
      where: { id: usuario.id },
      data: atualizacao,
    });
    return serializarUsuario(atualizado, await moedaDoGrupo(atualizado.householdId));
  });

  // --- Esqueci minha senha --------------------------------------------------

  /**
   * Manda um código de 6 dígitos para o e-mail.
   *
   * Responde 204 mesmo quando não existe conta com aquele e-mail: dizer
   * "esse e-mail não está cadastrado" entregaria a quem tenta adivinhar a
   * lista de quem usa o app.
   */
  app.post('/esqueci-senha', async (request, reply) => {
    const { email } = esqueciSenhaSchema.parse(request.body);
    const usuario = await prisma.user.findUnique({ where: { email } });

    if (usuario) {
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const expiraEm = new Date(Date.now() + VALIDADE_DO_CODIGO_MIN * 60_000);

      await prisma.$transaction(async (tx) => {
        // Um código por vez: pedir de novo invalida o anterior, então um
        // e-mail antigo esquecido na caixa de entrada não serve mais.
        await tx.pedidoDeSenha.deleteMany({ where: { userId: usuario.id, usadoEm: null } });
        await tx.pedidoDeSenha.create({
          data: { userId: usuario.id, codigoHash: await gerarHashSenha(codigo), expiraEm },
        });
      });

      await enviarEmail({
        para: usuario.email,
        assunto: `${codigo} — código para trocar sua senha`,
        texto: [
          `Olá, ${usuario.nome.split(' ')[0] ?? usuario.nome}.`,
          '',
          `Seu código para trocar a senha no Family Finance é: ${codigo}`,
          '',
          `Ele vale por ${VALIDADE_DO_CODIGO_MIN} minutos e só pode ser usado uma vez.`,
          'Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.',
        ].join('\n'),
      });
    }

    return reply.status(204).send();
  });

  /** Troca a senha com o código e já devolve a sessão: um passo a menos. */
  app.post('/redefinir-senha', async (request) => {
    const { email, codigo, novaSenha } = redefinirSenhaSchema.parse(request.body);

    const usuario = await prisma.user.findUnique({ where: { email } });
    const pedido = usuario
      ? await prisma.pedidoDeSenha.findFirst({
          where: { userId: usuario.id, usadoEm: null, expiraEm: { gt: new Date() } },
          orderBy: { criadoEm: 'desc' },
        })
      : null;

    // Mensagem única para código errado, expirado ou e-mail inexistente: quem
    // está tentando adivinhar não descobre em qual das três parou.
    const recusar = (): never => {
      throw erroValidacao('Código inválido ou expirado. Peça um novo.', {
        codigo: 'Código inválido ou expirado.',
      });
    };

    if (!usuario || !pedido) return recusar();

    if (pedido.tentativas >= MAXIMO_DE_TENTATIVAS) {
      await prisma.pedidoDeSenha.delete({ where: { id: pedido.id } });
      return recusar();
    }

    if (!(await conferirSenha(codigo, pedido.codigoHash))) {
      // Sem este contador, seis dígitos caem em minutos de força bruta.
      await prisma.pedidoDeSenha.update({
        where: { id: pedido.id },
        data: { tentativas: { increment: 1 } },
      });
      return recusar();
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      const pessoa = await tx.user.update({
        where: { id: usuario.id },
        data: { senhaHash: await gerarHashSenha(novaSenha) },
      });
      // Some com todos os pedidos: o usado e qualquer outro pendente.
      await tx.pedidoDeSenha.deleteMany({ where: { userId: usuario.id } });
      return pessoa;
    });

    const sessao: Sessao = {
      ...(await montarSessao(atualizado)),
      usuario: serializarUsuario(atualizado, await moedaDoGrupo(atualizado.householdId)),
    };
    return sessao;
  });
}
