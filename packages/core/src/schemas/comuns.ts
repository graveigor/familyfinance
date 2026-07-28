import { z } from 'zod';

/**
 * Blocos reutilizados pelos demais schemas. Todas as mensagens são as que o
 * usuário final lê no formulário — por isso são frases, não códigos.
 */

export const zId = z.string().uuid({ message: 'Identificador inválido.' });

export const zNome = z
  .string({ required_error: 'Informe o nome.' })
  .trim()
  .min(2, 'O nome precisa ter pelo menos 2 letras.')
  .max(80, 'O nome pode ter no máximo 80 letras.');

export const zEmail = z
  .string({ required_error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .min(1, 'Informe o e-mail.')
  .email('Esse e-mail não parece válido.')
  .max(160, 'E-mail muito longo.');

export const zSenha = z
  .string({ required_error: 'Informe a senha.' })
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(200, 'Senha muito longa.');

/** Dinheiro no tráfego: inteiro em centavos, sempre. */
export const zValorCentavos = z
  .number({ required_error: 'Informe o valor.', invalid_type_error: 'Informe um valor válido.' })
  .int('O valor precisa estar em centavos (número inteiro).')
  .refine((v) => v !== 0, 'Informe um valor maior que zero.')
  .refine((v) => Math.abs(v) <= 100_000_000_00, 'Esse valor é alto demais. Confira se está certo.');

/** Data trafega como `aaaa-mm-dd`; hora não faz sentido para um gasto. */
export const zDataISO = z
  .string({ required_error: 'Informe a data.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use uma data no formato dia/mês/ano.')
  .refine((texto) => {
    const [ano, mes, dia] = texto.split('-').map(Number);
    if (ano === undefined || mes === undefined || dia === undefined) return false;
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return (
      data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
    );
  }, 'Essa data não existe no calendário.');

export const zPagina = z.coerce
  .number()
  .int()
  .min(1, 'Página inválida.')
  .default(1);

export const zPorPagina = z.coerce
  .number()
  .int()
  .min(1, 'Quantidade por página inválida.')
  .max(200, 'No máximo 200 itens por página.')
  .default(30);

export const zAno = z.coerce
  .number()
  .int()
  .min(2000, 'Ano inválido.')
  .max(2100, 'Ano inválido.');

export const zMes = z.coerce.number().int().min(1, 'Mês inválido.').max(12, 'Mês inválido.');

/** Hex de 6 dígitos, com `#`. */
export const zCor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor válida.');

export const zIcone = z
  .string()
  .trim()
  .min(1, 'Escolha um ícone.')
  .max(40, 'Nome de ícone muito longo.');

/** Campo de texto opcional que trata `""` como "não informado". */
export const zTextoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();
