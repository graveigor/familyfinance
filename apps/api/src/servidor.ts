import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
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

  /**
   * Freio nas rotas onde adivinhar vale a pena: senha em `/auth/login`, código
   * de convite em `/auth/registrar` e `/household/entrar`, e o custo de scrypt
   * de `/auth/esqueci-senha` (cada chamada queima ~60ms de CPU da função).
   *
   * Só nelas, e não no app inteiro: quem está lançando gasto e conferindo o
   * resumo faz muitas requisições legítimas seguidas, e a última coisa que se
   * quer é o app travar no meio do mês.
   *
   * Em função serverless o contador é por instância, então não é um teto
   * exato — mas corta a força bruta rápida, que é o ataque real.
   */
  await app.register(rateLimit, {
    global: false,
    max: 10,
    timeWindow: '1 minute',
    // Fora de produção o limite atrapalharia os testes e o uso na máquina de
    // quem desenvolve, que repete login o tempo todo.
    ...(ehProducao ? {} : { max: 10_000 }),
  });

  configurarErros(app);
  configurarAutenticacao(app);

  /**
   * Sinal de vida da API.
   *
   * Nos dois caminhos de propósito: publicado, só o que começa com `/api/`
   * chega até aqui — o `vercel.json` manda todo o resto para o `index.html` do
   * site, então `/saude` sozinho devolveria a página, e não este JSON. Na
   * máquina de quem desenvolve a API responde direto, e aí `/saude` é o
   * endereço curto de sempre.
   */
  const saude = async () => ({ ok: true, versao: '0.1.0' });
  app.get('/saude', saude);
  app.get('/api/saude', saude);

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
