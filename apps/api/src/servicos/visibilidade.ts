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
export function filtroDeGastosVisiveis(usuario: UsuarioAutenticado): Prisma.GastoWhereInput {
  return {
    householdId: usuario.householdId,
    OR: [{ userId: usuario.id }, { user: { compartilhaGastos: true } }],
  };
}

/** Mesma regra, para as contas fixas. */
export function filtroDeRecorrenciasVisiveis(
  usuario: UsuarioAutenticado,
): Prisma.RecorrenciaWhereInput {
  return {
    householdId: usuario.householdId,
    OR: [{ userId: usuario.id }, { user: { compartilhaGastos: true } }],
  };
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
