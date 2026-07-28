import type { CriarGastoEntrada } from '@gastos/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

/**
 * Fila de gastos lançados sem internet.
 *
 * A regra é não perder lançamento: se a chamada falhar por rede, o gasto entra
 * numa fila no próprio aparelho e é enviado quando a conexão volta. Só falha
 * de rede vai para a fila — erro de validação (valor zerado, categoria de outra
 * casa) precisa aparecer na hora, não ficar preso.
 */

const CHAVE = 'gastos.fila';

export interface ItemDaFila {
  /** Identificador local, para não depender do servidor antes de sincronizar. */
  id: string;
  dados: CriarGastoEntrada;
  criadoEm: string;
  /** Quantas vezes já tentamos enviar — útil para exibir e para depurar. */
  tentativas: number;
}

const ouvintes = new Set<(fila: ItemDaFila[]) => void>();
let cache: ItemDaFila[] | null = null;

async function ler(): Promise<ItemDaFila[]> {
  if (cache) return cache;
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    cache = bruto ? (JSON.parse(bruto) as ItemDaFila[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function gravar(fila: ItemDaFila[]): Promise<void> {
  cache = fila;
  try {
    await AsyncStorage.setItem(CHAVE, JSON.stringify(fila));
  } catch {
    // Sem disco: a fila continua valendo em memória nesta sessão.
  }
  for (const ouvinte of ouvintes) ouvinte(fila);
}

export function aoMudarFila(ouvinte: (fila: ItemDaFila[]) => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export async function lerFila(): Promise<ItemDaFila[]> {
  return [...(await ler())];
}

export async function enfileirar(dados: CriarGastoEntrada, id: string): Promise<void> {
  const fila = await ler();
  await gravar([...fila, { id, dados, criadoEm: new Date().toISOString(), tentativas: 0 }]);
}

export async function removerDaFila(id: string): Promise<void> {
  const fila = await ler();
  await gravar(fila.filter((item) => item.id !== id));
}

/** Falha de rede (vale a pena tentar de novo) x falha de dados (não vale). */
export function ehFalhaDeRede(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'codigo' in erro &&
    (erro as { codigo: unknown }).codigo === 'INTERNO'
  );
}

export interface ResultadoDaSincronizacao {
  enviados: number;
  restantes: number;
}

let sincronizando = false;

/**
 * Envia o que está na fila, um por um e na ordem em que foi lançado.
 *
 * Item recusado pelo servidor por dados inválidos sai da fila: insistir só o
 * deixaria preso para sempre. Falha de rede interrompe a rodada e o resto
 * espera a próxima.
 */
export async function sincronizar(): Promise<ResultadoDaSincronizacao> {
  if (sincronizando) return { enviados: 0, restantes: (await ler()).length };
  sincronizando = true;

  try {
    let fila = await ler();
    let enviados = 0;

    for (const item of [...fila]) {
      try {
        await api.gastos.criar(item.dados);
        fila = fila.filter((outro) => outro.id !== item.id);
        await gravar(fila);
        enviados += 1;
      } catch (erro) {
        if (ehFalhaDeRede(erro)) break; // Ainda sem internet: tenta na próxima.

        // O servidor recusou o conteúdo. Tirar da fila é o certo — ficaria
        // travando os lançamentos seguintes para sempre.
        fila = fila.filter((outro) => outro.id !== item.id);
        await gravar(fila);
      }
    }

    return { enviados, restantes: fila.length };
  } finally {
    sincronizando = false;
  }
}
