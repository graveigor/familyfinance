import { z } from 'zod';
import { PAPEIS } from '../tipos.js';
import { zNome } from './comuns.js';

/**
 * Código de família no formato `FF-9A3K2`. Aceitamos o que a pessoa colar —
 * com ou sem o `FF-`, com espaços, em minúsculas — e normalizamos aqui, para
 * o código digitado do WhatsApp nunca falhar por formatação.
 */
export const zCodigoConvite = z
  .string({ required_error: 'Informe o código do grupo.' })
  .transform((bruto) => {
    const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const nucleo = limpo.startsWith('FF') && limpo.length > 5 ? limpo.slice(2) : limpo;
    return `FF-${nucleo}`;
  })
  .refine((codigo) => /^FF-[A-Z0-9]{5}$/.test(codigo), {
    message: 'O código tem o formato FF-XXXXX.',
  });

export const criarConviteSchema = z.object({
  /** Validade em dias; padrão de uma semana já cobre o caso real. */
  validadeDias: z.coerce.number().int().min(1).max(30).default(7),
});

export const entrarComConviteSchema = z.object({
  codigo: zCodigoConvite,
});

export const atualizarHouseholdSchema = z.object({
  nome: zNome,
});

export const atualizarMembroSchema = z.object({
  papel: z.enum(PAPEIS, { errorMap: () => ({ message: 'Escolha um papel válido.' }) }),
});

/** Meta conjunta do grupo, exibida no Hub da Família. */
export const criarMetaSchema = z.object({
  nome: zNome,
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
});

export type CriarMetaEntrada = z.infer<typeof criarMetaSchema>;
export type CriarGrupoEntrada = z.infer<typeof criarGrupoSchema>;
export type CriarConviteEntrada = z.infer<typeof criarConviteSchema>;
export type EntrarComConviteEntrada = z.infer<typeof entrarComConviteSchema>;
export type AtualizarHouseholdEntrada = z.infer<typeof atualizarHouseholdSchema>;
export type AtualizarMembroEntrada = z.infer<typeof atualizarMembroSchema>;
