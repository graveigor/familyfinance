/** Tipos de domínio compartilhados entre backend, web e mobile. */

export const PAPEIS = ['ADMIN', 'MEMBRO'] as const;
export type Papel = (typeof PAPEIS)[number];

export const FORMAS_PAGAMENTO = ['CARTAO', 'DINHEIRO', 'PIX', 'BOLETO', 'OUTRO'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const STATUS_IMPORTACAO = ['PENDENTE', 'CONFIRMADA', 'CANCELADA'] as const;
export type StatusImportacao = (typeof STATUS_IMPORTACAO)[number];

export const TIPOS_CARTAO = ['CREDITO', 'DEBITO'] as const;
export type TipoCartao = (typeof TIPOS_CARTAO)[number];

export const ROTULO_TIPO_CARTAO: Record<TipoCartao, string> = {
  CREDITO: 'Crédito',
  DEBITO: 'Débito',
};

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
  /** Quando ligado, os lançamentos desta pessoa ficam visíveis para o grupo. */
  compartilhaGastos: boolean;
  householdId: string;
  criadoEm: string;
}

export interface Household {
  id: string;
  nome: string;
  criadoEm: string;
}

/** Um grupo na tela "Meus grupos", já com o que ela precisa mostrar. */
export interface GrupoDaPessoa {
  id: string;
  nome: string;
  /** Papel da pessoa NESTE grupo. */
  papel: Papel;
  /** É o grupo em uso agora. */
  ativo: boolean;
  souDono: boolean;
  totalMembros: number;
  totalGastos: number;
  /** Códigos válidos. Vem vazio nos grupos que a pessoa não administra. */
  codigos: Array<{ codigo: string; expiraEm: string }>;
  criadoEm: string;
}

export interface Categoria {
  id: string;
  nome: string;
  icone: string;
  cor: string;
}

/**
 * Meio de pagamento com nome próprio ("Itaú", "Bradesco"). O apelido é livre:
 * o que importa é a família reconhecer o cartão como chama no dia a dia.
 */
export interface Cartao {
  id: string;
  nome: string;
  tipo: TipoCartao;
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
  cartao: Cartao | null;
  usuario: AutorDoGasto;
  origemImportacaoId: string | null;
  /** Existe um comprovante anexado a este gasto. */
  temComprovante: boolean;
  /** Preenchido quando o gasto nasceu de uma recorrência. */
  recorrenciaId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Recorrencia {
  id: string;
  descricao: string;
  valorCentavos: number;
  diaDoMes: number;
  formaPagamento: FormaPagamento;
  observacao: string | null;
  categoria: Categoria | null;
  cartao: Cartao | null;
  usuario: AutorDoGasto;
  ativa: boolean;
  /** `aaaa-mm-dd` */
  inicioEm: string;
  fimEm: string | null;
  /** `aaaa-mm` do último mês já lançado. */
  ultimoMesGerado: string | null;
  criadoEm: string;
}

/** Um mês do gráfico de evolução. */
export interface PontoDeEvolucao {
  ano: number;
  mes: number;
  /** `jan`, `fev`... para o rótulo do gráfico. */
  rotulo: string;
  totalCentavos: number;
  quantidade: number;
}

export interface Evolucao {
  pontos: PontoDeEvolucao[];
  /** Média dos meses com gasto, para a linha de referência. */
  mediaCentavos: number;
  maiorCentavos: number;
}

/** Meta conjunta do grupo (ex.: "Viagem de férias"). */
export interface Meta {
  id: string;
  nome: string;
  valorAlvoCentavos: number | null;
  criadoPor: AutorDoGasto;
  criadoEm: string;
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
