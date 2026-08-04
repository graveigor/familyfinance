/**
 * Dinheiro é SEMPRE inteiro em centavos. Nenhuma função deste arquivo devolve
 * `number` fracionário, e a conversão texto -> centavos é feita por manipulação
 * de string (nunca `parseFloat`), para não herdar erro de ponto flutuante.
 */

import type { Idioma } from './datas.js';

/**
 * A moeda continua sendo o real: o dinheiro é o mesmo, muda só como o número
 * é escrito. `R$ 1.234,56` em português, `R$ 1,234.56` em inglês.
 */
const FORMATADORES_BRL: Record<Idioma, Intl.NumberFormat> = {
  pt: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  en: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BRL' }),
};

const FORMATADOR_NUMERO = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `123456` -> `"R$ 1.234,56"`. Negativos saem como `"-R$ 1.234,56"`. */
export function formatarBRL(centavos: number, idioma: Idioma = 'pt'): string {
  return FORMATADORES_BRL[idioma].format(centavos / 100);
}

/** `123456` -> `"1.234,56"` (sem símbolo, para campos de formulário). */
export function formatarNumero(centavos: number): string {
  return FORMATADOR_NUMERO.format(centavos / 100);
}

/**
 * Versão curta para textos de comparação: `"R$ 320"` quando não há centavos,
 * `"R$ 320,50"` quando há. Usada em frases como "R$ 320 a mais que em junho".
 */
export function formatarBRLCurto(centavos: number, idioma: Idioma = 'pt'): string {
  const absoluto = Math.abs(centavos);
  if (absoluto % 100 === 0) {
    return new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(centavos / 100);
  }
  return formatarBRL(centavos, idioma);
}

/**
 * Converte o que o usuário digitou (ou o que veio de uma planilha) em centavos.
 * Devolve `null` quando não há número reconhecível.
 *
 * Aceita: `1.234,56`  `1234,56`  `R$ 1.234,56`  `1234.56`  `1234`  `(45,90)`  `-45,90`
 *
 * Heurística de separador decimal, na ordem:
 *  1. Se houver vírgula E ponto, o ÚLTIMO separador que aparece é o decimal
 *     (cobre tanto `1.234,56` quanto `1,234.56`).
 *  2. Se houver só um tipo de separador e ele aparecer mais de uma vez,
 *     é separador de milhar (`1.234.567`).
 *  3. Se aparecer uma única vez, é decimal — EXCETO ponto seguido de exatamente
 *     3 dígitos, caso clássico de milhar em planilha brasileira
 *     (`1.234` = mil duzentos e trinta e quatro reais, não R$ 1,23).
 *     A exceção vale só para o ponto: em pt-BR a vírgula é sempre decimal,
 *     então `8,175` é R$ 8,18 (arredondado) e não oito mil e cento e setenta e cinco.
 *
 * Parênteses ou sinal de menos (antes ou depois) indicam estorno -> valor negativo.
 */
export function parseValorParaCentavos(entrada: string | number): number | null {
  if (typeof entrada === 'number') {
    if (!Number.isFinite(entrada)) return null;
    // Planilhas entregam número já em reais; arredonda no inteiro mais próximo
    // de centavo para não propagar resíduo binário (ex.: 10.075 -> 1008).
    return Math.round(entrada * 100);
  }

  let texto = entrada.trim();
  if (texto === '') return null;

  // Parênteses = negativo (convenção contábil das planilhas).
  let negativo = false;
  if (texto.startsWith('(') && texto.endsWith(')')) {
    negativo = true;
    texto = texto.slice(1, -1).trim();
  }

  // Remove moeda, espaços (inclusive o espaço fino que o Excel insere) e sinais,
  // guardando se havia sinal de menos em qualquer uma das pontas.
  if (/^-/.test(texto) || /-$/.test(texto)) negativo = true;
  texto = texto
    .replace(/R\$/gi, '')
    .replace(/[\s  ]/g, '')
    .replace(/[+-]/g, '');

  if (!/\d/.test(texto)) return null;
  // Qualquer caractere fora de dígito/separador invalida a célula.
  if (/[^\d.,]/.test(texto)) return null;

  const ultimaVirgula = texto.lastIndexOf(',');
  const ultimoPonto = texto.lastIndexOf('.');
  let posicaoDecimal = -1;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    posicaoDecimal = Math.max(ultimaVirgula, ultimoPonto);
  } else if (ultimaVirgula >= 0 || ultimoPonto >= 0) {
    const separador = ultimaVirgula >= 0 ? ',' : '.';
    const ocorrencias = texto.split(separador).length - 1;
    const digitosDepois = texto.length - texto.lastIndexOf(separador) - 1;
    const ehMilharComPonto = separador === '.' && digitosDepois === 3;
    if (ocorrencias === 1 && !ehMilharComPonto) {
      posicaoDecimal = texto.lastIndexOf(separador);
    }
  }

  let parteInteira: string;
  let parteDecimal: string;
  if (posicaoDecimal >= 0) {
    parteInteira = texto.slice(0, posicaoDecimal);
    parteDecimal = texto.slice(posicaoDecimal + 1);
  } else {
    parteInteira = texto;
    parteDecimal = '';
  }

  parteInteira = parteInteira.replace(/[.,]/g, '');
  parteDecimal = parteDecimal.replace(/[.,]/g, '');
  if (parteInteira === '' && parteDecimal === '') return null;

  // Trunca/completa em 2 casas; o terceiro dígito arredonda (0,005 -> 1 centavo).
  let centavosDecimal = 0;
  if (parteDecimal.length > 0) {
    const doisPrimeiros = parteDecimal.slice(0, 2).padEnd(2, '0');
    centavosDecimal = Number(doisPrimeiros);
    const terceiro = parteDecimal.charCodeAt(2) - 48;
    if (terceiro >= 5 && terceiro <= 9) centavosDecimal += 1;
  }

  const reais = parteInteira === '' ? 0 : Number(parteInteira);
  if (!Number.isSafeInteger(reais)) return null;

  const total = reais * 100 + centavosDecimal;
  return negativo ? -total : total;
}

