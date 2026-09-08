import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { gerarHashSenha } from '../servicos/senha.js';
import { criarConta, limparBanco, novoServidor } from './ajuda.js';

/**
 * Os furos que uma varredura de segurança encontrou, cada um com o caminho de
 * ataque que ela executou de verdade.
 *
 * Todos tinham a mesma causa: a rota filtrava só por `householdId` e esquecia
 * o filtro de privacidade. O muro entre grupos estava de pé; o que faltava era
 * a segunda camada, dentro do grupo. Ficam aqui, e não em `privacidade.test.ts`,
 * porque o que estes casos guardam é a exploração — se algum voltar a passar, é
 * porque alguém desfez a correção, não porque a regra mudou.
 */

let app: FastifyInstance;

beforeEach(async () => {
  await limparBanco();
  app ??= await novoServidor();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

type Conta = Awaited<ReturnType<typeof criarConta>>;

async function conviteDe(conta: Conta): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/household/convites',
    headers: conta.autorizacao,
    payload: {},
  });
  return resposta.json<{ codigo: string }>().codigo;
}

/** Ana (dona) e Bruno (convidado), ninguém compartilhando — o padrão do app. */
async function grupoComDuasPessoas(): Promise<{ ana: Conta; bruno: Conta }> {
  const ana = await criarConta(app, { email: 'ana@exemplo.com', nome: 'Ana Lima' });
  const bruno = await criarConta(app, {
    email: 'bruno@exemplo.com',
    nome: 'Bruno Dias',
    codigoConvite: await conviteDe(ana),
  });
  return { ana, bruno };
}

/** Um gasto do Bruno, com comprovante. É o que a Ana não pode alcançar. */
async function gastoPrivadoDoBruno(bruno: Conta): Promise<string> {
  const criado = await app.inject({
    method: 'POST',
    url: '/api/v1/gastos',
    headers: bruno.autorizacao,
    payload: {
      descricao: 'Clínica',
      valorCentavos: 45000,
      data: '2026-03-11',
      formaPagamento: 'PIX',
    },
  });
  const id = criado.json<{ id: string }>().id;

  const limite = '----teste';
  const corpo = Buffer.concat([
    Buffer.from(
      `--${limite}\r\nContent-Disposition: form-data; name="comprovante"; ` +
        `filename="nota.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    PNG,
    Buffer.from(`\r\n--${limite}--\r\n`),
  ]);
  const anexo = await app.inject({
    method: 'PUT',
    url: `/api/v1/gastos/${id}/comprovante`,
    headers: {
      ...bruno.autorizacao,
      'content-type': `multipart/form-data; boundary=${limite}`,
    },
    payload: corpo,
  });
  expect(anexo.statusCode).toBe(200);

  return id;
}

describe('comprovante de quem não compartilha', () => {
  it('não é baixável por outra pessoa do grupo, mesmo com o id em mãos', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();
    const id = await gastoPrivadoDoBruno(bruno);

    // O gasto em si já era protegido...
    const gasto = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${id}`,
      headers: ana.autorizacao,
    });
    expect(gasto.statusCode).toBe(404);

    // ...mas a foto da nota saía por esta porta, que só olhava o grupo.
    const foto = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${id}/comprovante`,
      headers: ana.autorizacao,
    });
    expect(foto.statusCode).toBe(404);

    // E o dono continua alcançando a dele.
    const doDono = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${id}/comprovante`,
      headers: bruno.autorizacao,
    });
    expect(doDono.statusCode).toBe(200);
    expect(doDono.rawPayload.equals(PNG)).toBe(true);
  });
});

