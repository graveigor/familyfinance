import { z } from 'zod';
import { zAno, zMes } from './comuns.js';

export const resumoMensalSchema = z.object({
  ano: zAno,
  mes: zMes,
});

/** Previsão: sem mês informado, o servidor assume o mês que vem. */
export const previsaoSchema = z.object({
  ano: zAno.optional(),
  mes: zMes.optional(),
});

export type ResumoMensalEntrada = z.infer<typeof resumoMensalSchema>;
export type PrevisaoEntrada = z.infer<typeof previsaoSchema>;
