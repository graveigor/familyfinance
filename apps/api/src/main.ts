import { ambiente } from './ambiente.js';
import { prisma } from './prisma.js';
import { criarServidor } from './servidor.js';

const app = await criarServidor();

async function encerrar(sinal: string): Promise<void> {
  app.log.info(`Recebido ${sinal}, encerrando...`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void encerrar('SIGINT'));
process.on('SIGTERM', () => void encerrar('SIGTERM'));

try {
  await app.listen({ port: ambiente.PORT, host: ambiente.HOST });
} catch (erro) {
  app.log.error(erro);
  process.exit(1);
}
