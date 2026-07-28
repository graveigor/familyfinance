import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';

/**
 * Roda uma vez antes da suíte: aplica as migrations no banco de teste.
 * O `.env.test` aponta para um banco separado, então nada aqui toca o de
 * desenvolvimento.
 */
export function setup(): void {
  process.env.NODE_ENV = 'test';
  config({ path: '.env.test', override: true });

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env },
  });
}
