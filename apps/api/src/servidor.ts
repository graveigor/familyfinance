import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { ambiente, ehTeste } from './ambiente.js';
import { configurarAutenticacao } from './plugins/autenticacao.js';
import { configurarErros } from './plugins/erros.js';
import { rotasAuth } from './rotas/auth.js';
import { rotasCategorias } from './rotas/categorias.js';
import { rotasGastos } from './rotas/gastos.js';
import { rotasHousehold } from './rotas/household.js';
import { rotasImportacoes } from './rotas/importacoes.js';
import { rotasResumos } from './rotas/resumos.js';

const BASE = '/api/v1';

export async function criarServidor(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: ehTeste ? false : { level: 'info' },
    // O padrão do Fastify (99999) responde 400 com jargão; aqui a mensagem é nossa.
    bodyLimit: 5 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: ambiente.CORS_ORIGENS === '*' ? true : ambiente.CORS_ORIGENS.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Envio da planilha. O limite real é conferido na rota, com mensagem própria.
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });

  configurarErros(app);
  configurarAutenticacao(app);

  app.get('/saude', async () => ({ ok: true, versao: '0.1.0' }));

  await app.register(rotasAuth, { prefix: `${BASE}/auth` });
  await app.register(rotasGastos, { prefix: `${BASE}/gastos` });
  await app.register(rotasCategorias, { prefix: `${BASE}/categorias` });
  await app.register(rotasHousehold, { prefix: `${BASE}/household` });
  await app.register(rotasImportacoes, { prefix: `${BASE}/importacoes` });
  await app.register(rotasResumos, { prefix: `${BASE}/resumos` });

  return app;
}
