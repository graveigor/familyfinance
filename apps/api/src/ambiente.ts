import { config } from 'dotenv';
import { z } from 'zod';

// Em teste lemos .env.test para nunca escrever no banco de desenvolvimento.
const arquivo = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
config({ path: arquivo });
config({ path: '.env', override: false });

const ambienteSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'Defina DATABASE_URL no arquivo .env'),
  JWT_SEGREDO: z.string().min(16, 'JWT_SEGREDO precisa de pelo menos 16 caracteres'),
  JWT_SEGREDO_REFRESH: z
    .string()
    .min(16, 'JWT_SEGREDO_REFRESH precisa de pelo menos 16 caracteres'),
  /** Vida do access token (curta) e do refresh token (longa). */
  JWT_EXPIRA_EM: z.string().default('15m'),
  JWT_REFRESH_EXPIRA_EM: z.string().default('30d'),
  /** Origens liberadas no CORS, separadas por vírgula. `*` libera todas. */
  CORS_ORIGENS: z.string().default('*'),
});

const resultado = ambienteSchema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Configuração inválida em ${arquivo}:\n${problemas}`);
}

export const ambiente = resultado.data;
export const ehProducao = ambiente.NODE_ENV === 'production';
export const ehTeste = ambiente.NODE_ENV === 'test';
