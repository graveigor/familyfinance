import { z } from 'zod';
import { zDataISO, zId, zTextoOpcional, zValorCentavos } from './comuns.js';
import { zDescricao, zFormaPagamento } from './gasto.js';

/**
 * Gasto que se repete todo mês. O dia 31 é aceito de propósito: em fevereiro
 * o lançamento cai no último dia do mês, que é o que a pessoa espera de uma
 * conta "todo dia 31".
 */
export const zDiaDoMes = z.coerce
  .number({ required_error: 'Informe o dia do mês.' })
  .int('Informe um dia válido.')
  .min(1, 'O dia precisa ser entre 1 e 31.')
  .max(31, 'O dia precisa ser entre 1 e 31.');

export const criarRecorrenciaSchema = z.object({
  descricao: zDescricao,
  valorCentavos: zValorCentavos,
  diaDoMes: zDiaDoMes,
  formaPagamento: zFormaPagamento.default('OUTRO'),
  observacao: zTextoOpcional(500),
  categoriaId: zId.nullable().optional(),
  cartaoId: zId.nullable().optional(),
  userId: zId.optional(),
  /** Primeiro mês em que vale. Padrão: o mês atual. */
  inicioEm: zDataISO.optional(),
  fimEm: zDataISO.nullable().optional(),
});

export const atualizarRecorrenciaSchema = z
  .object({
    descricao: zDescricao.optional(),
    valorCentavos: zValorCentavos.optional(),
    diaDoMes: zDiaDoMes.optional(),
    formaPagamento: zFormaPagamento.optional(),
    observacao: zTextoOpcional(500),
    categoriaId: zId.nullable().optional(),
    cartaoId: zId.nullable().optional(),
    userId: zId.optional(),
    fimEm: zDataISO.nullable().optional(),
    ativa: z.boolean().optional(),
  })
  .refine((dados) => Object.keys(dados).length > 0, { message: 'Nada para alterar.' });

export type CriarRecorrenciaEntrada = z.infer<typeof criarRecorrenciaSchema>;
export type AtualizarRecorrenciaEntrada = z.infer<typeof atualizarRecorrenciaSchema>;

/** Quantos meses o gráfico de evolução mostra. */
export const evolucaoSchema = z.object({
  meses: z.coerce.number().int().min(2).max(24).default(6),
});

export type EvolucaoEntrada = z.infer<typeof evolucaoSchema>;