/**
 * Aplica máscara de moeda enquanto o usuário digita: só os dígitos importam e
 * os dois últimos são os centavos (`"1234"` -> `"R$ 12,34"`).
 */
export function mascararMoeda(digitado: string, idioma: Idioma = 'pt'): string {
  const digitos = digitado.replace(/\D/g, '').slice(0, 15);
  if (digitos === '') return '';
  return formatarBRL(Number(digitos), idioma);
}

/** Centavos correspondentes ao que já foi digitado no campo com máscara. */
export function centavosDoTextoMascarado(digitado: string): number {
  const digitos = digitado.replace(/\D/g, '').slice(0, 15);
  return digitos === '' ? 0 : Number(digitos);
}

/** Soma segura de uma lista de valores em centavos. */
export function somarCentavos(valores: readonly number[]): number {
  return valores.reduce((total, valor) => total + valor, 0);
}

/** Teto de parcelas aceito no app — cobre os planos mais longos de loja. */
export const MAXIMO_DE_PARCELAS = 64;

export interface Parcelamento {
  /** Valor de cada parcela, em centavos, na ordem em que serão lançadas. */
  valores: number[];
  /** Quanto a compra custa no fim, somando as parcelas. */
  totalCentavos: number;
  /** Quanto disso é juros. Zero numa compra sem juros. */
  jurosCentavos: number;
}

/**
 * Divide uma compra em parcelas.
 *
 * Sem juros, o total é repartido exatamente e a sobra dos centavos vai na
 * primeira parcela — assim a soma bate com o valor da compra até o último
 * centavo.
 *
 * Com juros, `jurosMensal` é a taxa ao mês em porcentagem (2 = 2% a.m.), que é
 * como a loja e o cartão anunciam. A parcela sai pela tabela Price:
 *
 *     parcela = valor x i / (1 - (1 + i)^-n)
 *
 * Todas as parcelas ficam iguais e arredondadas ao centavo, que é exatamente o
 * que aparece na fatura — por isso o total devolvido é `parcela x n`, e não o
 * valor teórico com casas fracionárias.
 */
export function calcularParcelas(
  valorCentavos: number,
  parcelas: number,
  jurosMensal = 0,
): Parcelamento {
  const n = Math.max(1, Math.trunc(parcelas));

  if (!(jurosMensal > 0) || n === 1) {
    const base = Math.floor(valorCentavos / n);
    const sobra = valorCentavos - base * n;
    const valores = Array.from({ length: n }, (_, i) => (i === 0 ? base + sobra : base));
    return { valores, totalCentavos: valorCentavos, jurosCentavos: 0 };
  }

  const i = jurosMensal / 100;
  const parcela = Math.round((valorCentavos * i) / (1 - Math.pow(1 + i, -n)));
  const valores = Array.from({ length: n }, () => parcela);
  const totalCentavos = parcela * n;
  return { valores, totalCentavos, jurosCentavos: totalCentavos - valorCentavos };
}

/**
 * Percentual inteiro de `parte` sobre `total`, para as barras do Resumo.
 * Devolve 0 quando o total é zero, evitando divisão por zero na interface.
 */
export function percentual(parte: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((parte / total) * 100);
}
