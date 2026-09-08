import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import {
  cifrar,
  cifrarBytes,
  decifrar,
  decifrarBytes,
  indiceDeEmail,
} from '../servicos/criptografia.js';
import { criarConta, limparBanco, novoServidor } from './ajuda.js';

let app: FastifyInstance;

beforeEach(async () => {
  await limparBanco();
  app ??= await novoServidor();
});

afterAll(async () => {
  await app?.close();
});

const NOME = 'Ivonete Aparecida Souza';
const EMAIL = 'ivonete@exemplo.com';

/** PNG 1x1 de verdade: o upload confere o tipo do arquivo. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('cifra e decifra', () => {
  it('vai e volta sem perder nada, inclusive acento e emoji', () => {
    for (const texto of ['Ivonete Souza', 'açaí São João', '🙂 café', '']) {
      expect(decifrar(cifrar(texto))).toBe(texto);
    }
  });

  it('o texto cifrado não contém o original', () => {
    expect(cifrar(EMAIL)).not.toContain(EMAIL);
    expect(cifrar(EMAIL).startsWith('v1$')).toBe(true);
  });

  it('cifrar duas vezes dá resultados diferentes', () => {
    // IV novo a cada escrita. Sem isso, dava para saber que duas linhas
    // guardam o mesmo valor sem conhecer a chave.
    expect(cifrar(EMAIL)).not.toBe(cifrar(EMAIL));
  });

  it('recusa conteúdo adulterado em vez de devolver lixo', () => {
    const bom = cifrar(NOME);
    // Troca o último caractere do base64 por outro: a autenticação do GCM
    // precisa reprovar.
    const ultimo = bom.at(-1) === 'A' ? 'B' : 'A';
    const adulterado = bom.slice(0, -1) + ultimo;
    expect(() => decifrar(adulterado)).toThrow();
  });

  it('deixa passar texto que ainda não foi cifrado', () => {
    // É o que permite ligar a criptografia num banco que já tem gente dentro:
    // a linha antiga é lida como está até o backfill passar por ela.
    expect(decifrar('Maria Silva')).toBe('Maria Silva');
  });

  it('bytes: vão e voltam, e o guardado não é o arquivo original', () => {
    const cifrado = cifrarBytes(PNG);
    expect(cifrado.equals(PNG)).toBe(false);
    expect(cifrado.subarray(0, 8).equals(PNG.subarray(0, 8))).toBe(false);
    expect(decifrarBytes(cifrado).equals(PNG)).toBe(true);
    // Arquivo anterior à criptografia continua legível.
    expect(decifrarBytes(PNG).equals(PNG)).toBe(true);
  });

  it('o índice do e-mail é estável, normaliza e muda com o endereço', () => {
    expect(indiceDeEmail(EMAIL)).toBe(indiceDeEmail(EMAIL));
    expect(indiceDeEmail('  IVONETE@Exemplo.com ')).toBe(indiceDeEmail(EMAIL));
    expect(indiceDeEmail('outra@exemplo.com')).not.toBe(indiceDeEmail(EMAIL));
    expect(indiceDeEmail(EMAIL)).not.toContain('ivonete');
  });
});

describe('o que fica gravado no banco', () => {
  it('não guarda nome nem e-mail em texto puro', async () => {
    await criarConta(app, { nome: NOME, email: EMAIL });

    const linha = await prisma.user.findFirstOrThrow();
    expect(linha.nome).not.toContain('Ivonete');
    expect(linha.email).not.toContain('ivonete');
    expect(decifrar(linha.nome)).toBe(NOME);
    expect(decifrar(linha.email)).toBe(EMAIL);
    // O índice é o que o login procura, e não volta ao endereço.
    expect(linha.emailIndice).toBe(indiceDeEmail(EMAIL));
    expect(linha.emailIndice).not.toContain('ivonete');
  });

  /**
   * O outro caminho que grava o nome, e o lado que a varredura por `v1$` não
   * alcança: se o `cifrar()` do `PATCH /eu` sumisse num refactor, o nome iria
   * em claro para o banco e **nada** quebraria — a leitura tolerante devolveria
   * o texto intacto e todas as telas continuariam certas. Esquecer de decifrar
   * aparece na tela; esquecer de cifrar, não. Por isso este caso olha a coluna.
   */
  it('trocar o nome pelo perfil também grava cifrado', async () => {
    const { autorizacao } = await criarConta(app, { nome: NOME, email: EMAIL });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/eu',
      headers: autorizacao,
      payload: { nome: 'Ivonete Souza da Silva' },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json<{ nome: string }>().nome).toBe('Ivonete Souza da Silva');

    const linha = await prisma.user.findFirstOrThrow();
    expect(linha.nome).not.toContain('Ivonete');
    expect(decifrar(linha.nome)).toBe('Ivonete Souza da Silva');
  });

  it('não guarda o comprovante como o arquivo enviado', async () => {
    const { autorizacao, sessao } = await criarConta(app, { nome: NOME, email: EMAIL });

    const gasto = await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: {
        descricao: 'Mercado',
        valorCentavos: 1000,
        data: '2026-03-05',
        formaPagamento: 'DINHEIRO',
      },
    });
    expect(gasto.statusCode).toBe(201);
    const gastoId = gasto.json<{ id: string }>().id;

    const limite = '----teste';
    const corpo = Buffer.concat([
      Buffer.from(
        `--${limite}\r\nContent-Disposition: form-data; name="comprovante"; ` +
          `filename="nota.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      PNG,
      Buffer.from(`\r\n--${limite}--\r\n`),
    ]);

    const envio = await app.inject({
      method: 'PUT',
      url: `/api/v1/gastos/${gastoId}/comprovante`,
      headers: { ...autorizacao, 'content-type': `multipart/form-data; boundary=${limite}` },
      payload: corpo,
    });
    expect(envio.statusCode).toBe(200);

    // No banco: bytes cifrados, sem a assinatura de PNG no começo.
    const guardado = await prisma.comprovante.findFirstOrThrow();
    const bytes = Buffer.from(guardado.dados);
    expect(bytes.equals(PNG)).toBe(false);
    expect(bytes.subarray(1, 4).toString('ascii')).not.toBe('PNG');

    // Na resposta do download: o arquivo original, intacto.
    const baixado = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${gastoId}/comprovante`,
      headers: autorizacao,
    });
    expect(baixado.statusCode).toBe(200);
    expect(baixado.rawPayload.equals(PNG)).toBe(true);

    expect(sessao.usuario.nome).toBe(NOME);
  });
});

