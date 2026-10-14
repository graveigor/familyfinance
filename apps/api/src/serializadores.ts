import {
  formatarDataISO,
  type Cartao,
  type Categoria,
  type Moeda,
  type Gasto,
  type Usuario,
} from '@gastos/core';
import type {
  Cartao as CartaoDb,
  Categoria as CategoriaDb,
  Gasto as GastoDb,
  User as UserDb,
} from '@prisma/client';
import { decifrar } from './servicos/criptografia.js';

/**
 * Converte as linhas do banco para o contrato público da API.
 * `data` sai como `aaaa-mm-dd` (dia de calendário, sem hora nem fuso);
 * os demais instantes saem em ISO completo.
 *
 * É também onde o nome e o e-mail voltam a ser legíveis: no banco eles estão
 * cifrados (ver `servicos/criptografia.ts`). Tudo o que sai para o cliente
 * passa por aqui, então decifrar neste ponto cobre a API inteira.
 */

/** O nome de quem lançou, legível. Usado onde o gasto carrega o autor junto. */
export function nomeDoUsuario(usuario: Pick<UserDb, 'nome'>): string {
  return decifrar(usuario.nome);
}

export function serializarCategoria(categoria: CategoriaDb): Categoria {
  return {
    id: categoria.id,
    nome: categoria.nome,
    icone: categoria.icone,
    cor: categoria.cor,
  };
}

export function serializarCartao(cartao: CartaoDb): Cartao {
  return {
    id: cartao.id,
    nome: cartao.nome,
    tipo: cartao.tipo,
    cor: cartao.cor,
  };
}

export function serializarUsuario(usuario: UserDb, moeda: Moeda = 'BRL'): Usuario {
  return {
    id: usuario.id,
    nome: decifrar(usuario.nome),
    email: decifrar(usuario.email),
    papel: usuario.papel,
    moeda,
    compartilhaGastos: usuario.compartilhaGastos,
    householdId: usuario.householdId,
    criadoEm: usuario.criadoEm.toISOString(),
  };
}

export type GastoComRelacoes = GastoDb & {
  categoria: CategoriaDb | null;
  cartao: CartaoDb | null;
  user: Pick<UserDb, 'id' | 'nome'>;
  // Só o id: os bytes da imagem nunca entram numa listagem.
  comprovante: { id: string } | null;
};

export function serializarGasto(gasto: GastoComRelacoes): Gasto {
  return {
    id: gasto.id,
    descricao: gasto.descricao,
    valorCentavos: gasto.valorCentavos,
    data: formatarDataISO(gasto.data),
    formaPagamento: gasto.formaPagamento,
    observacao: gasto.observacao,
    categoria: gasto.categoria ? serializarCategoria(gasto.categoria) : null,
    cartao: gasto.cartao ? serializarCartao(gasto.cartao) : null,
    usuario: { id: gasto.user.id, nome: nomeDoUsuario(gasto.user) },
    origemImportacaoId: gasto.origemImportacaoId,
    temComprovante: gasto.comprovante !== null,
    recorrenciaId: gasto.recorrenciaId,
    pagoEm: gasto.pagoEm?.toISOString() ?? null,
    criadoEm: gasto.criadoEm.toISOString(),
    atualizadoEm: gasto.atualizadoEm.toISOString(),
  };
}

/** Relações que toda resposta de gasto precisa carregar. */
export const INCLUDE_GASTO = {
  categoria: true,
  cartao: true,
  user: { select: { id: true, nome: true } },
  // `select` em vez de `true`: sem isso o Prisma traria os bytes do
  // comprovante em cada gasto listado.
  comprovante: { select: { id: true } },
} as const;
