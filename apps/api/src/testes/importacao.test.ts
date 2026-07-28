import type { ListaDeGastos, PreviaImportacao } from '@gastos/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { prisma } from '../prisma.js';
import { criarConta, limparBanco, novoServidor } from './ajuda.js';

let app: FastifyInstance;

beforeEach(async () => {
  await limparBanco();
  app ??= await novoServidor();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

/** Monta um .xlsx em memória a partir das linhas, como a família faria à mão. */
function planilha(linhas: unknown[][]): Buffer {
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, aba, 'Gastos');
  return XLSX.write(pasta, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const LIMITE = '----------------------------teste123';

/** Corpo multipart montado na mão — evita mais uma dependência só para teste. */
function corpoMultipart(nomeArquivo: string, conteudo: Buffer): Buffer {
  const cabecalho = Buffer.from(
    `--${LIMITE}\r\n` +
      `Content-Disposition: form-data; name="arquivo"; filename="${nomeArquivo}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
    'utf8',
  );
  return Buffer.concat([cabecalho, conteudo, Buffer.from(`\r\n--${LIMITE}--\r\n`, 'utf8')]);
}

async function enviar(
  headers: { authorization: string },
  nomeArquivo: string,
  conteudo: Buffer,
): Promise<{ status: number; corpo: PreviaImportacao }> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/importacoes/analisar',
    headers: {
      ...headers,
      'content-type': `multipart/form-data; boundary=${LIMITE}`,
    },
    payload: corpoMultipart(nomeArquivo, conteudo),
  });
  return { status: resposta.statusCode, corpo: resposta.json<PreviaImportacao>() };
}

/**
 * A planilha do critério de aceitação: colunas em português, valores com
 * "R$ 1.234,56", título antes do cabeçalho, linha de total no fim e uma
 * linha estragada no meio.
 */
const PLANILHA_REAL: unknown[][] = [
  ['Controle de gastos da família — 2024'],
  [],
  ['Nome', 'Local', 'Valor', 'Data'],
  ['Maria', 'Supermercado Bom Preço', 'R$ 1.234,56', '05/03/2024'],
  ['João', 'Posto Ipiranga', 'R$ 200,00', '07/03/2024'],
  ['Maria', 'Farmácia', '89,90', '12/03/2024'],
  ['', '', '', ''],
  ['João', 'Padaria', 'R$ 15,50', '15/03/2024'],
  ['Maria', 'Estorno cartão', '(45,90)', '18/03/2024'],
  ['João', 'Cinema', 'não sei', '20/03/2024'],
  ['', 'TOTAL', 'R$ 1.494,06', ''],
];

// 1234,56 + 200,00 + 89,90 + 15,50 - 45,90 = 1494,06
const SOMA_ESPERADA = 123456 + 20000 + 8990 + 1550 - 4590;

describe('POST /importacoes/analisar', () => {
  it('importa a planilha real sem configuração manual de mapeamento', async () => {
    const { autorizacao } = await criarConta(app);
    const { status, corpo } = await enviar(autorizacao, 'gastos.xlsx', planilha(PLANILHA_REAL));

    expect(status).toBe(201);
    // Cabeçalho reconhecido sozinho, mesmo com título e linha em branco antes.
    expect(corpo.colunas).toEqual(['Nome', 'Local', 'Valor', 'Data']);
    expect(corpo.mapeamento).toEqual({ pessoa: 0, descricao: 1, valor: 2, data: 3 });

    // 5 gastos válidos + 1 com erro; a linha vazia e o TOTAL saem de cena.
    expect(corpo.linhas).toHaveLength(6);
    expect(corpo.totais.ignoradas).toBe(2);
    expect(corpo.totais.comErro).toBe(1);

    // O número da linha tem de ser o mesmo que a pessoa vê no Excel: título na
    // 1, branco na 2, cabeçalho na 3, primeiro gasto na 4.
    expect(corpo.linhas[0]?.linha).toBe(4);
    expect(corpo.linhas.find((l) => l.descricao === 'Cinema')?.linha).toBe(10);

    const cinema = corpo.linhas.find((l) => l.descricao === 'Cinema');
    expect(cinema?.status).toBe('ERRO');
    expect(cinema?.incluir).toBe(false);
    expect(cinema?.erros[0]).toBe('"não sei" não é um valor válido.');
  });

  it('lê os valores exatamente, em centavos', async () => {
    const { autorizacao } = await criarConta(app);
    const { corpo } = await enviar(autorizacao, 'gastos.xlsx', planilha(PLANILHA_REAL));

    const porDescricao = new Map(corpo.linhas.map((l) => [l.descricao, l.valorCentavos]));
    expect(porDescricao.get('Supermercado Bom Preço')).toBe(123456);
    expect(porDescricao.get('Posto Ipiranga')).toBe(20000);
    expect(porDescricao.get('Farmácia')).toBe(8990);
    expect(porDescricao.get('Padaria')).toBe(1550);
    // Entre parênteses = estorno.
    expect(porDescricao.get('Estorno cartão')).toBe(-4590);

    expect(corpo.totais.centavosAImportar).toBe(SOMA_ESPERADA);
  });

  it('casa as pessoas pelo primeiro nome e avisa quando não conhece', async () => {
    const admin = await criarConta(app, { email: 'maria@exemplo.com', nome: 'Maria Silva' });
    const convite = await app.inject({
      method: 'POST',
      url: '/api/v1/household/convites',
      headers: admin.autorizacao,
      payload: {},
    });
    await criarConta(app, {
      email: 'joao@exemplo.com',
      nome: 'João Souza',
      codigoConvite: convite.json<{ codigo: string }>().codigo,
    });

    const { corpo } = await enviar(
      admin.autorizacao,
      'gastos.xlsx',
      planilha([
        ['Nome', 'Local', 'Valor', 'Data'],
        ['maria', 'Mercado', '10,00', '05/03/2024'],
        ['JOÃO', 'Posto', '20,00', '06/03/2024'],
        ['Ana', 'Farmácia', '30,00', '07/03/2024'],
      ]),
    );

    const membros = await prisma.user.findMany({ orderBy: { nome: 'asc' } });
    const joao = membros.find((m) => m.nome === 'João Souza');
    const maria = membros.find((m) => m.nome === 'Maria Silva');

    // Casa ignorando acento e caixa, e pelo primeiro nome.
    expect(corpo.linhas[0]?.userId).toBe(maria?.id);
    expect(corpo.linhas[0]?.status).toBe('PRONTA');
    expect(corpo.linhas[1]?.userId).toBe(joao?.id);

    // Desconhecida: fica com quem está importando, com aviso.
    expect(corpo.linhas[2]?.userId).toBe(maria?.id);
    expect(corpo.linhas[2]?.status).toBe('AVISO');
    expect(corpo.linhas[2]?.avisos[0]).toBe('"Ana" não está na família; ficou no seu nome.');
  });

  it('reconhece a categoria pelo nome e não inventa quando não existe', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const { corpo } = await enviar(
      autorizacao,
      'gastos.xlsx',
      planilha([
        ['Local', 'Valor', 'Data', 'Categoria'],
        ['Supermercado', '10,00', '05/03/2024', 'Mercado'],
        ['Cinema', '20,00', '06/03/2024', 'Diversão'],
        ['Padaria', '30,00', '07/03/2024', ''],
      ]),
    );

    const mercado = await prisma.categoria.findFirstOrThrow({
      where: { householdId: sessao.usuario.householdId, nome: 'Mercado' },
    });

    expect(corpo.linhas[0]?.categoriaId).toBe(mercado.id);
    expect(corpo.linhas[1]?.categoriaId).toBeNull();
    expect(corpo.linhas[1]?.avisos[0]).toContain('"Diversão" não existe');
    // Sem categoria na planilha: fica sem categoria, sem reclamar.
    expect(corpo.linhas[2]?.categoriaId).toBeNull();
    expect(corpo.linhas[2]?.status).toBe('PRONTA');
  });

  it('marca possível duplicata e já deixa desmarcada', async () => {
    const { autorizacao } = await criarConta(app);
    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: { descricao: 'Supermercado', valorCentavos: 5000, data: '2024-03-05' },
    });

    const { corpo } = await enviar(
      autorizacao,
      'gastos.xlsx',
      planilha([
        ['Local', 'Valor', 'Data'],
        ['Supermercado', '50,00', '05/03/2024'],
        ['Supermercado', '50,00', '06/03/2024'],
        ['Padaria', '10,00', '07/03/2024'],
        ['Padaria', '10,00', '07/03/2024'],
      ]),
    );

    // Já existe no app.
    expect(corpo.linhas[0]?.status).toBe('AVISO');
    expect(corpo.linhas[0]?.incluir).toBe(false);
    expect(corpo.linhas[0]?.avisos[0]).toContain('Possível duplicata');
    // Data diferente: não é duplicata.
    expect(corpo.linhas[1]?.incluir).toBe(true);
    // Repetida dentro da própria planilha: a segunda vem desmarcada.
    expect(corpo.linhas[2]?.incluir).toBe(true);
    expect(corpo.linhas[3]?.incluir).toBe(false);
  });

  it('recusa arquivo que não é planilha', async () => {
    const { autorizacao } = await criarConta(app);
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/importacoes/analisar',
      headers: { ...autorizacao, 'content-type': `multipart/form-data; boundary=${LIMITE}` },
      payload: corpoMultipart('foto.png', Buffer.from('não é planilha')),
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json<{ erro: { mensagem: string } }>().erro.mensagem).toBe(
      'Esse tipo de arquivo não serve. Envie uma planilha .xlsx, .xls ou .csv.',
    );
  });

  it('lê .csv com ponto e vírgula', async () => {
    const { autorizacao } = await criarConta(app);
    const csv = 'Local;Valor;Data\nMercado;R$ 1.234,56;05/03/2024\nPadaria;15,50;06/03/2024\n';
    const { status, corpo } = await enviar(autorizacao, 'gastos.csv', Buffer.from(csv, 'utf8'));

    expect(status).toBe(201);
    expect(corpo.linhas).toHaveLength(2);
    expect(corpo.linhas[0]?.valorCentavos).toBe(123456);
  });
});

describe('POST /importacoes/:id/mapear', () => {
  it('deixa corrigir a coluna que foi detectada errado', async () => {
    const { autorizacao } = await criarConta(app);
    const { corpo } = await enviar(
      autorizacao,
      'gastos.xlsx',
      planilha([
        ['Coluna A', 'Coluna B', 'Coluna C'],
        ['Mercado', '100,00', '05/03/2024'],
      ]),
    );

    // Cabeçalho sem sentido: nada é detectado, e o app não adivinha.
    expect(corpo.mapeamento).toEqual({});
    expect(corpo.linhas[0]?.status).toBe('ERRO');

    const corrigida = await app.inject({
      method: 'POST',
      url: `/api/v1/importacoes/${corpo.importacaoId}/mapear`,
      headers: autorizacao,
      payload: { mapeamento: { descricao: 0, valor: 1, data: 2 } },
    });

    const previa = corrigida.json<PreviaImportacao>();
    expect(previa.linhas[0]?.status).toBe('PRONTA');
    expect(previa.linhas[0]?.descricao).toBe('Mercado');
    expect(previa.linhas[0]?.valorCentavos).toBe(10000);
    expect(previa.linhas[0]?.data).toBe('2024-03-05');
  });

  it('usa o mês de referência quando a planilha não tem data', async () => {
    const { autorizacao } = await criarConta(app);
    const { corpo } = await enviar(
      autorizacao,
      'gastos.xlsx',
      planilha([
        ['Local', 'Valor'],
        ['Mercado', '100,00'],
      ]),
    );

    // Sem data e sem mês informado, a linha não pode ser importada.
    expect(corpo.linhas[0]?.status).toBe('ERRO');
    expect(corpo.linhas[0]?.erros[0]).toContain('Escolha o mês de referência');

    const comMes = await app.inject({
      method: 'POST',
      url: `/api/v1/importacoes/${corpo.importacaoId}/mapear`,
      headers: autorizacao,
      payload: { mapeamento: corpo.mapeamento, mesReferencia: '2024-03' },
    });

    const previa = comMes.json<PreviaImportacao>();
    expect(previa.linhas[0]?.status).toBe('PRONTA');
    expect(previa.linhas[0]?.data).toBe('2024-03-01');
  });
});

describe('POST /importacoes/:id/confirmar', () => {
  it('grava só o que ficou marcado e o total bate com a planilha', async () => {
    const { autorizacao } = await criarConta(app);
    const { corpo } = await enviar(autorizacao, 'gastos.xlsx', planilha(PLANILHA_REAL));

    const aImportar = corpo.linhas
      .filter((linha) => linha.incluir)
      .map((linha) => ({
        linha: linha.linha,
        descricao: linha.descricao,
        valorCentavos: linha.valorCentavos,
        data: linha.data,
        categoriaId: linha.categoriaId,
        userId: linha.userId,
      }));

    const confirmacao = await app.inject({
      method: 'POST',
      url: `/api/v1/importacoes/${corpo.importacaoId}/confirmar`,
      headers: autorizacao,
      payload: { linhas: aImportar },
    });

    expect(confirmacao.statusCode).toBe(201);
    expect(confirmacao.json<{ linhasImportadas: number }>().linhasImportadas).toBe(5);

    const lista = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos?de=2024-03-01&ate=2024-03-31',
      headers: autorizacao,
    });
    const { itens, totalCentavos } = lista.json<ListaDeGastos>();
    expect(itens).toHaveLength(5);
    // O critério de aceitação: bate exatamente com a soma da planilha.
    expect(totalCentavos).toBe(SOMA_ESPERADA);

    // Os gastos ficam ligados à importação que os trouxe.
    const gravados = await prisma.gasto.findMany();
    expect(gravados.every((g) => g.origemImportacaoId === corpo.importacaoId)).toBe(true);

    // A planilha guardada é apagada depois de confirmar.
    const importacao = await prisma.importacao.findUniqueOrThrow({
      where: { id: corpo.importacaoId },
    });
    expect(importacao.status).toBe('CONFIRMADA');
    expect(importacao.dadosBrutos).toBeNull();
  });

  it('não grava nada antes de confirmar', async () => {
    const { autorizacao } = await criarConta(app);
    await enviar(autorizacao, 'gastos.xlsx', planilha(PLANILHA_REAL));
    expect(await prisma.gasto.count()).toBe(0);
  });

  it('cancelar apaga a planilha guardada sem criar gasto', async () => {
    const { autorizacao } = await criarConta(app);
    const { corpo } = await enviar(autorizacao, 'gastos.xlsx', planilha(PLANILHA_REAL));

    const cancelamento = await app.inject({
      method: 'DELETE',
      url: `/api/v1/importacoes/${corpo.importacaoId}`,
      headers: autorizacao,
    });

    expect(cancelamento.statusCode).toBe(204);
    expect(await prisma.gasto.count()).toBe(0);
    const importacao = await prisma.importacao.findUniqueOrThrow({
      where: { id: corpo.importacaoId },
    });
    expect(importacao.status).toBe('CANCELADA');
    expect(importacao.dadosBrutos).toBeNull();
  });

  it('não deixa importar para a família de outra pessoa', async () => {
    const casaA = await criarConta(app, { email: 'a@exemplo.com' });
    const casaB = await criarConta(app, { email: 'b@exemplo.com', nome: 'João Souza' });
    const { corpo } = await enviar(casaA.autorizacao, 'gastos.xlsx', planilha(PLANILHA_REAL));

    const tentativa = await app.inject({
      method: 'POST',
      url: `/api/v1/importacoes/${corpo.importacaoId}/confirmar`,
      headers: casaB.autorizacao,
      payload: {
        linhas: [
          {
            linha: 4,
            descricao: 'Invasão',
            valorCentavos: 100,
            data: '2024-03-05',
            userId: casaB.sessao.usuario.id,
          },
        ],
      },
    });

    expect(tentativa.statusCode).toBe(404);
  });
});

describe('GET /gastos/exportar', () => {
  it('devolve um .xlsx que o Excel abre, com os valores em reais', async () => {
    const { autorizacao } = await criarConta(app);
    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: { descricao: 'Supermercado', valorCentavos: 123456, data: '2024-03-05' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: { descricao: 'Estorno', valorCentavos: -4590, data: '2024-03-06' },
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos/exportar?formato=xlsx',
      headers: autorizacao,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-disposition']).toContain('attachment; filename="gastos-');

    const pasta = XLSX.read(resposta.rawPayload, { type: 'buffer' });
    const primeiraAba = pasta.SheetNames[0];
    const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      pasta.Sheets[primeiraAba ?? '']!,
    );

    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      Data: '05/03/2024',
      'Onde foi': 'Supermercado',
      Valor: 1234.56,
    });
    expect(linhas[1]?.Valor).toBe(-45.9);
  });

  it('exporta em csv respeitando o período', async () => {
    const { autorizacao } = await criarConta(app);
    for (const [descricao, data] of [
      ['Fevereiro', '2024-02-20'],
      ['Março', '2024-03-05'],
    ]) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/gastos',
        headers: autorizacao,
        payload: { descricao, valorCentavos: 1000, data },
      });
    }

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/gastos/exportar?formato=csv&de=2024-03-01&ate=2024-03-31',
      headers: autorizacao,
    });

    const texto = resposta.rawPayload.toString('utf8');
    expect(texto).toContain('Março');
    expect(texto).not.toContain('Fevereiro');
    expect(texto.split('\n')[0]).toContain(';'); // separador do Excel em português
  });
});
