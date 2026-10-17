import { z } from 'zod';
import { MOEDAS } from '../dinheiro.js';
import { PAPEIS } from '../tipos.js';
import { zNome } from './comuns.js';

/**
 * Código de família no formato `FF-9A3K2M7`. Aceitamos o que a pessoa colar —
 * com ou sem o `FF-`, com espaços, em minúsculas — e normalizamos aqui, para
 * o código digitado do WhatsApp nunca falhar por formatação.
 *
 * Os núcleos de 5 continuam válidos: são os códigos gerados antes de o tamanho
 * mudar, e eles ainda estão na mão de gente esperando para entrar. Somem
 * sozinhos quando expirarem.
 */
/**
 * Quantos caracteres o servidor sorteia. Oito, e não cinco: com o alfabeto de
 * 31 letras, cinco davam 28,6 milhões de combinações — pouco para um código
 * que vale dias, serve para várias pessoas e pode ser tentado sem login. Oito
 * levam a 852 bilhões, ao custo de três caracteres a mais para digitar.
 */
export const TAMANHO_DO_NUCLEO_DO_CONVITE = 8;

const TAMANHOS_DO_NUCLEO = [TAMANHO_DO_NUCLEO_DO_CONVITE, 5];

export const zCodigoConvite = z
  .string({ required_error: 'Informe o código do grupo.' })
  .transform((bruto) => {
    const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Tirar o "FF" só quando o que sobra tem cara de núcleo. Sem essa conta,
    // um núcleo que por acaso comece com FF (e o F está no alfabeto) perderia
    // as duas primeiras letras e o código válido seria recusado.
    const semPrefixo = limpo.startsWith('FF') ? limpo.slice(2) : limpo;
    const nucleo = TAMANHOS_DO_NUCLEO.includes(semPrefixo.length) ? semPrefixo : limpo;
    return `FF-${nucleo}`;
  })
  .refine((codigo) => /^FF-([A-Z0-9]{8}|[A-Z0-9]{5})$/.test(codigo), {
    message: 'O código tem o formato FF-XXXXXXXX.',
  });

export const criarConviteSchema = z.object({
  /** Validade em dias; padrão de uma semana já cobre o caso real. */
  validadeDias: z.coerce.number().int().min(1).max(30).default(7),
});

export const entrarComConviteSchema = z.object({
  codigo: zCodigoConvite,
});

export const zMoeda = z.enum(MOEDAS, {
  errorMap: () => ({ message: 'Escolha uma moeda válida.' }),
});

export const atualizarHouseholdSchema = z
  .object({ nome: zNome.optional(), moeda: zMoeda.optional() })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para alterar.' });

export const atualizarMembroSchema = z.object({
  papel: z.enum(PAPEIS, { errorMap: () => ({ message: 'Escolha um papel válido.' }) }),
});

/** Meta exibida no Hub da Família, do grupo ou pessoal. */
export const criarMetaSchema = z.object({
  nome: zNome,
  /** Meta só sua, que ninguém do grupo vê. Padrão: meta da família. */
  pessoal: z.boolean().default(false),
  /** Alvo em centavos; opcional — "Viagem de férias" pode não ter valor ainda. */
  valorAlvoCentavos: z.coerce
    .number()
    .int('Informe um valor válido.')
    .positive('Informe um valor maior que zero.')
    .nullable()
    .optional(),
});

/** Criar um grupo novo (qualquer pessoa pode). */
export const criarGrupoSchema = z.object({
  nome: zNome,
  moeda: zMoeda.default('BRL'),
});

export type CriarMetaEntrada = z.infer<typeof criarMetaSchema>;
export type CriarGrupoEntrada = z.infer<typeof criarGrupoSchema>;
export type CriarConviteEntrada = z.infer<typeof criarConviteSchema>;
export type EntrarComConviteEntrada = z.infer<typeof entrarComConviteSchema>;
export type AtualizarHouseholdEntrada = z.infer<typeof atualizarHouseholdSchema>;
export type AtualizarMembroEntrada = z.infer<typeof atualizarMembroSchema>;
