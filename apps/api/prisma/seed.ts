/**
 * Dados de demonstração para desenvolver a interface sem digitar tudo à mão.
 * Nunca rode em produção: apaga e recria o household de exemplo.
 */
import { CATEGORIAS_PADRAO, dataUTC, hoje } from '@gastos/core';
import prismaPacote from '@prisma/client';
import { config } from 'dotenv';
import { gerarHashSenha } from '../src/servicos/senha.js';

config();

const { PrismaClient } = prismaPacote;
const prisma = new PrismaClient();

const EMAIL_ADMIN = 'maria@exemplo.com';
const EMAIL_MEMBRO = 'joao@exemplo.com';

async function main(): Promise<void> {
  const existente = await prisma.user.findUnique({
    where: { email: EMAIL_ADMIN },
    select: { householdId: true },
  });
  if (existente) {
    await prisma.gasto.deleteMany({ where: { householdId: existente.householdId } });
    await prisma.convite.deleteMany({ where: { householdId: existente.householdId } });
    await prisma.categoria.deleteMany({ where: { householdId: existente.householdId } });
    await prisma.user.deleteMany({ where: { householdId: existente.householdId } });
    await prisma.household.delete({ where: { id: existente.householdId } });
  }

  const senhaHash = await gerarHashSenha('senha123');

  const household = await prisma.household.create({
    data: {
      nome: 'Família Exemplo',
      categorias: { create: CATEGORIAS_PADRAO.map((c) => ({ ...c })) },
      membros: {
        create: [
          { nome: 'Maria Silva', email: EMAIL_ADMIN, senhaHash, papel: 'ADMIN' },
          { nome: 'João Silva', email: EMAIL_MEMBRO, senhaHash, papel: 'MEMBRO' },
        ],
      },
    },
    include: { categorias: true, membros: true },
  });

  const categoria = (nome: string): string | null =>
    household.categorias.find((c) => c.nome === nome)?.id ?? null;
  const membro = (email: string): string =>
    household.membros.find((m) => m.email === email)?.id ?? household.membros[0]!.id;

  const referencia = hoje();
  const ano = referencia.getUTCFullYear();
  const mes = referencia.getUTCMonth() + 1;
  const mesPassado = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };

  const exemplos: Array<{
    descricao: string;
    valorCentavos: number;
    dia: number;
    categoria: string | null;
    email: string;
    forma: 'CARTAO' | 'DINHEIRO' | 'PIX' | 'BOLETO' | 'OUTRO';
    mesPassado?: boolean;
  }> = [
    { descricao: 'Supermercado Bom Preço', valorCentavos: 45890, dia: 2, categoria: 'Mercado', email: EMAIL_ADMIN, forma: 'CARTAO' },
    { descricao: 'Padaria da esquina', valorCentavos: 2350, dia: 3, categoria: 'Alimentação', email: EMAIL_MEMBRO, forma: 'DINHEIRO' },
    { descricao: 'Posto Ipiranga', valorCentavos: 20000, dia: 5, categoria: 'Transporte', email: EMAIL_ADMIN, forma: 'CARTAO' },
    { descricao: 'Farmácia São Paulo', valorCentavos: 8790, dia: 7, categoria: 'Saúde', email: EMAIL_MEMBRO, forma: 'PIX' },
    { descricao: 'Conta de luz', valorCentavos: 18450, dia: 10, categoria: 'Casa', email: EMAIL_ADMIN, forma: 'BOLETO' },
    { descricao: 'Cinema', valorCentavos: 6000, dia: 12, categoria: 'Lazer', email: EMAIL_MEMBRO, forma: 'CARTAO' },
    { descricao: 'Feira livre', valorCentavos: 7520, dia: 13, categoria: 'Mercado', email: EMAIL_ADMIN, forma: 'DINHEIRO' },
    { descricao: 'Material escolar', valorCentavos: 13200, dia: 15, categoria: 'Educação', email: EMAIL_MEMBRO, forma: 'CARTAO' },
    { descricao: 'Almoço restaurante', valorCentavos: 9800, dia: 4, categoria: 'Alimentação', email: EMAIL_ADMIN, forma: 'PIX', mesPassado: true },
    { descricao: 'Supermercado Bom Preço', valorCentavos: 51230, dia: 8, categoria: 'Mercado', email: EMAIL_ADMIN, forma: 'CARTAO', mesPassado: true },
    { descricao: 'Uber', valorCentavos: 3450, dia: 20, categoria: 'Transporte', email: EMAIL_MEMBRO, forma: 'CARTAO', mesPassado: true },
  ];

  await prisma.gasto.createMany({
    data: exemplos.map((exemplo) => {
      const alvo = exemplo.mesPassado ? mesPassado : { ano, mes };
      return {
        descricao: exemplo.descricao,
        valorCentavos: exemplo.valorCentavos,
        data: dataUTC(alvo.ano, alvo.mes, exemplo.dia),
        formaPagamento: exemplo.forma,
        categoriaId: categoria(exemplo.categoria ?? ''),
        userId: membro(exemplo.email),
        householdId: household.id,
      };
    }),
  });

  console.log(`Household "${household.nome}" criado com ${exemplos.length} gastos.`);
  console.log(`Entre com ${EMAIL_ADMIN} / senha123 (administradora)`);
  console.log(`ou com ${EMAIL_MEMBRO} / senha123 (membro).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
