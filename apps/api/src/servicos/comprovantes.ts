import { erroValidacao } from '@gastos/core';

/**
 * Comprovantes ficam no banco, em tabela própria.
 *
 * Antes ficavam em disco, mas o servidor roda como função serverless, onde não
 * existe disco gravável nem permanente. Guardar no banco deixa um caminho de
 * código só, que funciona igual na máquina de casa e em produção.
 *
 * A tabela é separada da de gastos justamente para que listar o mês não arraste
 * as imagens junto (ver `model Comprovante`).
 */

const TIPOS_ACEITOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const;

/** 4 MB: cabe foto de nota fiscal de sobra e não estoura o banco. */
export const TAMANHO_MAXIMO_COMPROVANTE = 4 * 1024 * 1024;

export function conferirTipo(tipo: string): string {
  const limpo = tipo.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!TIPOS_ACEITOS.includes(limpo as (typeof TIPOS_ACEITOS)[number])) {
    throw erroValidacao(
      'Esse tipo de arquivo não serve como comprovante. Envie uma foto (JPG, PNG) ou um PDF.',
    );
  }
  return limpo;
}
