import type { Prisma } from '@prisma/client';
import type { UsuarioAutenticado } from '../plugins/autenticacao.js';

/**
 * Quem enxerga o dinheiro de quem.
 *
 * Esta é a regra de privacidade do app, e existe num lugar só de propósito:
 * toda leitura de lançamento passa por aqui. Espalhar essa condição pelas
 * rotas seria pedir para um dia alguém esquecer de aplicá-la em uma delas.
 *
 * A regra:
 *  - você sempre vê o que é seu;
 *  - você vê o de quem **escolheu compartilhar** com o grupo;
 *  - quem não compartilha fica invisível para os outros, mesmo estando no
 *    mesmo grupo.
 *
 * Reparar que o grupo em si (`householdId`) continua sendo a primeira barreira:
 * nada atravessa de um grupo para outro em hipótese alguma.
 */
/**
 * "É seu, ou é de quem compartilha" — a condição, sem amarrar a grupo nenhum.
 *
 * Fica separada porque nem toda leitura parte do grupo ativo: contar dentro de
 * uma relação que já traz o grupo (o `_count` de `/household/grupos`) precisa
 * da regra sem o `householdId`, e escrevê-la de novo lá seria a quarta cópia
 * do mesmo `OR`.
 */
// Sem tipo de retorno declarado de propósito: a condição é a mesma para gasto
// e para recorrência, e fixá-la em `GastoWhereInput` a impediria de servir às
// duas. O que o TypeScript infere encaixa nos dois `where`.
export function deQuemCompartilha(usuarioId: string) {
  return { OR: [{ userId: usuarioId }, { user: { compartilhaGastos: true } }] };
}

export function filtroDeGastosVisiveis(usuario: UsuarioAutenticado): Prisma.GastoWhereInput {
  return { householdId: usuario.householdId, ...deQuemCompartilha(usuario.id) };
}

/** Mesma regra, para as contas fixas. */
export function filtroDeRecorrenciasVisiveis(
  usuario: UsuarioAutenticado,
): Prisma.RecorrenciaWhereInput {
  return { householdId: usuario.householdId, ...deQuemCompartilha(usuario.id) };
}

/**
 * Junta o filtro de privacidade com os filtros da tela (período, categoria,
 * busca...) sem que um sobrescreva o `OR` do outro — erro fácil de cometer
 * montando o `where` na mão.
 */
export function combinarFiltros(
  ...filtros: Array<Prisma.GastoWhereInput | undefined>
): Prisma.GastoWhereInput {
  return { AND: filtros.filter((filtro): filtro is Prisma.GastoWhereInput => Boolean(filtro)) };
}
