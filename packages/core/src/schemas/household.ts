import { z } from 'zod';
import { PAPEIS } from '../tipos.js';
import { zNome } from './comuns.js';

export const zCodigoConvite = z
  .string({ required_error: 'Informe o código do convite.' })
  .trim()
  .toUpperCase()
  .length(6, 'O código de convite tem 6 caracteres.');

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

export type CriarConviteEntrada = z.infer<typeof criarConviteSchema>;
export type EntrarComConviteEntrada = z.infer<typeof entrarComConviteSchema>;
export type AtualizarHouseholdEntrada = z.infer<typeof atualizarHouseholdSchema>;
export type AtualizarMembroEntrada = z.infer<typeof atualizarMembroSchema>;