describe('nenhuma rota devolve dado cifrado', () => {
  /**
   * A rede de segurança da mudança inteira: cifrar é feito num lugar só, mas
   * decifrar acontece em cada rota que mostra nome ou e-mail. Esquecer uma
   * delas não quebra o build nem estoura exceção — só entrega `v1$AbC...` na
   * tela. Este caso passa nas rotas que mostram gente e reprova se alguma
   * deixar a cifra escapar.
   */
  it('varre as rotas que mostram nome e e-mail', async () => {
    const { autorizacao, sessao } = await criarConta(app, { nome: NOME, email: EMAIL });

    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: {
        descricao: 'Mercado',
        valorCentavos: 1000,
        data: '2026-03-05',
        formaPagamento: 'DINHEIRO',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/household/metas',
      headers: autorizacao,
      payload: { nome: 'Viagem', valorAlvoCentavos: 100000 },
    });

    const hoje = new Date();
    const rotas = [
      '/api/v1/auth/eu',
      '/api/v1/household/membros',
      '/api/v1/household/metas',
      '/api/v1/household/grupos',
      '/api/v1/gastos',
      // A única rota que monta o nome com código próprio, fora do
      // `serializadores.ts` — ou seja, a que mais precisa desta rede.
      '/api/v1/recorrencias',
      `/api/v1/resumos/mensal?ano=${hoje.getUTCFullYear()}&mes=${hoje.getUTCMonth() + 1}`,
    ];

    for (const url of rotas) {
      const resposta = await app.inject({ method: 'GET', url, headers: autorizacao });
      expect(resposta.statusCode, `${url} respondeu ${resposta.statusCode}`).toBe(200);
      expect(resposta.body, `${url} devolveu texto cifrado`).not.toContain('v1$');
    }

    // E o nome legível chega mesmo, nas duas que o carregam.
    const membros = await app.inject({
      method: 'GET',
      url: '/api/v1/household/membros',
      headers: autorizacao,
    });
    expect(membros.body).toContain(NOME);
    expect(membros.body).toContain(EMAIL);
    expect(sessao.usuario.email).toBe(EMAIL);
  });

  it('a exportação sai com o nome legível', async () => {
    const { autorizacao } = await criarConta(app, { nome: NOME, email: EMAIL });
    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: {
        descricao: 'Mercado',
        valorCentavos: 1000,
        data: '2026-03-05',
        formaPagamento: 'DINHEIRO',
      },
    });

    const csv = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos/exportar?formato=csv',
      headers: autorizacao,
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain(NOME);
    expect(csv.body).not.toContain('v1$');
  });
});

describe('login com o e-mail cifrado', () => {
  it('entra, e não deixa criar duas contas com o mesmo e-mail', async () => {
    await criarConta(app, { nome: NOME, email: EMAIL, senha: 'senha-forte-123' });

    const entrou = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: EMAIL, senha: 'senha-forte-123' },
    });
    expect(entrou.statusCode).toBe(200);
    expect(entrou.json<{ usuario: { nome: string } }>().usuario.nome).toBe(NOME);

    // Maiúsculas e espaços não criam uma segunda conta: o índice normaliza.
    const repetido = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/registrar',
      payload: { nome: 'Outra Pessoa', email: '  IVONETE@Exemplo.com ', senha: 'senha-forte-123' },
    });
    expect(repetido.statusCode).toBe(409);
    expect(await prisma.user.count()).toBe(1);
  });
});
