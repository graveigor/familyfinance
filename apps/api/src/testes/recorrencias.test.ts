import { dataUTC, type Evolucao, type ListaDeGastos, type Recorrencia } from '@gastos/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { diaValidoNoMes, gerarPendentes } from '../servicos/recorrencias.js';
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

async function criarRecorrencia(
  headers: { authorization: string },
  dados: Record<string, unknown> = {},
): Promise<Recorrencia & { proximoEm: string | null }> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/recorrencias',
    headers,
    payload: {
      descricao: 'Aluguel',
      valorCentavos: 180000,
      diaDoMes: 10,
      inicioEm: '2026-01-01',
      ...dados,
    },
  });
  if (resposta.statusCode !== 201) throw new Error(resposta.body);
  return resposta.json();
}

describe('diaValidoNoMes', () => {
  it('encaixa o dia 31 no último dia do mês curto', () => {
    expect(diaValidoNoMes(2026, 1, 31)).toBe(31);
    expect(diaValidoNoMes(2026, 2, 31)).toBe(28);
    expect(diaValidoNoMes(2024, 2, 31)).toBe(29); // bissexto
    expect(diaValidoNoMes(2026, 4, 31)).toBe(30);
    expect(diaValidoNoMes(2026, 4, 5)).toBe(5);
  });
});