describe('alterar gasto que não se pode ver', () => {
  it('o PATCH não serve para ler o que está escondido', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();
    const id = await gastoPrivadoDoBruno(bruno);

    // A Ana é ADMIN (criou o grupo). O PATCH devolve o gasto serializado, então
    // conseguir alterá-lo era conseguir lê-lo — inclusive puxá-lo para si com
    // `userId`, e daí baixar o comprovante "legitimamente".
    const roubo = await app.inject({
      method: 'PATCH',
      url: `/api/v1/gastos/${id}`,
      headers: ana.autorizacao,
      payload: { userId: ana.sessao.usuario.id },
    });
    expect(roubo.statusCode).toBe(404);
    expect(roubo.body).not.toContain('Clínica');

    const apagar = await app.inject({
      method: 'DELETE',
      url: `/api/v1/gastos/${id}`,
      headers: ana.autorizacao,
    });
    expect(apagar.statusCode).toBe(404);

    // O gasto continua com o dono, intacto.
    const doDono = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${id}`,
      headers: bruno.autorizacao,
    });
    expect(doDono.statusCode).toBe(200);
    expect(doDono.json<{ usuario: { id: string } }>().usuario.id).toBe(
      bruno.sessao.usuario.id,
    );
  });
});

describe('promoção a administrador', () => {
  it('gerar um convite e usá-lo em si mesmo não promove ninguém', async () => {
    const { bruno } = await grupoComDuasPessoas();
    expect(bruno.sessao.usuario.papel).toBe('MEMBRO');

    // Qualquer membro pode convidar; entrar com o próprio código dava ADMIN.
    const codigo = await conviteDe(bruno);
    const entrou = await app.inject({
      method: 'POST',
      url: '/api/v1/household/entrar',
      headers: bruno.autorizacao,
      payload: { codigo },
    });
    expect(entrou.statusCode).toBe(200);

    const eu = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/eu',
      headers: bruno.autorizacao,
    });
    expect(eu.json<{ usuario: { papel: string } }>().usuario.papel).toBe('MEMBRO');
  });

  it('mas convidar outra pessoa continua promovendo quem convidou', async () => {
    const { bruno } = await grupoComDuasPessoas();
    await criarConta(app, {
      email: 'caio@exemplo.com',
      nome: 'Caio Souza',
      codigoConvite: await conviteDe(bruno),
    });

    const eu = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/eu',
      headers: bruno.autorizacao,
    });
    expect(eu.json<{ usuario: { papel: string } }>().usuario.papel).toBe('ADMIN');
  });
});

describe('contagens', () => {
  it('não revelam quantos lançamentos os outros têm', async () => {
    const { ana, bruno } = await grupoComDuasPessoas();
    await gastoPrivadoDoBruno(bruno);
    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: bruno.autorizacao,
      payload: { descricao: 'Outro', valorCentavos: 100, data: '2026-03-12' },
    });

    // A Ana não tem lançamento nenhum e não vê os do Bruno: a conta do grupo
    // precisa dizer 0, e não 2 — subtrair o próprio total do total do grupo
    // era a maneira de contar o que o outro lançou.
    const grupos = await app.inject({
      method: 'GET',
      url: '/api/v1/household/grupos',
      headers: ana.autorizacao,
    });
    const grupo = grupos.json<{ itens: Array<{ totalGastos: number; ativo: boolean }> }>()
      .itens.find((g) => g.ativo);
    expect(grupo?.totalGastos).toBe(0);

    // O mesmo pela porta dos fundos: apagar uma categoria devolve quantos
    // lançamentos ficaram sem ela. Refinava a pergunta por categoria.
    const categoria = await prisma.categoria.findFirstOrThrow({
      where: { householdId: ana.sessao.usuario.householdId },
      select: { id: true },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/gastos/${(await listarDoBruno(bruno))[0]}`,
      headers: bruno.autorizacao,
      payload: { categoriaId: categoria.id },
    });

    const apagou = await app.inject({
      method: 'DELETE',
      url: `/api/v1/categorias/${categoria.id}`,
      headers: ana.autorizacao,
    });
    expect(apagou.statusCode).toBe(200);
    expect(apagou.json<{ gastosSemCategoria: number }>().gastosSemCategoria).toBe(0);

    // Mas a categoria sumiu de verdade para o grupo, e o gasto do Bruno ficou
    // sem ela — a contagem é que foi filtrada, não o efeito.
    const doBruno = await prisma.gasto.findFirstOrThrow({
      where: { userId: bruno.sessao.usuario.id, descricao: 'Clínica' },
      select: { categoriaId: true },
    });
    expect(doBruno.categoriaId).toBeNull();
  });
});

