import { z } from 'zod';
import { TIPOS_CARTAO } from '../tipos.js';
import { zCor } from './comuns.js';

/**
 * O apelido é livre de propósito: "Itaú", "Nubank da Ana", "Vale-refeição".
 * O tipo (crédito ou débito) é só uma etiqueta a mais — quem separa os gastos
 * é o cartão, não a bandeira.
 */
export const zNomeCartao = z
  .string({ required_error: 'Dê um nome ao cartão.' })
  .trim()
  .min(2, 'O nome precisa ter pelo menos 2 letras.')
  .max(40, 'Use no máximo 40 caracteres.');

export const zTipoCartao = z.enum(TIPOS_CARTAO, {
  errorMap: () => ({ message: 'Escolha entre crédito e débito.' }),
});

export const criarCartaoSchema = z.object({
  nome: zNomeCartao,
  tipo: zTipoCartao.default('CREDITO'),
  cor: zCor.default('#334155'),
});

export const atualizarCartaoSchema = z
  .object({
    nome: zNomeCartao.optional(),
    tipo: zTipoCartao.optional(),
    cor: zCor.optional(),
  })
  .refine((dados) => Object.keys(dados).length > 0, { message: 'Nada para alterar.' });

export type CriarCartaoEntrada = z.infer<typeof criarCartaoSchema>;
export type AtualizarCartaoEntrada = z.infer<typeof atualizarCartaoSchema>;
