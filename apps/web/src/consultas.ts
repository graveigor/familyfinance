import type {
  AtualizarGastoEntrada,
  Categoria,
  CriarCategoriaEntrada,
  CriarGastoEntrada,
  ListaDeGastos,
  ListarGastosEntrada,
  ResumoMensal,
  Usuario,
} from '@gastos/core';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from './api';

/** Chaves centralizadas: invalidar o que mudou fica óbvio e sem string solta. */
export const chaves = {
  gastos: ['gastos'] as const,
  listaDeGastos: (filtros: Partial<ListarGastosEntrada>) => ['gastos', 'lista', filtros] as const,
  sugestoes: (termo: string) => ['gastos', 'sugestoes', termo] as const,
  categorias: ['categorias'] as const,
  membros: ['household', 'membros'] as const,
  household: ['household'] as const,
  resumo: (ano: number, mes: number) => ['resumos', ano, mes] as const,
};

/** Tudo que depende de gasto: lista, resumo e sugestões de descrição. */
async function invalidarGastos(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chaves.gastos }),
    queryClient.invalidateQueries({ queryKey: ['resumos'] }),
  ]);
}

export function useGastos(
  filtros: Partial<ListarGastosEntrada>,
): UseQueryResult<ListaDeGastos, Error> {
  return useQuery({
    queryKey: chaves.listaDeGastos(filtros),
    queryFn: () => api.gastos.listar(filtros),
    // Mantém a lista anterior na tela enquanto o filtro novo carrega, para o
    // conteúdo não piscar a cada tecla digitada na busca.
    placeholderData: (anterior) => anterior,
  });
}

export function useCategorias(): UseQueryResult<Categoria[], Error> {
  return useQuery({
    queryKey: chaves.categorias,
    queryFn: () => api.categorias.listar(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMembros(): UseQueryResult<Usuario[], Error> {
  return useQuery({
    queryKey: chaves.membros,
    queryFn: () => api.household.membros(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useResumoMensal(ano: number, mes: number): UseQueryResult<ResumoMensal, Error> {
  return useQuery({
    queryKey: chaves.resumo(ano, mes),
    queryFn: () => api.resumos.mensal(ano, mes),
  });
}

export function useSugestoes(termo: string): UseQueryResult<string[], Error> {
  return useQuery({
    queryKey: chaves.sugestoes(termo),
    queryFn: () => api.gastos.sugestoes(termo),
    enabled: termo.trim().length >= 2,
    staleTime: 60 * 1000,
  });
}

export function useCriarGasto(): UseMutationResult<unknown, Error, CriarGastoEntrada> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: CriarGastoEntrada) => api.gastos.criar(dados),
    onSuccess: () => invalidarGastos(queryClient),
  });
}

export function useAtualizarGasto(): UseMutationResult<
  unknown,
  Error,
  { id: string; dados: AtualizarGastoEntrada }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: AtualizarGastoEntrada }) =>
      api.gastos.atualizar(id, dados),
    onSuccess: () => invalidarGastos(queryClient),
  });
}

export function useExcluirGasto(): UseMutationResult<unknown, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.gastos.excluir(id),
    onSuccess: () => invalidarGastos(queryClient),
  });
}

export function useCriarCategoria(): UseMutationResult<unknown, Error, CriarCategoriaEntrada> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: CriarCategoriaEntrada) => api.categorias.criar(dados),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.categorias }),
  });
}

export function useExcluirCategoria(): UseMutationResult<unknown, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.categorias.excluir(id),
    onSuccess: async () => {
      // Os gastos que usavam a categoria mudaram junto.
      await queryClient.invalidateQueries({ queryKey: chaves.categorias });
      await invalidarGastos(queryClient);
    },
  });
}
