import type { Idioma } from '@gastos/core';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { EN } from './en';

/**
 * Tradução da interface.
 *
 * A chave é o próprio texto em português — ver o comentário em `en.ts`. Sem
 * tradução, `t` devolve a chave, então o pior caso é a frase aparecer em
 * português, e nunca um código na cara do usuário.
 */

export type { Idioma };

const CHAVE = 'familyfinance.idioma';

export const IDIOMAS: Array<{ valor: Idioma; rotulo: string }> = [
  { valor: 'pt', rotulo: 'PT' },
  { valor: 'en', rotulo: 'EN' },
];

function idiomaInicial(): Idioma {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === 'pt' || salvo === 'en') return salvo;
  } catch {
    // Navegador restrito: segue pela língua do aparelho.
  }
  // Só assume inglês quando o aparelho não é português — na dúvida, português.
  return typeof navigator !== 'undefined' && !navigator.language?.toLowerCase().startsWith('pt')
    ? 'en'
    : 'pt';
}

type Valores = Record<string, string | number>;

/** Substitui `{nome}` pelos valores passados. */
function preencher(texto: string, valores?: Valores): string {
  if (!valores) return texto;
  return texto.replace(/\{(\w+)\}/g, (original, chave: string) =>
    chave in valores ? String(valores[chave]) : original,
  );
}

export function traduzir(idioma: Idioma, chave: string, valores?: Valores): string {
  const texto = idioma === 'en' ? (EN[chave] ?? chave) : chave;
  return preencher(texto, valores);
}

interface ContextoIdioma {
  idioma: Idioma;
  trocar(idioma: Idioma): void;
  t(chave: string, valores?: Valores): string;
  /** Plural: escolhe a chave pela quantidade e a injeta como `{quantidade}`. */
  tp(quantidade: number, singular: string, plural: string, valores?: Valores): string;
}

const Contexto = createContext<ContextoIdioma | null>(null);

export function ProvedorDeIdioma({ children }: { children: ReactNode }): ReactElement {
  const [idioma, setIdioma] = useState<Idioma>(idiomaInicial);

  const trocar = useCallback((novo: Idioma) => {
    setIdioma(novo);
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      // Sem memória do navegador, vale só para esta sessão.
    }
    document.documentElement.lang = novo === 'en' ? 'en' : 'pt-BR';
  }, []);

  const valor = useMemo<ContextoIdioma>(
    () => ({
      idioma,
      trocar,
      t: (chave, valores) => traduzir(idioma, chave, valores),
      tp: (quantidade, singular, plural, valores) =>
        traduzir(idioma, quantidade === 1 ? singular : plural, { quantidade, ...valores }),
    }),
    [idioma, trocar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useIdioma(): ContextoIdioma {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useIdioma precisa estar dentro de ProvedorDeIdioma');
  return contexto;
}

/** Atalho para quem só precisa traduzir. */
export function useT(): (chave: string, valores?: Valores) => string {
  return useIdioma().t;
}

/** Botão PT | EN. Fica visível para poder trocar a qualquer momento. */
export function SeletorDeIdioma({ className = '' }: { className?: string }): ReactElement {
  const { idioma, trocar } = useIdioma();

  return (
    <div
      role="group"
      aria-label={traduzir(idioma, 'Idioma')}
      className={`inline-flex overflow-hidden rounded-xl border-2 border-slate-300 ${className}`}
    >
      {IDIOMAS.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          aria-pressed={idioma === opcao.valor}
          onClick={() => trocar(opcao.valor)}
          className={`min-h-toque px-4 text-base font-semibold ${
            idioma === opcao.valor
              ? 'bg-marca-600 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  );
}
