/** Tipos de domínio compartilhados entre backend, web e mobile. */

export const PAPEIS = ['ADMIN', 'MEMBRO'] as const;
export type Papel = (typeof PAPEIS)[number];

export const FORMAS_PAGAMENTO = ['CARTAO', 'DINHEIRO', 'PIX', 'BOLETO', 'OUTRO'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const STATUS_IMPORTACAO = ['PENDENTE', 'CONFIRMADA', 'CANCELADA'] as const;
export type StatusImportacao = (typeof STATUS_IMPORTACAO)[number];

/** Rótulo exibido ao usuário para cada forma de pagamento. */
export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  CARTAO: 'Cartão',
  DINHEIRO: 'Dinheiro',
  PIX: 'Pix',
  BOLETO: 'Boleto',
  OUTRO: 'Outro',
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  ADMIN: 'Administrador',
  MEMBRO: 'Membro',
};

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  householdId: string;
  criadoEm: string;
}

export interface Household {
  id: string;
  nome: string;
  criadoEm: string;
}

export interface Categoria {
  id: string;
  nome: string;
  icone: string;
  cor: string;
}

/** Dados mínimos de quem gastou, embutidos no gasto para evitar outra chamada. */
export interface AutorDoGasto {
  id: string;
  nome: string;
}

export interface Gasto {
  id: string;
  descricao: string;
  valorCentavos: number;
  /** `aaaa-mm-dd` */
  data: string;
  formaPagamento: FormaPagamento;
  observacao: string | null;
  categoria: Categoria | null;
  usuario: AutorDoGasto;
  origemImportacaoId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Paginacao {
  pagina: number;
  porPagina: number;
  totalItens: number;
  totalPaginas: number;
}

export interface ListaDeGastos {
  itens: Gasto[];
  paginacao: Paginacao;
  /** Soma de TODOS os gastos que atendem ao filtro, não só os desta página. */
  totalCentavos: number;
}

export interface TotalPorCategoria {
  categoria: Categoria | null;
  totalCentavos: number;
  quantidade: number;
}

export interface TotalPorPessoa {
  usuario: AutorDoGasto;
  totalCentavos: number;
  quantidade: number;
}

export interface ResumoMensal {
  ano: number;
  mes: number;
  totalCentavos: number;
  quantidade: number;
  porCategoria: TotalPorCategoria[];
  porPessoa: TotalPorPessoa[];
  mesAnterior: {
    ano: number;
    mes: number;
    totalCentavos: number;
    /** Positivo = gastou mais que no mês anterior. */
    diferencaCentavos: number;
  };
}

export interface Sessao {
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
}

export interface Convite {
  codigo: string;
  expiraEm: string;
  household: { id: string; nome: string };
}
