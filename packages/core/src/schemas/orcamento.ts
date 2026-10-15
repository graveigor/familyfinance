import { z } from 'zod';
import { zAno, zId, zMes } from './comuns.js';

/**
 * O limite é um valor em centavos como qualquer outro dinheiro do app, mas
 * aqui ele PODE ser qualquer inteiro positivo — inclusive um valor redondo
 * grande, porque "Mercado até R$ 2.000" é um teto comum.
 */
export const zLimiteCentavos = z
  .number({ required_error: 'Informe o limite.', invalid_type_error: 'Informe um valor válido.' })
  .int('O limite precisa estar em centavos (número inteiro).')
  .min(1, 'O limite precisa ser maior que zero.')
  .max(100_000_000_00, 'Esse limite é alto demais. Confira se está certo.');

export const definirOrcamentoSchema = z.object({
  categoriaId: zId,
  limiteCentavos: zLimiteCentavos,
});

/** Sem ano/mês, o servidor usa o mês corrente. */
export const listarOrcamentosSchema = z.object({
  ano: zAno.optional(),
  mes: zMes.optional(),
});

export type DefinirOrcamentoEntrada = z.infer<typeof definirOrcamentoSchema>;
export type ListarOrcamentosEntrada = z.infer<typeof listarOrcamentosSchema>;
