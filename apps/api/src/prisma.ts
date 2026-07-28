import prismaPacote from '@prisma/client';
import { ambiente, ehTeste } from './ambiente.js';

// @prisma/client é CommonJS: importar o pacote inteiro e desestruturar é o que
// funciona de forma estável sob ESM/NodeNext.
const { PrismaClient } = prismaPacote;

export const prisma = new PrismaClient({
  log: ehTeste ? [] : ['warn', 'error'],
  datasources: { db: { url: ambiente.DATABASE_URL } },
});

export type Prisma = typeof prisma;
