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
 * Duas armadilhas que este script evita, ambas descobertas na prática:
 *
 *  1. O comando é chamado da **raiz** do monorepo (`node apps/api/scripts/...`),
 *     mas o schema mora em `apps/api/prisma/`. Sem passar `--schema`, o Prisma
 *     procura em `./prisma/schema.prisma` a partir de onde foi chamado, não
 *     acha, e o build morre.
 *  2. Depender de `npx` significa depender do PATH do ambiente de build. Aqui
 *     procuramos o binário do Prisma que já está instalado e só caímos no `npx`
 *     se não acharmos nenhum.
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
const url = direta ?? process.env.DATABASE_URL;

if (!url) {
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
const argumentos = [
  ...(binario ? [] : ['prisma']),
  'migrate',
  'deploy',
  '--schema',
  SCHEMA,
];

console.log(
  direta
    ? 'Migrando pelo endereço direto do banco (sem pool), como a migração exige.'
    : 'Migrando pela DATABASE_URL.',
);
console.log(`Usando ${binario ?? 'npx prisma'} com o schema ${SCHEMA}`);

const resultado = spawnSync(comando, argumentos, {
  // `inherit` para a saída do Prisma aparecer ao vivo no log do build. Como a
  // saída não é capturada, `resultado.stderr` fica nulo de propósito: quando o
  // filho roda, o que ele escreve já apareceu acima; quando ele nem começa, a
  // informação está em `resultado.error`.
  stdio: 'inherit',
  cwd: RAIZ_DA_API,
  env: { ...process.env, DATABASE_URL: url },
});

if (resultado.error) {
  console.error('Não foi possível executar o Prisma:', resultado.error);
}
if (resultado.signal) {
  console.error(`O Prisma foi interrompido pelo sinal ${resultado.signal}.`);
}

// `status` é null quando o processo nem chegou a rodar; aí 1 é o certo.
process.exit(resultado.status ?? 1);
