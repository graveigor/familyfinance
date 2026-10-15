/**
 * Categorias criadas junto com o household. O nome do ícone é neutro (não é de
 * nenhuma biblioteca específica): cada cliente mapeia para o seu conjunto.
 */
export interface CategoriaPadrao {
  nome: string;
  icone: string;
  cor: string;
}

export const CATEGORIAS_PADRAO: readonly CategoriaPadrao[] = [
  { nome: 'Mercado', icone: 'carrinho', cor: '#16A34A' },
  { nome: 'Alimentação', icone: 'garfo', cor: '#EA580C' },
  { nome: 'Transporte', icone: 'carro', cor: '#2563EB' },
  { nome: 'Saúde', icone: 'coracao', cor: '#DC2626' },
  { nome: 'Casa', icone: 'casa', cor: '#7C3AED' },
  { nome: 'Lazer', icone: 'sorriso', cor: '#DB2777' },
  { nome: 'Educação', icone: 'livro', cor: '#0891B2' },
  { nome: 'Vestuário', icone: 'camisa', cor: '#CA8A04' },
  { nome: 'Assinaturas', icone: 'repetir', cor: '#9333EA' },
  { nome: 'Outros', icone: 'etiqueta', cor: '#64748B' },
] as const;

/**
 * Categorias de RECEITA criadas junto com o household.
 *
 * Separadas das de despesa porque os dois seletores não podem se misturar:
 * "Salário" não faz sentido num gasto, nem "Mercado" numa receita. Os tons
 * puxam para o verde, que é a cor de dinheiro que entra no resto do app.
 */
export const CATEGORIAS_DE_RECEITA_PADRAO: readonly CategoriaPadrao[] = [
  { nome: 'Salário', icone: 'cima', cor: '#0E8F6D' },
  { nome: 'Freelance', icone: 'lapis', cor: '#14B88C' },
  { nome: 'Investimentos', icone: 'grafico', cor: '#0891B2' },
  { nome: 'Outras entradas', icone: 'etiqueta', cor: '#64748B' },
] as const;

/**
 * Tudo o que um grupo novo nasce com, despesa e receita, já com o tipo.
 *
 * Existe porque o grupo é criado em três lugares (cadastro, "criar grupo" e o
 * seed) e cada um montava a lista por conta própria — a primeira categoria
 * nova acabaria chegando a dois deles e esquecendo o terceiro.
 */
export const CATEGORIAS_DE_GRUPO_NOVO: ReadonlyArray<
  CategoriaPadrao & { tipo: 'DESPESA' | 'RECEITA' }
> = [
  ...CATEGORIAS_PADRAO.map((c) => ({ ...c, tipo: 'DESPESA' as const })),
  ...CATEGORIAS_DE_RECEITA_PADRAO.map((c) => ({ ...c, tipo: 'RECEITA' as const })),
];
