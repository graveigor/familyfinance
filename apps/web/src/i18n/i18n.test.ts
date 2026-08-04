import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EN } from './en';
import { traduzir } from './index';

/**
 * A chave da tradução é o próprio texto em português, o que é cômodo de ler no
 * código mas frágil sozinho: mudar a frase numa tela deixaria a tradução para
 * trás em silêncio, e a pessoa veria português no meio do inglês.
 *
 * Este teste fecha esse buraco: varre as telas atrás de `t('...')` e exige que
 * toda chave usada exista no dicionário.
 */

const RAIZ = join(import.meta.dirname, '..');

function arquivosDeCodigo(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosDeCodigo(caminho);
    return /\.tsx?$/.test(nome) && !nome.endsWith('.test.ts') ? [caminho] : [];
  });
}

/** `t('texto')` e `t('texto', { ... })`, com aspas simples ou duplas. */
const USO_DE_T = /\bt\(\s*(['"])((?:\\.|(?!\1)[^\\])+)\1/g;

/** `tp(n, 'singular', 'plural')` — as duas formas precisam de tradução. */
const USO_DE_TP =
  /\btp\(\s*[^,]+,\s*(['"])((?:\\.|(?!\1)[^\\])+)\1\s*,\s*(['"])((?:\\.|(?!\3)[^\\])+)\3/g;

function chavesUsadas(): Map<string, string> {
  const encontradas = new Map<string, string>();
  for (const arquivo of arquivosDeCodigo(RAIZ)) {
    // O próprio dicionário não usa `t`.
    if (arquivo.includes(join('i18n', 'en.ts'))) continue;
    const conteudo = readFileSync(arquivo, 'utf8');
    const guardar = (bruta: string): void => {
      const chave = bruta.replace(/\\'/g, "'");
      if (!encontradas.has(chave)) encontradas.set(chave, arquivo.replace(RAIZ, ''));
    };
    for (const achado of conteudo.matchAll(USO_DE_T)) guardar(achado[2]!);
    for (const achado of conteudo.matchAll(USO_DE_TP)) {
      guardar(achado[2]!);
      guardar(achado[4]!);
    }
  }
  return encontradas;
}

describe('tradução', () => {
  it('toda chave usada nas telas tem versão em inglês', () => {
    const semTraducao = [...chavesUsadas().entries()]
      .filter(([chave]) => !(chave in EN))
      .map(([chave, arquivo]) => `${chave}  (${arquivo})`);

    expect(semTraducao).toEqual([]);
  });

  it('os trechos entre chaves aparecem nos dois idiomas', () => {
    const marcadores = (texto: string): string[] =>
      [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

    const divergentes = Object.entries(EN)
      .filter(([pt, en]) => marcadores(pt).join() !== marcadores(en).join())
      .map(([pt]) => pt);

    expect(divergentes).toEqual([]);
  });

  it('sem tradução, devolve o português em vez de chave crua', () => {
    expect(traduzir('en', 'Frase que ninguém traduziu ainda')).toBe(
      'Frase que ninguém traduziu ainda',
    );
    expect(traduzir('pt', 'Gastos')).toBe('Gastos');
    expect(traduzir('en', 'Gastos')).toBe('Expenses');
  });

  it('substitui os valores no texto traduzido', () => {
    expect(traduzir('en', 'Olá, {nome}', { nome: 'Ana' })).toBe('Hi, Ana');
    expect(traduzir('pt', 'Olá, {nome}', { nome: 'Ana' })).toBe('Olá, Ana');
  });
});
