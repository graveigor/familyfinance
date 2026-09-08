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
  /**
   * Chave que cifra os dados pessoais no banco (nome, e-mail, comprovantes).
   *
   * Obrigatória, e sem irmã guardada no banco como a do JWT: a graça é
   * justamente ela não estar lá. 32 bytes em hexadecimal; gere com
   * `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   *
   * Trocar esta chave torna ilegível o que já foi gravado com a anterior.
   */
  CHAVE_CRIPTOGRAFIA: z
    .string({ required_error: 'Defina CHAVE_CRIPTOGRAFIA' })
    .regex(
      /^[0-9a-fA-F]{64}$/,
      'CHAVE_CRIPTOGRAFIA precisa ter 64 caracteres hexadecimais (32 bytes). Gere com: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    ),
  /** Vida do access token (curta) e do refresh token (longa). */
  JWT_EXPIRA_EM: z.string().default('15m'),
  JWT_REFRESH_EXPIRA_EM: z.string().default('30d'),
  /** Origens liberadas no CORS, separadas por vírgula. `*` libera todas. */
  CORS_ORIGENS: z.string().default('*'),
  /**
   * Envio de e-mail (Resend). Sem a chave o servidor não manda nada: fora de
   * produção o código de recuperação sai no log, para dar para testar sem
   * contratar provedor. Em produção, sem chave, o pedido falha em vez de
   * fingir que enviou.
   */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_REMETENTE: z.string().default('Family Finance <onboarding@resend.dev>'),
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
