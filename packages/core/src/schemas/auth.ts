import { z } from 'zod';
import { zEmail, zNome, zSenha } from './comuns.js';

/**
 * Registro cobre os dois caminhos possíveis:
 *  - primeiro da casa: informa (ou não) o nome da família e vira ADMIN;
 *  - convidado: informa o código recebido e entra na família existente.
 */
export const registrarSchema = z.object({
  nome: zNome,
  email: zEmail,
  senha: zSenha,
  nomeHousehold: zNome.optional(),
  codigoConvite: z
    .string()
    .trim()
    .toUpperCase()
    .length(6, 'O código de convite tem 6 caracteres.')
    .optional(),
});

export const loginSchema = z.object({
  email: zEmail,
  senha: z.string({ required_error: 'Informe a senha.' }).min(1, 'Informe a senha.'),
});

export const refreshSchema = z.object({
  refreshToken: z.string({ required_error: 'Sessão inválida.' }).min(1, 'Sessão inválida.'),
});

export const atualizarPerfilSchema = z
  .object({
    nome: zNome.optional(),
    senhaAtual: z.string().min(1, 'Informe a senha atual.').optional(),
    novaSenha: zSenha.optional(),
  })
  .refine((dados) => !dados.novaSenha || Boolean(dados.senhaAtual), {
    message: 'Informe a senha atual para trocar de senha.',
    path: ['senhaAtual'],
  });

export type RegistrarEntrada = z.infer<typeof registrarSchema>;
export type LoginEntrada = z.infer<typeof loginSchema>;
export type RefreshEntrada = z.infer<typeof refreshSchema>;
export type AtualizarPerfilEntrada = z.infer<typeof atualizarPerfilSchema>;
