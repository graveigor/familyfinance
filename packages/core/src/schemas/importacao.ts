import { z } from 'zod';
import { CAMPOS_IMPORTACAO } from '../importacao.js';
import { zDataISO, zId, zValorCentavos } from './comuns.js';
import { zDescricao, zFormaPagamento } from './gasto.js';

/** Índice da coluna escolhida para cada campo; `null` = "não usar". */
export const mapeamentoSchema = z.object(
  Object.fromEntries(
    CAMPOS_IMPORTACAO.map((campo) => [
      campo,
      z.coerce.number().int().min(0).max(200).nullable().optional(),
    ]),
  ) as Record<
    (typeof CAMPOS_IMPORTACAO)[number],
    z.ZodOptional<z.ZodNullable<z.ZodNumber>>
  >,
);

export const remapearSchema = z.object({
  mapeamento: mapeamentoSchema,
  /** `aaaa-mm` — usado quando a planilha não tem coluna de data. */
  mesReferencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Escolha o mês de referência.')
    .nullable()
    .optional(),
});

/** Linha como o usuário deixou depois de conferir e corrigir na tela. */
export const linhaConfirmadaSchema = z.object({
  linha: z.number().int().min(1),
  descricao: zDescricao,
  valorCentavos: zValorCentavos,
  data: zDataISO,
  categoriaId: zId.nullable().optional(),
  userId: zId,
  formaPagamento: zFormaPagamento.optional(),
});

export const confirmarImportacaoSchema = z.object({
  linhas: z
    .array(linhaConfirmadaSchema)
    .min(1, 'Selecione pelo menos uma linha para importar.')
    .max(5000, 'São no máximo 5.000 linhas por importação.'),
});

export type RemapearEntrada = z.infer<typeof remapearSchema>;
export type LinhaConfirmada = z.infer<typeof linhaConfirmadaSchema>;
export type ConfirmarImportacaoEntrada = z.infer<typeof confirmarImportacaoSchema>;
