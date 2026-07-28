import {
  detectarColunas,
  ehLinhaDeTotal,
  encontrarLinhaDeCabecalho,
  erroValidacao,
  formatarDataISO,
  normalizarTexto,
  parseData,
  parseValorParaCentavos,
  type LinhaAnalisada,
  type MapeamentoColunas,
} from '@gastos/core';
import * as XLSX from 'xlsx';

/**
 * Leitura e interpretação da planilha. Tudo aqui é tolerante: a planilha da
 * família é feita à mão, tem título antes do cabeçalho, linha de total no fim,
 * data escrita de três jeitos e valor com "R$".
 */

/** Célula já normalizada para algo que dá para guardar em JSON. */
export type Celula = string | number | null;

export interface PlanilhaLida {
  colunas: string[];
  /** Linhas de dados (o cabeçalho já foi retirado). */
  linhas: Celula[][];
  /** Número da linha do cabeçalho na planilha original, base 1. */
  linhaDoCabecalho: number;
}

const LIMITE_LINHAS = 5000;

function celulaParaTexto(valor: Celula): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

/**
 * Lê a primeira aba. Datas viram texto ISO e números continuam números —
 * assim o resultado atravessa JSON sem perder informação e os interpretadores
 * de valor e data do `core` dão conta dos dois formatos.
 */
export function lerPlanilha(arquivo: Buffer): PlanilhaLida {
  let pasta: XLSX.WorkBook;
  try {
    pasta = XLSX.read(arquivo, { type: 'buffer', cellDates: true, raw: false });
  } catch {
    throw erroValidacao(
      'Não conseguimos ler esse arquivo. Ele precisa ser uma planilha do Excel (.xlsx, .xls) ou um arquivo .csv.',
    );
  }

  const nomeDaAba = pasta.SheetNames[0];
  const aba = nomeDaAba ? pasta.Sheets[nomeDaAba] : undefined;
  if (!aba) {
    throw erroValidacao('Essa planilha está vazia — não encontramos nenhuma aba com dados.');
  }

  const bruto = XLSX.utils.sheet_to_json<unknown[]>(aba, {
    header: 1,
    defval: null,
    raw: true,
    // Mantemos as linhas em branco para que "Linha 8" na tela seja a linha 8
    // que a pessoa vê no Excel. Elas são descartadas depois, na análise.
    blankrows: true,
  });

  const normalizadas: Celula[][] = bruto.map((linha) =>
    (linha ?? []).map((celula): Celula => {
      if (celula === null || celula === undefined) return null;
      if (celula instanceof Date) return formatarDataISO(celula);
      if (typeof celula === 'number') return Number.isFinite(celula) ? celula : null;
      if (typeof celula === 'boolean') return String(celula);
      const texto = String(celula).trim();
      return texto === '' ? null : texto;
    }),
  );

  if (normalizadas.length === 0) {
    throw erroValidacao('Essa planilha está vazia — não encontramos nenhuma linha.');
  }

  const indiceCabecalho = encontrarLinhaDeCabecalho(
    normalizadas.map((linha) => linha.map(celulaParaTexto)),
  );
  const colunas = (normalizadas[indiceCabecalho] ?? []).map(celulaParaTexto);
  const linhas = normalizadas.slice(indiceCabecalho + 1);

  if (linhas.length > LIMITE_LINHAS) {
    throw erroValidacao(
      `Essa planilha tem ${linhas.length} linhas. Por segurança, importamos no máximo ${LIMITE_LINHAS} por vez — divida o arquivo e envie em partes.`,
    );
  }

  return { colunas, linhas, linhaDoCabecalho: indiceCabecalho + 1 };
}

export interface ContextoDaAnalise {
  membros: Array<{ id: string; nome: string }>;
  categorias: Array<{ id: string; nome: string }>;
  usuarioLogadoId: string;
  /** Gastos já existentes, para marcar possíveis duplicatas. */
  chavesExistentes: Set<string>;
  /** `aaaa-mm`, quando a planilha não tem coluna de data. */
  mesReferencia?: string | null;
}

