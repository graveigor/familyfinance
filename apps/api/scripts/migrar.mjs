/**
 * Roda as migrações do banco na publicação.
 *
 * Existe por causa de um detalhe do Neon (e de qualquer Postgres atrás de
 * PgBouncer): a `DATABASE_URL` que a hospedagem injeta aponta para o endereço
 * **com pool de conexões**. Consulta do dia a dia funciona muito bem assim, mas
 * migração não: ela precisa de bloqueio e de sessão fixa, e falha com erro
 * obscuro de "prepared statement already exists".
 *
 * O Neon também expõe o endereço direto (`DATABASE_URL_UNPOOLED`). Quando ele
 * existe, é o que usamos aqui — só para migrar. A aplicação continua usando o
 * endereço com pool.
 *
 * Armadilhas que este script evita, todas descobertas na prática:
 *
 *  1. O comando é chamado da **raiz** do monorepo (`node apps/api/scripts/...`),
 *     mas o schema mora em `apps/api/prisma/`. Sem passar `--schema`, o Prisma
 *     procura em `./prisma/schema.prisma` a partir de onde foi chamado, não
 *     acha, e o build morre.
 *  2. Depender de `npx` significa depender do PATH do ambiente de build. Aqui
 *     procuramos o binário do Prisma que já está instalado e só caímos no `npx`
 *     se não acharmos nenhum.
 *  3. Uma conexão que nunca recebe resposta (nem sucesso, nem recusa) trava o
 *     `spawnSync` para sempre, e a hospedagem mata o build em silêncio — sem
 *     nenhuma linha de erro, porque o processo nem chegou a escrever uma.
 *     Por isso: (a) a URL ganha `connect_timeout` se não tiver, para o driver
 *     desistir sozinho em vez de esperar o timeout do sistema operacional
 *     (que pode passar de um minuto); e (b) o próprio `spawnSync` tem um teto
 *     de tempo, como último recurso.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_DA_API = resolve(AQUI, '..');
const RAIZ_DO_REPO = resolve(RAIZ_DA_API, '../..');
const SCHEMA = join(RAIZ_DA_API, 'prisma', 'schema.prisma');

const DIRETAS = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DIRECT_URL'];

const direta = DIRETAS.map((nome) => process.env[nome]).find((valor) => valor);
const urlBruta = direta ?? process.env.DATABASE_URL;

if (!urlBruta) {
  console.error(
    'DATABASE_URL não está definida. Conecte um banco ao projeto na hospedagem ' +
      'ou preencha o .env para rodar localmente.',
  );
  process.exit(1);
}

if (!existsSync(SCHEMA)) {
  console.error(`Schema do Prisma não encontrado em ${SCHEMA}.`);
  process.exit(1);
}

/**
 * Garante `connect_timeout` e, fora do localhost, `sslmode=require` — sem
 * sobrescrever o que a pessoa já configurou. O Neon normalmente já manda
 * `sslmode=require` na string pronta; isto é só uma rede de segurança.
 *
 * Sem `connect_timeout`, uma rede que engole o pacote (em vez de recusar a
 * conexão) faz o driver esperar o timeout do sistema operacional — que pode
 * passar de um minuto — antes de desistir. Com ele, falha rápido e com uma
 * mensagem de erro de verdade.
 */
function comTimeoutDeConexao(urlOriginal) {
  let analisada;
  try {
    analisada = new URL(urlOriginal);
  } catch {
    // URL malformada: deixamos o Prisma reportar isso com o próprio erro dele.
    return { url: urlOriginal, host: null, avisos: ['A DATABASE_URL não é uma URL válida.'] };
  }

  const avisos = [];
  const local = ['localhost', '127.0.0.1', '::1'].includes(analisada.hostname);

  if (!analisada.searchParams.has('connect_timeout')) {
    analisada.searchParams.set('connect_timeout', '15');
  }
  if (!local && !analisada.searchParams.has('sslmode')) {
    analisada.searchParams.set('sslmode', 'require');
    avisos.push('A URL não tinha "sslmode"; adicionamos "require" (padrão do Neon).');
  }

  return { url: analisada.toString(), host: analisada.hostname, avisos };
}

const { url, host, avisos } = comTimeoutDeConexao(urlBruta);

/**
 * O binário do Prisma já instalado. Em monorepo com npm ele costuma ficar
 * hasteado na raiz, mas pode estar no pacote — procuramos nos dois.
 */
function acharPrisma() {
  const nome = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
  const candidatos = [
    join(RAIZ_DA_API, 'node_modules', '.bin', nome),
    join(RAIZ_DO_REPO, 'node_modules', '.bin', nome),
  ];
  return candidatos.find((caminho) => existsSync(caminho)) ?? null;
}

const binario = acharPrisma();
const comando = binario ?? 'npx';
const argumentos = [...(binario ? [] : ['prisma']), 'migrate', 'deploy', '--schema', SCHEMA];

// Nada de secreto aqui: só o host (sem usuário/senha) e se o endereço é o
// direto ou o de pool, para conferir contra o painel sem expor credencial.
console.log(
  direta
    ? 'Migrando pelo endereço direto do banco (sem pool), como a migração exige.'
    : 'Migrando pela DATABASE_URL (endereço direto não foi encontrado nas variáveis).',
);
console.log(`Host: ${host ?? '(não foi possível ler)'}`);
for (const aviso of avisos) console.log(`Aviso: ${aviso}`);
console.log(`Usando ${binario ?? 'npx prisma'} com o schema ${SCHEMA}`);
console.log(`Iniciando "prisma migrate deploy" às ${new Date().toISOString()}...`);

// Teto de 45s: se a conexão travar mesmo com `connect_timeout` na URL (por
// exemplo, se o Prisma não repassar o parâmetro), isto garante que o build
// termine com uma mensagem em vez de ficar preso até a hospedagem matar tudo
// em silêncio.
const LIMITE_MS = 45_000;

const resultado = spawnSync(comando, argumentos, {
  // `inherit` para a saída do Prisma aparecer ao vivo no log do build. Como a
  // saída não é capturada, `resultado.stderr` fica nulo de propósito: quando o
  // filho roda, o que ele escreve já apareceu acima; quando ele nem começa (ou
  // é morto pelo timeout abaixo), a informação está em `resultado.error`.
  stdio: 'inherit',
  cwd: RAIZ_DA_API,
  env: { ...process.env, DATABASE_URL: url },
  timeout: LIMITE_MS,
  killSignal: 'SIGKILL',
});

console.log(`"prisma migrate deploy" terminou às ${new Date().toISOString()}.`);

if (resultado.error?.code === 'ETIMEDOUT') {
  console.error(
    `A conexão travou por mais de ${LIMITE_MS / 1000}s sem resposta (nem sucesso, nem erro). ` +
      'Isso costuma ser rede bloqueando o caminho até o banco, ou o endereço direto do Neon ' +
      'apontando para o lugar errado. Confira se DATABASE_URL_UNPOOLED tem o mesmo host-base de ' +
      'DATABASE_URL (sem o sufixo "-pooler") e se ambos incluem "sslmode=require".',
  );
} else if (resultado.error) {
  console.error('Não foi possível executar o Prisma:', resultado.error);
}
if (resultado.signal && resultado.signal !== undefined && !resultado.error) {
  console.error(`O Prisma foi interrompido pelo sinal ${resultado.signal}.`);
}

// `status` é null quando o processo nem chegou a rodar (ou foi morto pelo
// timeout); aí 1 é o certo.
process.exit(resultado.status ?? 1);