describe('gastos recorrentes', () => {
  it('cria o lançamento do mês atual assim que a conta fixa é cadastrada', async () => {
    const { autorizacao } = await criarConta(app);
    await criarRecorrencia(autorizacao, { inicioEm: undefined });

    const gastos = await prisma.gasto.findMany();
    expect(gastos.length).toBeGreaterThanOrEqual(1);
    expect(gastos[0]?.descricao).toBe('Aluguel');
    expect(gastos[0]?.valorCentavos).toBe(180000);
    // Fica ligado à recorrência que o criou.
    expect(gastos[0]?.recorrenciaId).toBeTruthy();
  });

  it('gera os meses que faltaram, um por mês, e nunca o mês futuro', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    await criarRecorrencia(autorizacao, { inicioEm: '2026-01-01', diaDoMes: 10 });

    // Zera o que a criação já gerou para exercitar a geração do zero.
    await prisma.gasto.deleteMany();
    await prisma.recorrencia.updateMany({ data: { ultimoMesGerado: null } });

    // Referência: 15/04/2026 — devem sair janeiro, fevereiro, março e abril.
    const resultado = await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 4, 15));
    expect(resultado.gastosCriados).toBe(4);

    const gastos = await prisma.gasto.findMany({ orderBy: { data: 'asc' } });
    expect(gastos.map((g) => g.data.toISOString().slice(0, 10))).toEqual([
      '2026-01-10',
      '2026-02-10',
      '2026-03-10',
      '2026-04-10',
    ]);
  });

  it('não duplica quando a geração roda de novo', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    await criarRecorrencia(autorizacao, { inicioEm: '2026-01-01' });
    await prisma.gasto.deleteMany();
    await prisma.recorrencia.updateMany({ data: { ultimoMesGerado: null } });

    await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 3, 20));
    const depoisDaPrimeira = await prisma.gasto.count();

    // Três chamadas seguidas: o total não pode mexer.
    await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 3, 20));
    await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 3, 20));

    expect(await prisma.gasto.count()).toBe(depoisDaPrimeira);
    expect(depoisDaPrimeira).toBe(3);
  });

  it('encaixa "todo dia 31" no último dia de fevereiro', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    await criarRecorrencia(autorizacao, { diaDoMes: 31, inicioEm: '2026-01-01' });
    await prisma.gasto.deleteMany();
    await prisma.recorrencia.updateMany({ data: { ultimoMesGerado: null } });

    await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 3, 1));

    const gastos = await prisma.gasto.findMany({ orderBy: { data: 'asc' } });
    expect(gastos.map((g) => g.data.toISOString().slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('para de gerar depois da data de término', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    await criarRecorrencia(autorizacao, {
      inicioEm: '2026-01-01',
      fimEm: '2026-02-28',
      diaDoMes: 10,
    });
    await prisma.gasto.deleteMany();
    await prisma.recorrencia.updateMany({ data: { ultimoMesGerado: null } });

    await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 6, 1));
    expect(await prisma.gasto.count()).toBe(2);
  });

  it('conta fixa desativada não gera mais nada', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const recorrencia = await criarRecorrencia(autorizacao, { inicioEm: '2026-01-01' });

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/recorrencias/${recorrencia.id}`,
      headers: autorizacao,
      payload: { ativa: false },
    });

    await prisma.gasto.deleteMany();
    const resultado = await gerarPendentes(sessao.usuario.householdId, dataUTC(2026, 6, 1));
    expect(resultado.gastosCriados).toBe(0);
  });

  it('apagar a conta fixa mantém os gastos já lançados', async () => {
    const { autorizacao } = await criarConta(app);
    const recorrencia = await criarRecorrencia(autorizacao, { inicioEm: undefined });
    const antes = await prisma.gasto.count();
    expect(antes).toBeGreaterThan(0);

    const exclusao = await app.inject({
      method: 'DELETE',
      url: `/api/v1/recorrencias/${recorrencia.id}`,
      headers: autorizacao,
    });

    expect(exclusao.statusCode).toBe(200);
    expect(exclusao.json<{ gastosMantidos: number }>().gastosMantidos).toBe(antes);
    // Os gastos continuam lá, só perdem o vínculo.
    expect(await prisma.gasto.count()).toBe(antes);
    expect(await prisma.recorrencia.count()).toBe(0);
  });

  it('não mostra conta fixa de outra família', async () => {
    const casaA = await criarConta(app, { email: 'a@exemplo.com' });
    await criarRecorrencia(casaA.autorizacao);
    const casaB = await criarConta(app, { email: 'b@exemplo.com', nome: 'João Souza' });

    const lista = await app.inject({
      method: 'GET',
      url: '/api/v1/recorrencias',
      headers: casaB.autorizacao,
    });
    expect(lista.json<{ itens: Recorrencia[] }>().itens).toHaveLength(0);
  });
});

describe('GET /resumos/evolucao', () => {
  it('devolve um ponto por mês, incluindo os meses sem gasto', async () => {
    const { autorizacao } = await criarConta(app);

    const agora = new Date();
    const ano = agora.getUTCFullYear();
    const mes = agora.getUTCMonth() + 1;
    const data = `${ano}-${String(mes).padStart(2, '0')}-05`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers: autorizacao,
      payload: { descricao: 'Mercado', valorCentavos: 10000, data },
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/resumos/evolucao?meses=6',
      headers: autorizacao,
    });

    const evolucao = resposta.json<Evolucao>();
    expect(evolucao.pontos).toHaveLength(6);
    // O último ponto é sempre o mês atual.
    expect(evolucao.pontos[5]).toMatchObject({ ano, mes, totalCentavos: 10000 });
    expect(evolucao.pontos[0]?.totalCentavos).toBe(0);
    // A média ignora meses sem gasto — senão daria 1.666 em vez de 10.000.
    expect(evolucao.mediaCentavos).toBe(10000);
    expect(evolucao.maiorCentavos).toBe(10000);
    expect(evolucao.pontos[5]?.rotulo).toHaveLength(3);
  });
});

describe('comprovante', () => {
  const LIMITE = '----------------------------teste123';
  // PNG 1×1 válido, para exercitar o caminho inteiro sem depender de arquivo.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  function corpo(nomeArquivo: string, conteudo: Buffer, tipo: string): Buffer {
    return Buffer.concat([
      Buffer.from(
        `--${LIMITE}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nomeArquivo}"\r\nContent-Type: ${tipo}\r\n\r\n`,
        'utf8',
      ),
      conteudo,
      Buffer.from(`\r\n--${LIMITE}--\r\n`, 'utf8'),
    ]);
  }

  async function novoGasto(headers: { authorization: string }): Promise<string> {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/v1/gastos',
      headers,
      payload: { descricao: 'Farmácia', valorCentavos: 5000, data: '2026-03-10' },
    });
    return resposta.json<{ id: string }>().id;
  }

  it('anexa, devolve e remove o comprovante', async () => {
    const { autorizacao } = await criarConta(app);
    const id = await novoGasto(autorizacao);

    const envio = await app.inject({
      method: 'PUT',
      url: `/api/v1/gastos/${id}/comprovante`,
      headers: { ...autorizacao, 'content-type': `multipart/form-data; boundary=${LIMITE}` },
      payload: corpo('foto.png', PNG, 'image/png'),
    });

    expect(envio.statusCode).toBe(200);
    expect(envio.json<{ temComprovante: boolean }>().temComprovante).toBe(true);

    const download = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${id}/comprovante`,
      headers: autorizacao,
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('image/png');
    expect(download.rawPayload.equals(PNG)).toBe(true);

    const remocao = await app.inject({
      method: 'DELETE',
      url: `/api/v1/gastos/${id}/comprovante`,
      headers: autorizacao,
    });
    expect(remocao.statusCode).toBe(204);

    const depois = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${id}/comprovante`,
      headers: autorizacao,
    });
    expect(depois.statusCode).toBe(404);
  });

  it('recusa tipo de arquivo que não é comprovante', async () => {
    const { autorizacao } = await criarConta(app);
    const id = await novoGasto(autorizacao);

    const envio = await app.inject({
      method: 'PUT',
      url: `/api/v1/gastos/${id}/comprovante`,
      headers: { ...autorizacao, 'content-type': `multipart/form-data; boundary=${LIMITE}` },
      payload: corpo('virus.exe', Buffer.from('MZ'), 'application/x-msdownload'),
    });

    expect(envio.statusCode).toBe(400);
    expect(envio.json<{ erro: { mensagem: string } }>().erro.mensagem).toContain(
      'Envie uma foto (JPG, PNG) ou um PDF',
    );
  });

  it('não entrega comprovante de outra família', async () => {
    const casaA = await criarConta(app, { email: 'a@exemplo.com' });
    const casaB = await criarConta(app, { email: 'b@exemplo.com', nome: 'João Souza' });
    const id = await novoGasto(casaA.autorizacao);

    await app.inject({
      method: 'PUT',
      url: `/api/v1/gastos/${id}/comprovante`,
      headers: { ...casaA.autorizacao, 'content-type': `multipart/form-data; boundary=${LIMITE}` },
      payload: corpo('foto.png', PNG, 'image/png'),
    });

    const tentativa = await app.inject({
      method: 'GET',
      url: `/api/v1/gastos/${id}/comprovante`,
      headers: casaB.autorizacao,
    });
    expect(tentativa.statusCode).toBe(404);
  });

  it('excluir o gasto leva o comprovante junto', async () => {
    const { autorizacao, sessao } = await criarConta(app);
    const id = await novoGasto(autorizacao);

    await app.inject({
      method: 'PUT',
      url: `/api/v1/gastos/${id}/comprovante`,
      headers: { ...autorizacao, 'content-type': `multipart/form-data; boundary=${LIMITE}` },
      payload: corpo('foto.png', PNG, 'image/png'),
    });

    const { comprovante } = await prisma.gasto.findUniqueOrThrow({
      where: { id },
      select: { comprovante: true },
    });
    expect(comprovante).toBeTruthy();

    await app.inject({ method: 'DELETE', url: `/api/v1/gastos/${id}`, headers: autorizacao });

    const { existsSync } = await import('node:fs');
    const { caminhoDoComprovante } = await import('../servicos/comprovantes.js');
    expect(existsSync(caminhoDoComprovante(sessao.usuario.householdId, comprovante!))).toBe(false);
  });
});
