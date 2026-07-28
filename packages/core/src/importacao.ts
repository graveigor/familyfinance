import { normalizarTexto } from './textos.js';

/**
 * Regras de leitura da planilha que valem no backend e nas telas de conferência.
 * A leitura do arquivo em si (SheetJS) fica no backend; aqui está a parte que
 * decide o que cada coluna significa e o que fazer com cada linha.
 */

export const CAMPOS_IMPORTACAO = ['descricao', 'valor', 'data', 'pessoa', 'categoria'] as const;
export type CampoImportacao = (typeof CAMPOS_IMPORTACAO)[number];

/** Campos sem os quais não dá para criar um gasto. */
export const CAMPOS_OBRIGATORIOS: readonly CampoImportacao[] = ['descricao', 'valor'];

export const ROTULO_CAMPO: Record<CampoImportacao, string> = {
  descricao: 'Onde foi o gasto',
  valor: 'Valor',
  data: 'Data',
  pessoa: 'Quem gastou',
  categoria: 'Categoria',
};

/** Como as pessoas nomeiam cada coluna nas planilhas feitas à mão. */
export const SINONIMOS: Record<CampoImportacao, readonly string[]> = {
  descricao: [
    'local',
    'lugar',
    'estabelecimento',
    'descricao',
    'onde',
    'gasto',
    'historico',
    'item',
    'produto',
  ],
  valor: ['valor', 'preco', 'total', 'quantia', 'r$', 'rs', 'gasto', 'custo'],
  data: ['data', 'dia', 'vencimento', 'competencia', 'mes'],
  pessoa: ['nome', 'pessoa', 'quem', 'responsavel', 'titular', 'portador', 'membro'],
  categoria: ['categoria', 'tipo', 'classificacao', 'grupo'],
};

/** Coluna escolhida para cada campo (índice na linha). */
export type MapeamentoColunas = Partial<Record<CampoImportacao, number>>;

/**
 * Nota de 0 a 3 para "esta coluna é este campo".
 * 3 = o cabeçalho é exatamente o sinônimo, 2 = é uma das palavras do
 * cabeçalho, 1 = aparece no meio do texto (só para sinônimos longos, senão
 * "r" casaria com "responsável").
 */
function pontuar(cabecalho: string, campo: CampoImportacao): number {
  const texto = normalizarTexto(cabecalho).replace(/[^a-z0-9$ ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (texto === '') return 0;
  const palavras = texto.split(' ');

  let melhor = 0;
  for (const sinonimoBruto of SINONIMOS[campo]) {
    const sinonimo = normalizarTexto(sinonimoBruto);
    if (texto === sinonimo) return 3;
    if (palavras.includes(sinonimo)) melhor = Math.max(melhor, 2);
    else if (sinonimo.length >= 4 && texto.includes(sinonimo)) melhor = Math.max(melhor, 1);
  }
  return melhor;
}

/**
 * Descobre qual coluna é qual. Uma coluna serve a um campo só, e cada campo
 * fica com a coluna de maior nota — assim "Valor" ganha a coluna de valor e
 * "Gasto", que é sinônimo dos dois, sobra para a descrição.
 */
export function detectarColunas(cabecalho: readonly string[]): MapeamentoColunas {
  const candidatos: Array<{ campo: CampoImportacao; coluna: number; nota: number }> = [];

  for (const campo of CAMPOS_IMPORTACAO) {
    cabecalho.forEach((titulo, coluna) => {
      const nota = pontuar(titulo, campo);
      if (nota > 0) candidatos.push({ campo, coluna, nota });
    });
  }

  candidatos.sort((a, b) => b.nota - a.nota);

  const mapeamento: MapeamentoColunas = {};
  const colunasUsadas = new Set<number>();
  for (const candidato of candidatos) {
    if (mapeamento[candidato.campo] !== undefined) continue;
    if (colunasUsadas.has(candidato.coluna)) continue;
    mapeamento[candidato.campo] = candidato.coluna;
    colunasUsadas.add(candidato.coluna);
  }

  return mapeamento;
}

/**
 * Cabeçalho = primeira linha com 2 ou mais células de texto não vazias.
 * Planilhas caseiras costumam ter título, logo e linhas em branco antes disso.
 */
export function encontrarLinhaDeCabecalho(linhas: readonly (readonly string[])[]): number {
  for (let i = 0; i < Math.min(linhas.length, 30); i += 1) {
    const preenchidas = (linhas[i] ?? []).filter((celula) => String(celula ?? '').trim() !== '');
    if (preenchidas.length >= 2) return i;
  }
  return 0;
}

/** Linha de total/soma/subtotal: some do resultado sem virar erro. */
export function ehLinhaDeTotal(texto: string): boolean {
  const normalizado = normalizarTexto(texto);
  if (normalizado === '') return false;
  return /\b(total|totais|soma|somatorio|subtotal|saldo|acumulado)\b/.test(normalizado);
}

export const STATUS_LINHA = ['PRONTA', 'AVISO', 'ERRO'] as const;
export type StatusLinha = (typeof STATUS_LINHA)[number];

export interface LinhaAnalisada {
  /** Número da linha como aparece na planilha, para a pessoa conferir. */
  linha: number;
  status: StatusLinha;
  /** Já vem desmarcada quando é possível duplicata. */
  incluir: boolean;
  avisos: string[];
  erros: string[];
  descricao: string;
  valorCentavos: number | null;
  data: string | null;
  categoriaId: string | null;
  userId: string | null;
  /** Textos crus da planilha, para exibir o que não foi reconhecido. */
  textoPessoa: string | null;
  textoCategoria: string | null;
  textoValor: string | null;
  textoData: string | null;
}

export interface PreviaImportacao {
  importacaoId: string;
  nomeArquivo: string;
  /** Cabeçalho detectado, para os seletores da etapa 2. */
  colunas: string[];
  mapeamento: MapeamentoColunas;
  /** Preenchido quando a planilha não tem coluna de data. */
  mesReferencia: string | null;
  linhas: LinhaAnalisada[];
  totais: {
    prontas: number;
    comAviso: number;
    comErro: number;
    ignoradas: number;
    /** Soma do que será importado, para conferir com a planilha original. */
    centavosAImportar: number;
  };
}

export function contarPorStatus(linhas: readonly LinhaAnalisada[]): {
  prontas: number;
  comAviso: number;
  comErro: number;
} {
  return {
    prontas: linhas.filter((l) => l.status === 'PRONTA').length,
    comAviso: linhas.filter((l) => l.status === 'AVISO').length,
    comErro: linhas.filter((l) => l.status === 'ERRO').length,
  };
}