/** Mesma chave usada para detectar duplicata: descrição + valor + data. */
export function chaveDeDuplicata(descricao: string, valorCentavos: number, data: string): string {
  return `${normalizarTexto(descricao)}|${valorCentavos}|${data}`;
}

export interface ResultadoDaAnalise {
  linhas: LinhaAnalisada[];
  ignoradas: number;
}

export function analisarLinhas(
  linhas: readonly Celula[][],
  mapeamento: MapeamentoColunas,
  contexto: ContextoDaAnalise,
  linhaDoCabecalho: number,
): ResultadoDaAnalise {
  const membroPorNome = new Map(contexto.membros.map((m) => [normalizarTexto(m.nome), m]));
  // Também casa só pelo primeiro nome: a planilha costuma trazer "Maria",
  // não "Maria Silva".
  for (const membro of contexto.membros) {
    const primeiro = normalizarTexto(membro.nome).split(' ')[0];
    if (primeiro && !membroPorNome.has(primeiro)) membroPorNome.set(primeiro, membro);
  }
  const categoriaPorNome = new Map(contexto.categorias.map((c) => [normalizarTexto(c.nome), c]));

  const vistasNestaPlanilha = new Set<string>();
  const analisadas: LinhaAnalisada[] = [];
  let ignoradas = 0;

  const pegar = (linha: readonly Celula[], coluna: number | null | undefined): Celula =>
    coluna === null || coluna === undefined ? null : (linha[coluna] ?? null);

  linhas.forEach((linha, indice) => {
    const numeroDaLinha = linhaDoCabecalho + indice + 1;

    const celulaDescricao = pegar(linha, mapeamento.descricao);
    const celulaValor = pegar(linha, mapeamento.valor);
    const celulaData = pegar(linha, mapeamento.data);
    const celulaPessoa = pegar(linha, mapeamento.pessoa);
    const celulaCategoria = pegar(linha, mapeamento.categoria);

    const descricao = celulaDescricao === null ? '' : celulaParaTexto(celulaDescricao);
    const textoValor = celulaValor === null ? null : celulaParaTexto(celulaValor);
    const valorCentavos =
      celulaValor === null ? null : parseValorParaCentavos(celulaValor as string | number);

    // Linha em branco na planilha: some sem alarde.
    const linhaVazia = linha.every((celula) => celula === null || celulaParaTexto(celula) === '');
    // Linha cujas colunas de descrição E valor estão vazias também é lixo —
    // mas só dá para afirmar isso se essas colunas foram mapeadas. Sem
    // mapeamento, a linha aparece com erro e a tela pede as colunas, em vez de
    // sumir sem explicação.
    const temMapeamentoUtil =
      mapeamento.descricao !== undefined || mapeamento.valor !== undefined;
    if (linhaVazia || (temMapeamentoUtil && descricao === '' && valorCentavos === null)) {
      ignoradas += 1;
      return;
    }

    // Total/subtotal: é resumo da planilha, não é gasto.
    if (ehLinhaDeTotal(descricao)) {
      ignoradas += 1;
      return;
    }

    const avisos: string[] = [];
    const erros: string[] = [];

    if (descricao === '') {
      erros.push('Sem descrição do gasto.');
    }
    if (valorCentavos === null) {
      erros.push(
        textoValor ? `"${textoValor}" não é um valor válido.` : 'Sem valor.',
      );
    } else if (valorCentavos === 0) {
      erros.push('O valor é zero.');
    }

    // Data
    let data: string | null = null;
    const textoData = celulaData === null ? null : celulaParaTexto(celulaData);
    if (celulaData !== null) {
      const convertida = parseData(celulaData as string | number);
      if (convertida) data = formatarDataISO(convertida);
      else avisos.push(`Não entendemos a data "${textoData}".`);
    }
    if (!data) {
      if (contexto.mesReferencia) {
        data = `${contexto.mesReferencia}-01`;
        if (celulaData !== null || mapeamento.data !== undefined) {
          avisos.push('Sem data na planilha; usamos o dia 1 do mês escolhido.');
        }
      } else {
        erros.push('Sem data. Escolha o mês de referência da planilha.');
      }
    }

    // Pessoa
    let userId = contexto.usuarioLogadoId;
    const textoPessoa = celulaPessoa === null ? null : celulaParaTexto(celulaPessoa);
    if (textoPessoa) {
      const encontrado = membroPorNome.get(normalizarTexto(textoPessoa));
      if (encontrado) userId = encontrado.id;
      else avisos.push(`"${textoPessoa}" não está na família; ficou no seu nome.`);
    } else if (mapeamento.pessoa !== undefined) {
      avisos.push('Sem o nome de quem gastou; ficou no seu nome.');
    }

    // Categoria — não inventamos categoria que não veio na planilha.
    let categoriaId: string | null = null;
    const textoCategoria = celulaCategoria === null ? null : celulaParaTexto(celulaCategoria);
    if (textoCategoria) {
      const encontrada = categoriaPorNome.get(normalizarTexto(textoCategoria));
      if (encontrada) categoriaId = encontrada.id;
      else avisos.push(`A categoria "${textoCategoria}" não existe; ficará sem categoria.`);
    }

    // Duplicata: contra o que já está no app e contra a própria planilha.
    let duplicata = false;
    if (valorCentavos !== null && valorCentavos !== 0 && data && descricao) {
      const chave = chaveDeDuplicata(descricao, valorCentavos, data);
      if (contexto.chavesExistentes.has(chave)) {
        duplicata = true;
        avisos.push('Possível duplicata: já existe um gasto igual nesta data.');
      } else if (vistasNestaPlanilha.has(chave)) {
        duplicata = true;
        avisos.push('Possível duplicata: aparece mais de uma vez nesta planilha.');
      }
      vistasNestaPlanilha.add(chave);
    }

    const status = erros.length > 0 ? 'ERRO' : avisos.length > 0 ? 'AVISO' : 'PRONTA';

    analisadas.push({
      linha: numeroDaLinha,
      status,
      // Duplicata entra desmarcada: importar de novo é pior que deixar de fora.
      incluir: status !== 'ERRO' && !duplicata,
      avisos,
      erros,
      descricao,
      valorCentavos,
      data,
      categoriaId,
      userId,
      textoPessoa,
      textoCategoria,
      textoValor,
      textoData,
    });
  });

  return { linhas: analisadas, ignoradas };
}

/** Mapeamento inicial: detectado pelo cabeçalho. */
export function mapeamentoInicial(colunas: readonly string[]): MapeamentoColunas {
  return detectarColunas(colunas);
}

// --- Exportação -------------------------------------------------------------

export interface LinhaParaExportar {
  Data: string;
  'Onde foi': string;
  Valor: number;
  Pessoa: string;
  Categoria: string;
  'Forma de pagamento': string;
  Observação: string;
}

/**
 * Gera o arquivo para download. O valor sai como número em reais (com duas
 * casas) porque é isso que o Excel sabe somar — a conversão de centavos para
 * reais acontece só aqui, na borda.
 */
export function gerarArquivo(linhas: LinhaParaExportar[], formato: 'xlsx' | 'csv'): Buffer {
  const aba = XLSX.utils.json_to_sheet(linhas);

  if (formato === 'csv') {
    // Ponto e vírgula: é o que o Excel em português espera.
    const csv = XLSX.utils.sheet_to_csv(aba, { FS: ';' });
    // BOM para o Excel abrir os acentos corretamente.
    return Buffer.from(`﻿${csv}`, 'utf8');
  }

  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, aba, 'Gastos');
  return XLSX.write(pasta, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
