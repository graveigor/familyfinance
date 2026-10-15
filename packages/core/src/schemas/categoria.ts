import { z } from 'zod';
import { TIPOS_DE_LANCAMENTO } from '../tipos.js';
import { zCor, zIcone } from './comuns.js';

export const zNomeCategoria = z
  .string({ required_error: 'Informe o nome da categoria.' })
  .trim()
  .min(2, 'O nome precisa ter pelo menos 2 letras.')
  .max(40, 'Use no máximo 40 caracteres.');

export const zTipoDeLancamento = z.enum(TIPOS_DE_LANCAMENTO, {
  errorMap: () => ({ message: 'Escolha entre despesa e receita.' }),
});

export const criarCategoriaSchema = z.object({
  nome: zNomeCategoria,
  icone: zIcone.default('etiqueta'),
  cor: zCor.default('#64748B'),
  /** Despesa por padrão: é o que quase toda categoria é. */
  tipo: zTipoDeLancamento.default('DESPESA'),
});

/** Filtro da listagem. Sem `tipo`, vêm as duas — é o que a tela de ajustes quer. */
export const listarCategoriasSchema = z.object({
  tipo: zTipoDeLancamento.optional(),
});

export const atualizarCategoriaSchema = z
  .object({
    nome: zNomeCategoria.optional(),
    icone: zIcone.optional(),
    cor: zCor.optional(),
  })
  .refine((dados) => Object.keys(dados).length > 0, { message: 'Nada para alterar.' });

export type CriarCategoriaEntrada = z.infer<typeof criarCategoriaSchema>;
export type ListarCategoriasEntrada = z.infer<typeof listarCategoriasSchema>;
export type AtualizarCategoriaEntrada = z.infer<typeof atualizarCategoriaSchema>;
