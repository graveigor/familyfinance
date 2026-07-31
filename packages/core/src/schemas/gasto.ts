import { z } from 'zod';
import { FORMAS_PAGAMENTO } from '../tipos.js';
import {
  zDataISO,
  zId,
  zPagina,
  zPorPagina,
  zTextoOpcional,
  zValorCentavos,
} from './comuns.js';

export const zFormaPagamento = z.enum(FORMAS_PAGAMENTO, {
  errorMap: () => ({ message: 'Escolha uma forma de pagamento válida.' }),
});

export const zDescricao = z
  .string({ required_error: 'Informe onde foi o gasto.' })
  .trim()
  .min(1, 'Informe onde foi o gasto.')
  .max(120, 'Use no máximo 120 caracteres.');

export const criarGastoSchema = z.object({
  descricao: zDescricao,
  valorCentavos: zValorCentavos,
  data: zDataISO,
  formaPagamento: zFormaPagamento.default('CARTAO'),
  observacao: zTextoOpcional(500),
  categoriaId: zId.nullable().optional(),
  /** Em qual cartão caiu. Omitido = nenhum cartão em especial. */
  cartaoId: zId.nullable().optional(),
  /** Quem gastou. Omitido = o próprio usuário logado. */
  userId: zId.optional(),
});

/** PATCH: todo campo é opcional, mas o corpo não pode vir vazio. */
export const atualizarGastoSchema = z
  .object({
    descricao: zDescricao.optional(),
    valorCentavos: zValorCentavos.optional(),
    data: zDataISO.optional(),
    formaPagamento: zFormaPagamento.optional(),
    observacao: zTextoOpcional(500),
    categoriaId: zId.nullable().optional(),
    cartaoId: zId.nullable().optional(),
    userId: zId.optional(),
  })
  .refine((dados) => Object.keys(dados).length > 0, {
    message: 'Nada para alterar.',
  });

export const listarGastosSchema = z.object({
  de: zDataISO.optional(),
  ate: zDataISO.optional(),
  userId: zId.optional(),
  categoriaId: z.union([zId, z.literal('sem-categoria')]).optional(),
  cartaoId: z.union([zId, z.literal('sem-cartao')]).optional(),
  busca: z.string().trim().max(120).optional(),
  pagina: zPagina,
  porPagina: zPorPagina,
});

export const exportarGastosSchema = z.object({
  formato: z.enum(['xlsx', 'csv']).default('xlsx'),
  de: zDataISO.optional(),
  ate: zDataISO.optional(),
});

export type CriarGastoEntrada = z.infer<typeof criarGastoSchema>;
export type AtualizarGastoEntrada = z.infer<typeof atualizarGastoSchema>;
export type ListarGastosEntrada = z.infer<typeof listarGastosSchema>;
export type ExportarGastosEntrada = z.infer<typeof exportarGastosSchema>;
