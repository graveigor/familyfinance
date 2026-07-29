import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { criarServidor } from '@gastos/api/servidor';

/**
 * A mesma API que roda na sua máquina, publicada como função da Vercel.
 *
 * A Vercel trata cada arquivo desta pasta `api/` como uma função. O
 * `vercel.json` manda todo `/api/*` para cá, e o Fastify continua cuidando das
 * rotas — nenhuma rota precisou ser reescrita.
 */

// A função fica viva entre requisições próximas. Guardar o servidor pronto
// evita reconstruir tudo (e reabrir o banco) a cada chamada.
let servidorPronto: Promise<FastifyInstance> | null = null;

function obterServidor(): Promise<FastifyInstance> {
  servidorPronto ??= criarServidor().then(async (app) => {
    await app.ready();
    return app;
  });
  return servidorPronto;
}

export default async function handler(
  requisicao: IncomingMessage,
  resposta: ServerResponse,
): Promise<void> {
  const app = await obterServidor();
  // Entrega a requisição ao Fastify sem abrir porta nenhuma: quem escuta a
  // rede aqui é a Vercel.
  app.server.emit('request', requisicao, resposta);
}
