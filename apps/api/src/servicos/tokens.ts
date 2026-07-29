import { erroNaoAutenticado } from '@gastos/core';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { ambiente } from '../ambiente.js';
import { obterSegredos } from './segredos.js';

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
export async function gerarAccessToken(dados: Omit<ConteudoToken, 'tipo'>): Promise<string> {
  const { acesso } = await obterSegredos();
  const opcoes: SignOptions = { expiresIn: ambiente.JWT_EXPIRA_EM as SignOptions['expiresIn'] };
  return jwt.sign({ ...dados, tipo: 'acesso' }, acesso, opcoes);
}

export async function gerarRefreshToken(dados: Omit<ConteudoToken, 'tipo'>): Promise<string> {
  const { refresh } = await obterSegredos();
  const opcoes: SignOptions = {
    expiresIn: ambiente.JWT_REFRESH_EXPIRA_EM as SignOptions['expiresIn'],
  };
  return jwt.sign({ ...dados, tipo: 'refresh' }, refresh, opcoes);
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

export async function verificarAccessToken(token: string): Promise<ConteudoToken> {
  const { acesso } = await obterSegredos();
  return verificar(token, acesso, 'acesso');
}

export async function verificarRefreshToken(token: string): Promise<ConteudoToken> {
  const { refresh } = await obterSegredos();
  return verificar(token, refresh, 'refresh');
}
