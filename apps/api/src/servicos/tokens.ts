import { erroNaoAutenticado } from '@gastos/core';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { ambiente } from '../ambiente.js';

export interface ConteudoToken {
  sub: string;
  householdId: string;
  papel: 'ADMIN' | 'MEMBRO';
  tipo: 'acesso' | 'refresh';
}

/**
 * Dois segredos distintos: um refresh token não pode ser aceito como token de
 * acesso nem o contrário, mesmo que o campo `tipo` seja adulterado.
 */
export function gerarAccessToken(dados: Omit<ConteudoToken, 'tipo'>): string {
  const opcoes: SignOptions = { expiresIn: ambiente.JWT_EXPIRA_EM as SignOptions['expiresIn'] };
  return jwt.sign({ ...dados, tipo: 'acesso' }, ambiente.JWT_SEGREDO, opcoes);
}

export function gerarRefreshToken(dados: Omit<ConteudoToken, 'tipo'>): string {
  const opcoes: SignOptions = {
    expiresIn: ambiente.JWT_REFRESH_EXPIRA_EM as SignOptions['expiresIn'],
  };
  return jwt.sign({ ...dados, tipo: 'refresh' }, ambiente.JWT_SEGREDO_REFRESH, opcoes);
}

function verificar(token: string, segredo: string, tipo: ConteudoToken['tipo']): ConteudoToken {
  let conteudo: unknown;
  try {
    conteudo = jwt.verify(token, segredo);
  } catch {
    throw erroNaoAutenticado('Sua sessão expirou. Entre novamente para continuar.');
  }

  if (
    typeof conteudo !== 'object' ||
    conteudo === null ||
    !('sub' in conteudo) ||
    !('householdId' in conteudo) ||
    !('tipo' in conteudo)
  ) {
    throw erroNaoAutenticado();
  }

  const dados = conteudo as ConteudoToken;
  if (dados.tipo !== tipo) throw erroNaoAutenticado();
  return dados;
}

export const verificarAccessToken = (token: string): ConteudoToken =>
  verificar(token, ambiente.JWT_SEGREDO, 'acesso');

export const verificarRefreshToken = (token: string): ConteudoToken =>
  verificar(token, ambiente.JWT_SEGREDO_REFRESH, 'refresh');
