import { criarCliente, type ArmazenamentoDeSessao, type Sessao } from '@gastos/core';

const CHAVE = 'gastos.sessao';

/**
 * A sessão fica no localStorage para o usuário não precisar entrar de novo a
 * cada vez que abre o app — especialmente quando instalado na tela inicial.
 */
const armazenamento: ArmazenamentoDeSessao = {
  ler() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      return bruto ? (JSON.parse(bruto) as Sessao) : null;
    } catch {
      return null;
    }
  },
  gravar(sessao) {
    try {
      if (sessao) localStorage.setItem(CHAVE, JSON.stringify(sessao));
      else localStorage.removeItem(CHAVE);
    } catch {
      // Navegador em modo restrito: seguimos só com a sessão em memória.
    }
    // Avisa as telas (e as outras abas abertas) que a sessão mudou.
    window.dispatchEvent(new CustomEvent('sessao-alterada'));
  },
};

export const api = criarCliente({
  // Lido do mesmo lugar que o seletor grava: o cliente não depende do React.
  idioma: () => {
    try {
      return localStorage.getItem('familyfinance.idioma') === 'en' ? 'en' : 'pt';
    } catch {
      return 'pt';
    }
  },
  // Em desenvolvimento o Vite repassa /api para o backend; em produção o mesmo
  // domínio serve o app e a API.
  baseUrl: import.meta.env.VITE_API_URL ?? '',
  armazenamento,
  aoPerderSessao: () => {
    window.dispatchEvent(new CustomEvent('sessao-alterada'));
  },
});

export function lerSessaoLocal(): Sessao | null {
  const valor = armazenamento.ler();
  return valor instanceof Promise ? null : valor;
}
