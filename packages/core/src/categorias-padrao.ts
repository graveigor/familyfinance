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
  { nome: 'Outros', icone: 'etiqueta', cor: '#64748B' },
] as const;
