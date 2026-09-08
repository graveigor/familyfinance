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
  /** Quando o token foi emitido, em segundos. O `jwt.sign` preenche sozinho. */
  iat: number;
}

/**
 * Dois segredos distintos: um refresh token não pode ser aceito como token de
 * acesso nem o contrário, mesmo que o campo `tipo` seja adulterado.
 */
export async function gerarAccessToken(dados: Omit<ConteudoToken, 'tipo' | 'iat'>): Promise<string> {
  const { acesso } = await obterSegredos();
  const opcoes: SignOptions = { expiresIn: ambiente.JWT_EXPIRA_EM as SignOptions['expiresIn'] };
  return jwt.sign({ ...dados, tipo: 'acesso' }, acesso, opcoes);
}

export async function gerarRefreshToken(dados: Omit<ConteudoToken, 'tipo' | 'iat'>): Promise<string> {
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
    !('tipo' in conteudo) ||
    // Sem `iat` não dá para saber se o token é anterior à última troca de
    // senha — e um token que não dá para invalidar não serve.
    !('iat' in conteudo)
  ) {
    throw erroNaoAutenticado();
  }

  const dados = conteudo as ConteudoToken;
  if (dados.tipo !== tipo) throw erroNaoAutenticado();
  return dados;
}

/**
 * Um token emitido antes da última troca de senha não vale mais.
 *
 * Sem isto, trocar a senha não expulsava ninguém: quem tivesse um refresh token
 * (30 dias de validade) seguia entrando e renovando o acesso indefinidamente —
 * exatamente a situação em que alguém troca a senha para se livrar de um
 * invasor e acredita ter resolvido.
 *
 * A comparação é em segundos porque é essa a precisão do `iat`. Arredondar a
 * troca para baixo também evita recusar o token que a própria troca de senha
 * acabou de emitir, quando as duas coisas caem no mesmo segundo.
 */
export function tokenAnteriorASenha(conteudo: ConteudoToken, senhaAlteradaEm: Date): boolean {
  return Math.floor(senhaAlteradaEm.getTime() / 1000) > conteudo.iat;
}

export async function verificarAccessToken(token: string): Promise<ConteudoToken> {
  const { acesso } = await obterSegredos();
  return verificar(token, acesso, 'acesso');
}

export async function verificarRefreshToken(token: string): Promise<ConteudoToken> {
  const { refresh } = await obterSegredos();
  return verificar(token, refresh, 'refresh');
}
