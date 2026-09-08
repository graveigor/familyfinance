import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { ambiente, ehProducao, ehTeste } from './ambiente.js';
import { configurarAutenticacao } from './plugins/autenticacao.js';
import { configurarErros } from './plugins/erros.js';
import { rotasAuth } from './rotas/auth.js';
import { rotasCartoes } from './rotas/cartoes.js';
import { rotasCategorias } from './rotas/categorias.js';
import { rotasGastos } from './rotas/gastos.js';
import { rotasHousehold } from './rotas/household.js';
import { rotasImportacoes } from './rotas/importacoes.js';
import { rotasRecorrencias } from './rotas/recorrencias.js';
import { rotasResumos } from './rotas/resumos.js';

const BASE = '/api/v1';

export async function criarServidor(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: ehTeste ? false : { level: 'info' },
    // O padrão do Fastify (99999) responde 400 com jargão; aqui a mensagem é nossa.
    bodyLimit: 5 * 1024 * 1024,
  });

  // Em produção o site e a API saem do mesmo domínio (ver `vercel.json`), então
  // não é preciso liberar origem nenhuma. O `*` com `credentials: true` refletia
  // qualquer origem que perguntasse — hoje isso não dá acesso a nada, porque a
  // sessão vive no `localStorage` e não em cookie, mas é uma porta aberta sem
  // ninguém para passar por ela. Fora de produção continua liberado, senão
  // desenvolver com o app em outra porta vira briga com o navegador.
  const origensLiberadas =
    ambiente.CORS_ORIGENS === '*'
      ? !ehProducao
      : ambiente.CORS_ORIGENS.split(',').map((o) => o.trim());

  await app.register(cors, { origin: origensLiberadas, credentials: true });

  // Envio da planilha. O limite real é conferido na rota, com mensagem própria.
  await app.register(multipart, {
    // Abaixo do teto de 4,5 MB da função serverless.
    limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  });

  configurarErros(app);
  configurarAutenticacao(app);

  app.get('/saude', async () => ({ ok: true, versao: '0.1.0' }));

  await app.register(rotasAuth, { prefix: `${BASE}/auth` });
  await app.register(rotasGastos, { prefix: `${BASE}/gastos` });
  await app.register(rotasCategorias, { prefix: `${BASE}/categorias` });
  await app.register(rotasCartoes, { prefix: `${BASE}/cartoes` });
  await app.register(rotasHousehold, { prefix: `${BASE}/household` });
  await app.register(rotasImportacoes, { prefix: `${BASE}/importacoes` });
  await app.register(rotasRecorrencias, { prefix: `${BASE}/recorrencias` });
  await app.register(rotasResumos, { prefix: `${BASE}/resumos` });

  return app;
}