/** Os ids dos gastos do Bruno, na ordem em que a API devolve. */
async function listarDoBruno(bruno: Conta): Promise<string[]> {
  const lista = await app.inject({
    method: 'GET',
    url: '/api/v1/gastos',
    headers: bruno.autorizacao,
  });
  return lista.json<{ itens: Array<{ id: string }> }>().itens.map((g) => g.id);
}

describe('trocar a senha derruba as sessões abertas', () => {
  it('o token antigo para de valer, e o novo continua funcionando', async () => {
    const conta = await criarConta(app, {
      email: 'ana@exemplo.com',
      nome: 'Ana Lima',
      senha: 'senha-forte-123',
    });
    const tokenAntigo = conta.autorizacao;
    const refreshAntigo = conta.sessao.refreshToken;

    // Funciona antes.
    const antes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/eu',
      headers: tokenAntigo,
    });
    expect(antes.statusCode).toBe(200);

    // A pessoa troca a senha por outro caminho (aqui, o próprio perfil).
    // Um segundo de folga: o `iat` do JWT tem precisão de segundos, e sem isso
    // o teste ficaria dependendo de os dois caírem no mesmo tique.
    await new Promise((resolver) => setTimeout(resolver, 1100));
    const troca = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/eu',
      headers: tokenAntigo,
      payload: { senhaAtual: 'senha-forte-123', novaSenha: 'outra-senha-456' },
    });
    expect(troca.statusCode).toBe(200);

    // O token de antes morreu — é o ponto: quem invadiu perde o acesso.
    const depois = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/eu',
      headers: tokenAntigo,
    });
    expect(depois.statusCode).toBe(401);

    // E o refresh também, que é o que valia 30 dias.
    const renovar = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: refreshAntigo },
    });
    expect(renovar.statusCode).toBe(401);

    // Entrar com a senha nova devolve uma sessão que funciona.
    const novo = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'ana@exemplo.com', senha: 'outra-senha-456' },
    });
    expect(novo.statusCode).toBe(200);
    const sessao = novo.json<{ accessToken: string }>();
    const agora = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/eu',
      headers: { authorization: `Bearer ${sessao.accessToken}` },
    });
    expect(agora.statusCode).toBe(200);
  });

  it('redefinir pelo código do e-mail também derruba', async () => {
    const conta = await criarConta(app, {
      email: 'ana@exemplo.com',
      nome: 'Ana Lima',
      senha: 'senha-forte-123',
    });

    // Um pedido com código conhecido, como faz `senha-esquecida.test.ts`:
    // pedir pela rota e depois descobrir o código sorteado custaria um scrypt
    // por tentativa. O que este caso guarda é o efeito na sessão, não o sorteio.
    await new Promise((resolver) => setTimeout(resolver, 1100));
    await prisma.pedidoDeSenha.create({
      data: {
        userId: conta.sessao.usuario.id,
        codigoHash: await gerarHashSenha('123456'),
        expiraEm: new Date(Date.now() + 600_000),
      },
    });

    const redefiniu = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/redefinir-senha',
      payload: { email: 'ana@exemplo.com', codigo: '123456', novaSenha: 'terceira-senha-789' },
    });
    expect(redefiniu.statusCode).toBe(200);

    const antigo = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/eu',
      headers: conta.autorizacao,
    });
    expect(antigo.statusCode).toBe(401);
  });
});
