import { ehCorpoErro, ErroApp } from '@gastos/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Icone } from './Icone';
import { useT } from '../i18n';

/** Peças de interface usadas em todas as telas. Alvo de toque mínimo: 48px. */

type Variante = 'principal' | 'secundario' | 'perigo' | 'texto';

const ESTILOS: Record<Variante, string> = {
  principal: 'bg-marca-600 text-white hover:bg-marca-700 active:bg-marca-800 shadow-sm',
  secundario: 'bg-white text-slate-800 border-2 border-slate-300 hover:bg-slate-50',
  perigo: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  texto: 'bg-transparent text-marca-700 hover:bg-marca-50 underline-offset-2 hover:underline',
};

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  carregando?: boolean;
  larguraTotal?: boolean;
  icone?: string;
}

export function Botao({
  variante = 'principal',
  carregando = false,
  larguraTotal = false,
  icone,
  children,
  className = '',
  disabled,
  ...resto
}: BotaoProps): ReactElement {
  return (
    <button
      type="button"
      disabled={disabled || carregando}
      className={`inline-flex min-h-toque items-center justify-center gap-2 rounded-xl px-5 py-3
        text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50
        ${ESTILOS[variante]} ${larguraTotal ? 'w-full' : ''} ${className}`}
      {...resto}
    >
      {carregando ? (
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        icone && <Icone nome={icone} tamanho={20} />
      )}
      {children}
    </button>
  );
}

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  erro?: string;
  /** Texto de apoio abaixo do campo, quando ajuda a evitar erro. */
  dica?: string;
}

export function Campo({ rotulo, erro, dica, id, className = '', type, ...resto }: CampoProps): ReactElement {
  const t = useT();
  const gerado = useRef(`campo-${Math.random().toString(36).slice(2, 9)}`);
  const idFinal = id ?? gerado.current;
  const ehSenha = type === 'password';
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  return (
    <div>
      <label htmlFor={idFinal} className="rotulo">
        {rotulo}
      </label>
      <div className={ehSenha ? 'relative' : undefined}>
        <input
          id={idFinal}
          type={ehSenha && senhaVisivel ? 'text' : type}
          className={`campo ${erro ? 'campo-com-erro' : ''} ${ehSenha ? 'pr-12' : ''} ${className}`}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${idFinal}-erro` : dica ? `${idFinal}-dica` : undefined}
          {...resto}
        />
        {ehSenha && (
          <button
            type="button"
            onClick={() => setSenhaVisivel(!senhaVisivel)}
            aria-label={senhaVisivel ? t('Esconder senha') : t('Mostrar senha')}
            aria-pressed={senhaVisivel}
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700"
          >
            <Icone nome={senhaVisivel ? 'olho-fechado' : 'olho'} tamanho={22} />
          </button>
        )}
      </div>
      {dica && !erro && (
        <p id={`${idFinal}-dica`} className="mt-1.5 text-sm text-slate-600">
          {dica}
        </p>
      )}
      {erro && (
        // Ícone + texto: a cor não é a única forma de indicar o erro.
        <p id={`${idFinal}-erro`} className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-red-700">
          <Icone nome="aviso" tamanho={16} />
          {erro}
        </p>
      )}
    </div>
  );
}

export function Carregando({ texto }: { texto?: string }): ReactElement {
  const t = useT();
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-600" role="status">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-marca-600"
        aria-hidden="true"
      />
      <span className="text-base">{texto ?? t('Carregando...')}</span>
    </div>
  );
}

export function Vazio({
  icone = 'planilha',
  titulo,
  descricao,
  acao,
}: {
  icone?: string;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="rounded-full bg-slate-100 p-4 text-slate-500">
        <Icone nome={icone} tamanho={32} />
      </span>
      <h2 className="text-lg font-semibold text-slate-800">{titulo}</h2>
      {descricao && <p className="max-w-sm text-base text-slate-600">{descricao}</p>}
      {acao}
    </div>
  );
}

/** Caixa de erro no topo do formulário, para o que não é de um campo só. */
export function CaixaDeErro({ mensagem }: { mensagem: string | null }): ReactElement | null {
  if (!mensagem) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-base text-red-800"
    >
      <span className="mt-0.5 shrink-0 text-red-600">
        <Icone nome="aviso" tamanho={20} />
      </span>
      <p>{mensagem}</p>
    </div>
  );
}

// --- Aviso discreto de confirmação ("Gasto salvo") --------------------------

interface ContextoAviso {
  mostrar(mensagem: string): void;
}

const AvisoContexto = createContext<ContextoAviso | null>(null);

export function ProvedorDeAviso({ children }: { children: ReactNode }): ReactElement {
  const [mensagem, setMensagem] = useState<string | null>(null);

  const mostrar = useCallback((texto: string) => setMensagem(texto), []);

  useEffect(() => {
    if (!mensagem) return;
    const relogio = setTimeout(() => setMensagem(null), 3500);
    return () => clearTimeout(relogio);
  }, [mensagem]);

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <AvisoContexto.Provider value={valor}>
      {children}
      {mensagem && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-2
            rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white shadow-lg
            md:bottom-6 md:left-auto md:right-6 md:mx-0"
        >
          <Icone nome="confirmado" tamanho={20} className="text-marca-200" />
          {mensagem}
        </div>
      )}
    </AvisoContexto.Provider>
  );
}

export function useAviso(): ContextoAviso {
  const contexto = useContext(AvisoContexto);
  if (!contexto) throw new Error('useAviso precisa estar dentro de ProvedorDeAviso');
  return contexto;
}

// --- Tradução de erro para a tela -------------------------------------------

export interface ErroDeFormulario {
  mensagem: string;
  campos: Record<string, string>;
}

/**
 * Converte qualquer coisa que o cliente HTTP jogue em algo exibível: mensagem
 * geral + erro por campo. Nunca deixa vazar texto técnico para o usuário.
 */
export function traduzirErro(erro: unknown): ErroDeFormulario {
  if (erro instanceof ErroApp) {
    return { mensagem: erro.message, campos: erro.campos ?? {} };
  }
  if (ehCorpoErro(erro)) {
    return { mensagem: erro.erro.mensagem, campos: erro.erro.campos ?? {} };
  }
  return {
    mensagem: 'Não conseguimos concluir agora. Tente novamente em instantes.',
    campos: {},
  };
}
