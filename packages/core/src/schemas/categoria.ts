import { z } from 'zod';
import { zCor, zIcone } from './comuns.js';

export const zNomeCategoria = z
  .string({ required_error: 'Informe o nome da categoria.' })
  .trim()
  .min(2, 'O nome precisa ter pelo menos 2 letras.')
  .max(40, 'Use no máximo 40 caracteres.');

export const criarCategoriaSchema = z.object({
  nome: zNomeCategoria,
  icone: zIcone.default('etiqueta'),
  cor: zCor.default('#64748B'),
});

export const atualizarCategoriaSchema = z
  .object({
    nome: zNomeCategoria.optional(),
    icone: zIcone.optional(),
    cor: zCor.optional(),
  })
  .refine((dados) => Object.keys(dados).length > 0, { message: 'Nada para alterar.' });

export type CriarCategoriaEntrada = z.infer<typeof criarCategoriaSchema>;
export type AtualizarCategoriaEntrada = z.infer<typeof atualizarCategoriaSchema>;
