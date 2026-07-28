import AsyncStorage from '@react-native-async-storage/async-storage';
import { criarCliente, type ArmazenamentoDeSessao, type Sessao } from '@gastos/core';
import Constants from 'expo-constants';

const CHAVE = 'gastos.sessao';

/**
 * Onde está a API.
 *
 * Em produção, `EXPO_PUBLIC_API_URL` aponta para o servidor de verdade.
 * Em desenvolvimento, o celular não enxerga "localhost" — ele precisa do IP da
 * máquina na rede. O Expo já sabe esse IP (é por ele que o app carrega), então
 * reaproveitamos o mesmo endereço trocando a porta.
 */
function descobrirEnderecoDaApi(): string {
  const configurado = process.env.EXPO_PUBLIC_API_URL;
  if (configurado) return configurado;

  const hostDoExpo =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    Constants.linkingUri;

  const ip = hostDoExpo?.split('://').pop()?.split(':')[0];
  return ip ? `http://${ip}:3333` : 'http://localhost:3333';
}

export const enderecoDaApi = descobrirEnderecoDaApi();

/**
 * A sessão fica no AsyncStorage. Como a leitura é assíncrona, guardamos uma
 * cópia em memória para o cliente HTTP não esperar disco a cada requisição.
 */
let emMemoria: Sessao | null = null;
let carregada = false;

const ouvintes = new Set<() => void>();

export function aoMudarSessao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

const armazenamento: ArmazenamentoDeSessao = {
  async ler() {
    if (carregada) return emMemoria;
    try {
      const bruto = await AsyncStorage.getItem(CHAVE);
      emMemoria = bruto ? (JSON.parse(bruto) as Sessao) : null;
    } catch {
      emMemoria = null;
    }
    carregada = true;
    return emMemoria;
  },
  async gravar(sessao) {
    emMemoria = sessao;
    carregada = true;
    try {
      if (sessao) await AsyncStorage.setItem(CHAVE, JSON.stringify(sessao));
      else await AsyncStorage.removeItem(CHAVE);
    } catch {
      // Sem disco disponível, seguimos com a sessão só em memória.
    }
    for (const ouvinte of ouvintes) ouvinte();
  },
};

export const api = criarCliente({
  baseUrl: enderecoDaApi,
  armazenamento,
  aoPerderSessao: () => {
    for (const ouvinte of ouvintes) ouvinte();
  },
});

export async function lerSessaoGuardada(): Promise<Sessao | null> {
  return armazenamento.ler();
}
