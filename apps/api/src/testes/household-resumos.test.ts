import { fraseComparacaoMensal, type ResumoMensal, type Usuario } from '@gastos/core';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma.js';
import { criarConta, idDaCategoria, limparBanco, novoServidor } from './ajuda.js';

let app: FastifyInstance;

beforeEach(async () => {
  await limparBanco();
  app ??= await novoServidor();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

async function convidar(headers: { authorization: string }): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/v1/household/convites',
    headers,
    payload: {},
  });
  return resposta.json<{ codigo: string }>().codigo;
}

describe('household', () => {
  it('gera convite e o convidado entra na mesma família como membro', async () => {
    const admin = await criarConta(app, { email: 'admin@exemplo.com' });
    const codigo = await convidar(admin.autorizacao);
    expect(codigo).toHaveLength(6);

    const convidado = await criarConta(app, {
      email: 'joao@exemplo.com',
      nome: 'João Souza',
      codigoConvite: codigo,
    });

    expect(convidado.sessao.usuario.householdId).toBe(admin.sessao.usuario.householdId);
    expect(convidado.sessao.usuario.papel).toBe('MEMBRO');

    const membros = await app.inject({
      method: 'GET',
      url: '/api/v1/household/membros',
      headers: admin.autorizacao,
    });
    expect(membros.json<{ itens: Usuario[] }>().itens).toHaveLength(2);
  });

  it('não aceita o mesmo convite duas vezes', async () => {
    const admin = await criarConta(app, { email: 'admin@exemplo.com' });
    const codigo = await convidar(admin.autorizacao);
    await criarConta(app, { email: 'joao@exemplo.com', nome: 'João Souza', codigoConvite: codigo });

    const segunda = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/registrar',
      payload: {
        nome: 'Ana Souza',
        email: 'ana@exemplo.com',
        senha: 'senha-forte-123',
        codigoConvite: codigo,
      },
    });
    expect(segunda.statusCode).toBe(400);
  });

  it('membro comum não pode gerar convite', async () => {
    const admin = await criarConta(app, { email: 'admin@exemplo.com' });
    const codigo = await convidar(admin.autorizacao);
    const membro = await criarConta(app, {
      email: 'joao@exemplo.com',
      nome: 'João Souza',
      codigoConvite: codigo,
    });

    const tentativa = await app.inject({
      method: 'POST',
      url: '/api/v1/household/convites',
      headers: membro.autorizacao,
      payload: {},
    });
    expect(tentativa.statusCode).toBe(403);
  });

  it('não deixa a família ficar sem administrador', async () => {
    const admin = await criarConta(app, { email: 'admin@exemplo.com' });
    const resposta = await app.inject({
      method: 'PATCH',
      url: `/api/v1/household/membros/${admin.sessao.usuario.id}`,
      headers: admin.autorizacao,
      payload: { papel: 'MEMBRO' },
    });
    expect(resposta.statusCode).toBe(400);
  });
});

describe('GET /resumos/mensal', () => {
  it('soma o mês, agrupa por categoria e por pessoa e compara com o mês anterior', async () => {
    const admin = await criarConta(app, { email: 'admin@exemplo.com' });
    const codigo = await convidar(admin.autorizacao);
    const membro = await criarConta(app, {
      email: 'joao@exemplo.com',
      nome: 'João Souza',
      codigoConvite: codigo,
    });
    const mercado = await idDaCategoria(admin.sessao.usuario.householdId, 'Mercado');

    const lancar = async (
      headers: { authorization: string },
      valorCentavos: number,
      data: string,
      categoriaId?: string,
    ): Promise<void> => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/gastos',
        headers,
        payload: { descricao: 'Compra', valorCentavos, data, ...(categoriaId ? { categoriaId } : {}) },
      });
    };

    // Março: 100,00 + 50,00 (admin, mercado) e 30,50 (membro, sem categoria)
    await lancar(admin.autorizacao, 10000, '2024-03-01', mercado);
    await lancar(admin.autorizacao, 5000, '2024-03-31', mercado);
    await lancar(membro.autorizacao, 3050, '2024-03-15');
    // Fevereiro: 120,00
    await lancar(admin.autorizacao, 12000, '2024-02-20', mercado);

    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/resumos/mensal?ano=2024&mes=3',
      headers: admin.autorizacao,
    });

    const resumo = resposta.json<ResumoMensal>();
    expect(resumo.totalCentavos).toBe(18050);
    expect(resumo.quantidade).toBe(3);

    expect(resumo.porCategoria).toHaveLength(2);
    expect(resumo.porCategoria[0]?.categoria?.nome).toBe('Mercado');
    expect(resumo.porCategoria[0]?.totalCentavos).toBe(15000);
    expect(resumo.porCategoria[1]?.categoria).toBeNull();

    expect(resumo.porPessoa[0]?.usuario.nome).toBe('Maria Silva');
    expect(resumo.porPessoa[0]?.totalCentavos).toBe(15000);
    expect(resumo.porPessoa[1]?.totalCentavos).toBe(3050);

    expect(resumo.mesAnterior).toMatchObject({ ano: 2024, mes: 2, totalCentavos: 12000 });
    expect(resumo.mesAnterior.diferencaCentavos).toBe(6050);
    // O Intl usa espaço não separável depois de "R$"; normalizamos para comparar.
    expect(fraseComparacaoMensal(resumo).replace(/ /g, ' ')).toBe(
      'R$ 60,50 a mais que em fevereiro.',
    );
  });

  it('devolve zeros quando o mês não tem gasto', async () => {
    const { autorizacao } = await criarConta(app);
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/v1/resumos/mensal?ano=2024&mes=1',
      headers: autorizacao,
    });

    const resumo = resposta.json<ResumoMensal>();
    expect(resumo.totalCentavos).toBe(0);
    expect(resumo.porCategoria).toEqual([]);
    expect(fraseComparacaoMensal(resumo)).toBe('Primeiro mês com gastos registrados.');
  });
});
