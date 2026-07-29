import { formatarDataISO, type Categoria, type Gasto, type Usuario } from '@gastos/core';
import type {
  Categoria as CategoriaDb,
  Gasto as GastoDb,
  User as UserDb,
} from '@prisma/client';

/**
 * Converte as linhas do banco para o contrato público da API.
 * `data` sai como `aaaa-mm-dd` (dia de calendário, sem hora nem fuso);
 * os demais instantes saem em ISO completo.
 */

export function serializarCategoria(categoria: CategoriaDb): Categoria {
  return {
    id: categoria.id,
    nome: categoria.nome,
    icone: categoria.icone,
    cor: categoria.cor,
  };
}

export function serializarUsuario(usuario: UserDb): Usuario {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    compartilhaGastos: usuario.compartilhaGastos,
    householdId: usuario.householdId,
    criadoEm: usuario.criadoEm.toISOString(),
  };
}

export type GastoComRelacoes = GastoDb & {
  categoria: CategoriaDb | null;
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
    usuario: { id: gasto.user.id, nome: gasto.user.nome },
    origemImportacaoId: gasto.origemImportacaoId,
    temComprovante: gasto.comprovante !== null,
    recorrenciaId: gasto.recorrenciaId,
    criadoEm: gasto.criadoEm.toISOString(),
    atualizadoEm: gasto.atualizadoEm.toISOString(),
  };
}

/** Relações que toda resposta de gasto precisa carregar. */
export const INCLUDE_GASTO = {
  categoria: true,
  user: { select: { id: true, nome: true } },
  // `select` em vez de `true`: sem isso o Prisma traria os bytes do
  // comprovante em cada gasto listado.
  comprovante: { select: { id: true } },
} as const;
