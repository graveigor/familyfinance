import { z } from 'zod';
import {
  zDataISO,
  zId,
  zPagina,
  zPorPagina,
  zTextoOpcional,
  zValorCentavos,
} from './comuns.js';

/**
 * Receita: o que entra. O formulário é o do gasto menos o que não existe aqui
 * — não há forma de pagamento nem cartão num salário.
 */

export const zDescricaoDeReceita = z
  .string({ required_error: 'Informe de onde veio.' })
  .trim()
  .min(1, 'Informe de onde veio.')
  .max(120, 'Use no máximo 120 caracteres.');

export const criarReceitaSchema = z.object({
  descricao: zDescricaoDeReceita,
  valorCentavos: zValorCentavos,
  data: zDataISO,
  observacao: zTextoOpcional(500),
  categoriaId: zId.nullable().optional(),
  /** De quem é a entrada. Omitido = o próprio usuário logado. */
  userId: zId.optional(),
});

/** PATCH: todo campo é opcional, mas o corpo não pode vir vazio. */
export const atualizarReceitaSchema = z
  .object({
    descricao: zDescricaoDeReceita.optional(),
    valorCentavos: zValorCentavos.optional(),
    data: zDataISO.optional(),
    observacao: zTextoOpcional(500),
    categoriaId: zId.nullable().optional(),
    userId: zId.optional(),
  })
  .refine((dados) => Object.keys(dados).length > 0, { message: 'Nada para alterar.' });

export const listarReceitasSchema = z.object({
  de: zDataISO.optional(),
  ate: zDataISO.optional(),
  userId: zId.optional(),
  categoriaId: z.union([zId, z.literal('sem-categoria')]).optional(),
  busca: z.string().trim().max(120).optional(),
  pagina: zPagina,
  porPagina: zPorPagina,
});

export type CriarReceitaEntrada = z.infer<typeof criarReceitaSchema>;
export type AtualizarReceitaEntrada = z.infer<typeof atualizarReceitaSchema>;
export type ListarReceitasEntrada = z.infer<typeof listarReceitasSchema>;
