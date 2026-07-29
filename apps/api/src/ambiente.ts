import { config } from 'dotenv';
import { z } from 'zod';

// Em teste lemos .env.test para nunca escrever no banco de desenvolvimento.
// Em servidor publicado não existe arquivo nenhum: as variáveis vêm do painel
// da hospedagem, e o dotenv simplesmente não acha nada — sem erro.
const arquivo = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
config({ path: arquivo });
config({ path: '.env', override: false });

/** Onde a pessoa deve corrigir: arquivo local ou painel da hospedagem. */
const ondeConfigurar = process.env.VERCEL
  ? 'nas variáveis de ambiente do projeto na Vercel'
  : `no arquivo ${arquivo}`;

const ambienteSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'Defina DATABASE_URL'),
  /**
   * Opcionais de propósito: sem eles o servidor gera os próprios segredos e
   * guarda no banco (ver `servicos/segredos.ts`), para publicar o app não
   * depender de colar chave em painel. Definidos, mandam eles.
   */
  JWT_SEGREDO: z.string().min(16, 'JWT_SEGREDO precisa de pelo menos 16 caracteres').optional(),
  JWT_SEGREDO_REFRESH: z
    .string()
    .min(16, 'JWT_SEGREDO_REFRESH precisa de pelo menos 16 caracteres')
    .optional(),
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
  throw new Error(`Configuração inválida ${ondeConfigurar}:\n${problemas}`);
}

export const ambiente = resultado.data;
export const ehProducao = ambiente.NODE_ENV === 'production';
export const ehTeste = ambiente.NODE_ENV === 'test';
