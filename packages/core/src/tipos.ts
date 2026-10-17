import type { Moeda } from './dinheiro.js';

/** Tipos de domínio compartilhados entre backend, web e mobile. */

export const PAPEIS = ['ADMIN', 'MEMBRO'] as const;
export type Papel = (typeof PAPEIS)[number];

/** Um lançamento é o que sai (despesa) ou o que entra (receita). */
export const TIPOS_DE_LANCAMENTO = ['DESPESA', 'RECEITA'] as const;
export type TipoDeLancamento = (typeof TIPOS_DE_LANCAMENTO)[number];

export const FORMAS_PAGAMENTO = ['CARTAO', 'DEBITO', 'DINHEIRO', 'PIX', 'BOLETO', 'OUTRO'] as const;
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
  CARTAO: 'Cartão de crédito',
  DEBITO: 'Cartão de débito',
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
  /** Moeda do grupo ativo — a tela formata o dinheiro com ela. */
  moeda: Moeda;
  /** Quando ligado, os lançamentos desta pessoa ficam visíveis para o grupo. */
  compartilhaGastos: boolean;
  householdId: string;
  criadoEm: string;
}

export interface Household {
  id: string;
  nome: string;
  moeda: Moeda;
  criadoEm: string;
}

/** Um grupo na tela "Meus grupos", já com o que ela precisa mostrar. */
export interface GrupoDaPessoa {
  id: string;
  nome: string;
  moeda: Moeda;
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
  /** Se serve para gasto ou para receita. */
  tipo: TipoDeLancamento;
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
  /** Dia em que a fatura fecha. Nulo quando não foi informado. */
  diaFechamento: number | null;
  /** Dia em que a fatura vence. Nulo quando não foi informado. */
  diaVencimento: number | null;
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
  /** Quando foi marcado como pago (ISO). Nulo = lançado e ainda em aberto. */
  pagoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Recorrencia {
  id: string;
  /** Se este compromisso mensal gera gasto ou receita. */
  tipo: TipoDeLancamento;
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

/**
 * O lançamento desta conta fixa no mês corrente, quando já nasceu.
 *
 * Nulo significa que o dia ainda não chegou — a conta existe, mas não virou gasto.
 */
export interface LancamentoDoMes {
  id: string;
  /** `aaaa-mm-dd` */
  data: string;
  /** ISO, ou nulo se ainda está em aberto. */
  pagoEm: string | null;
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

/** Meta do grupo (ex.: "Viagem de férias") ou pessoal, de quem criou. */
export interface Meta {
  id: string;
  nome: string;
  valorAlvoCentavos: number | null;
  criadoPor: AutorDoGasto;
  /** Só de quem criou. As do grupo aparecem para a família inteira. */
  pessoal: boolean;
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

/**
 * O que já está comprometido num mês que ainda não começou.
 *
 * Duas origens, e elas somam de formas diferentes: as parcelas já existem como
 * lançamento no mês futuro, enquanto as contas fixas ainda não — elas só viram
 * gasto no dia. Por isso a previsão não é "somar os gastos do mês que vem".
 */
/**
 * Um teto mensal e quanto dele já foi usado.
 *
 * `gastoCentavos` é o gasto DA PESSOA naquela categoria, não o do grupo: o
 * teto é pessoal, e comparar o seu limite com o gasto somado da família daria
 * uma barra que não quer dizer nada.
 */
export interface OrcamentoDaCategoria {
  categoria: Categoria;
  limiteCentavos: number;
  gastoCentavos: number;
  /** 0–100 para a barra; passa de 100 quando estourou. */
  percentual: number;
  /** `tranquilo` até 80%, `atencao` de 80 a 100, `estourado` acima. */
  situacao: 'tranquilo' | 'atencao' | 'estourado';
}

/** O que entra: salário, freela, aluguel recebido. */
export interface Receita {
  id: string;
  descricao: string;
  valorCentavos: number;
  /** `aaaa-mm-dd` */
  data: string;
  observacao: string | null;
  categoria: Categoria | null;
  usuario: AutorDoGasto;
  /** Preenchido quando nasceu de uma receita fixa. */
  recorrenciaId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ListaDeReceitas {
  itens: Receita[];
  totalCentavos: number;
  paginacao: { pagina: number; porPagina: number; totalItens: number; totalPaginas: number };
}

export interface Previsao {
  ano: number;
  mes: number;
  totalCentavos: number;
  /** Parcelas e lançamentos já marcados para aquele mês. */
  lancadosCentavos: number;
  /** Contas fixas que ainda vão nascer naquele mês. */
  contasFixasCentavos: number;
  itens: ItemPrevisto[];
}

export interface ItemPrevisto {
  descricao: string;
  valorCentavos: number;
  /** `aaaa-mm-dd` */
  data: string;
  origem: 'parcela' | 'conta-fixa';
}

export interface ResumoMensal {
  ano: number;
  mes: number;
  /** Soma das despesas do mês. O nome ficou por compatibilidade de contrato. */
  totalCentavos: number;
  /** Soma das receitas do mês. */
  receitasCentavos: number;
  /** Receitas menos despesas. Negativo quando faltou. */
  saldoCentavos: number;
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
