import {
  CATEGORIAS_PADRAO,
  atualizarPerfilSchema,
  erroConflito,
  erroNaoAutenticado,
  erroValidacao,
  loginSchema,
  refreshSchema,
  registrarSchema,
  type Sessao,
} from '@gastos/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { usuarioDaRequisicao } from '../plugins/autenticacao.js';
import { prisma } from '../prisma.js';
import { serializarUsuario } from '../serializadores.js';
import { conferirSenha, gerarHashSenha } from '../servicos/senha.js';
import { gerarAccessToken, gerarRefreshToken, verificarRefreshToken } from '../servicos/tokens.js';

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
          },
        });
        // Quem convidou passa a moderar o grupo: foi quem trouxe gente para ele.
        await tx.user.update({ where: { id: convite.criadoPorId }, data: { papel: 'ADMIN' } });
        return novo;
      }

      const household = await tx.household.create({
        data: {
          nome: dados.nomeHousehold ?? `Família de ${dados.nome.split(' ')[0] ?? dados.nome}`,
          categorias: { create: CATEGORIAS_PADRAO.map((c) => ({ ...c })) },
        },
      });

      return tx.user.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senhaHash,
          papel: 'ADMIN',
          householdId: household.id,
        },
      });
    });

    const sessao: Sessao = {
      ...(await montarSessao(usuario)),
      usuario: serializarUsuario(usuario),
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
      usuario: serializarUsuario(usuario),
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
      usuario: serializarUsuario(usuario),
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
        select: { id: true, nome: true, criadoEm: true },
      });

      return {
        usuario: serializarUsuario(usuario),
        household: {
          id: household.id,
          nome: household.nome,
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
    return serializarUsuario(atualizado);
  });
}
