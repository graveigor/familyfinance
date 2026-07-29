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
 */
import { spawnSync } from 'node:child_process';

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

console.log(
  direta
    ? 'Migrando pelo endereço direto do banco (sem pool), como a migração exige.'
    : 'Migrando pela DATABASE_URL.',
);

const resultado = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});

process.exit(resultado.status ?? 1);
