import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icone } from './Icone';

/**
 * Tutorial em "quadrados flutuantes".
 *
 * A tela escurece e só o elemento explicado fica iluminado, com um cartão ao
 * lado dizendo para que serve. Roda sozinho na primeira visita de cada página
 * e volta quando a pessoa toca no botão `(?)`.
 *
 * Cada passo aponta para um elemento pelo atributo `data-tutorial`, e não por
 * classe ou posição: mexer no visual da tela não quebra o tutorial, e um passo
 * cujo alvo não existe naquele momento é simplesmente pulado.
 */

export interface PassoDeTutorial {
  /** Valor do `data-tutorial` do elemento a destacar. */
  alvo: string;
  titulo: string;
  texto: string;
}

interface ContextoTutorial {
  /** Registra os passos da página aberta e roda na primeira visita. */
  registrar(pagina: string, passos: PassoDeTutorial[]): void;
  /** Reabre o tutorial da página atual (botão de ajuda). */
  reabrir(): void;
  temTutorial: boolean;
}

const Contexto = createContext<ContextoTutorial | null>(null);

const chaveDeVisita = (pagina: string): string => `familyfinance.tutorial.${pagina}`;

function jaViu(pagina: string): boolean {
  try {
    return localStorage.getItem(chaveDeVisita(pagina)) === 'visto';
  } catch {
    // Navegador em modo restrito: mostrar de novo é melhor que quebrar.
    return false;
  }
}

function marcarComoVisto(pagina: string): void {
  try {
    localStorage.setItem(chaveDeVisita(pagina), 'visto');
  } catch {
    /* segue sem lembrar */
  }
}

export function ProvedorDeTutorial({ children }: { children: ReactNode }): ReactElement {
  const [pagina, setPagina] = useState<string | null>(null);
  const [passos, setPassos] = useState<PassoDeTutorial[]>([]);
  const [indice, setIndice] = useState<number | null>(null);

  const registrar = useCallback((novaPagina: string, novosPassos: PassoDeTutorial[]) => {
    setPagina(novaPagina);
    setPassos(novosPassos);
    // Espera a tela pintar antes de medir os elementos.
    setIndice(jaViu(novaPagina) ? null : primeiroPassoVisivel(novosPassos, 0));
  }, []);

  // Se nenhum passo tem alvo na tela, ainda assim abre o primeiro: o botão de
  // ajuda precisa responder a um toque, nem que seja com o texto centralizado.
  const reabrir = useCallback(() => setIndice(primeiroPassoVisivel(passos, 0) ?? 0), [passos]);

  const fechar = useCallback(() => {
    if (pagina) marcarComoVisto(pagina);
    setIndice(null);
  }, [pagina]);

  const valor = useMemo<ContextoTutorial>(
    () => ({ registrar, reabrir, temTutorial: passos.length > 0 }),
    [registrar, reabrir, passos.length],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      {indice !== null && passos.length > 0 && (
        <Passo
          passos={passos}
          indice={indice}
          aoAvancar={() => {
            // Pula o que não está na tela: numa página sem gastos, por exemplo,
            // o passo do total não tem o que destacar.
            const proximo = primeiroPassoVisivel(passos, indice + 1);
            if (proximo === null) fechar();
            else setIndice(proximo);
          }}
          aoFechar={fechar}
        />
      )}
    </Contexto.Provider>
  );
}

interface Retangulo {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Cantos copiados do elemento: o furo acompanha um botão redondo. */
  raio: string;
}

/**
 * O primeiro alvo *visível* com aquele `data-tutorial`.
 *
 * Existe porque o mesmo passo aponta para dois elementos que se revezam por
 * tamanho de tela — o "Adicionar gasto" da barra lateral e o "+" flutuante do
 * celular. O escondido pelo CSS mede zero e ficaria no canto da tela.
 */
/**
 * Índice do primeiro passo, a partir de `inicio`, cujo alvo existe na tela.
 * `null` quando não há nenhum — página vazia, seção que ainda não carregou.
 */
function primeiroPassoVisivel(passos: PassoDeTutorial[], inicio: number): number | null {
  for (let i = inicio; i < passos.length; i += 1) {
    if (acharAlvo(passos[i]!.alvo)) return i;
  }
  return null;
}

function acharAlvo(marca: string): HTMLElement | null {
  const candidatos = document.querySelectorAll<HTMLElement>(`[data-tutorial="${marca}"]`);
  for (const elemento of candidatos) {
    const caixa = elemento.getBoundingClientRect();
    if (caixa.width > 0 && caixa.height > 0) return elemento;
  }
  return null;
}

function Passo({
  passos,
  indice,
  aoAvancar,
  aoFechar,
}: {
  passos: PassoDeTutorial[];
  indice: number;
  aoAvancar: () => void;
  aoFechar: () => void;
}): ReactElement | null {
  const passo = passos[indice];
  const [area, setArea] = useState<Retangulo | null>(null);

  // `useLayoutEffect`: mede antes de pintar, para o furo não aparecer no lugar
  // errado por um quadro.
  useLayoutEffect(() => {
    if (!passo) return;
    const elemento = acharAlvo(passo.alvo);
    if (!elemento) {
      setArea(null);
      return;
    }

    // Rolagem instantânea, não suave: com animação a medição acontecia no
    // meio do caminho e o destaque caía no elemento errado. Instantâneo também
    // é o certo para quem pediu menos movimento no sistema.
    elemento.scrollIntoView({ block: 'center', behavior: 'auto' });

    const medir = (): void => {
      // Reencontra o alvo a cada medição: girar o celular ou redimensionar a
      // janela pode trocar qual dos elementos do passo está visível.
      const atual = acharAlvo(passo.alvo) ?? elemento;
      const caixa = atual.getBoundingClientRect();
      const folga = 8;
      const cantos = getComputedStyle(atual).borderRadius;
      setArea({
        top: caixa.top - folga,
        left: caixa.left - folga,
        width: caixa.width + folga * 2,
        height: caixa.height + folga * 2,
        // `calc` mantém o círculo redondo e o retângulo com o canto certo,
        // já contando a folga em volta.
        raio: cantos === '0px' ? '0.75rem' : `calc(${cantos} + ${folga}px)`,
      });
    };

    medir();
    // Continua medindo se a página se mexer (imagem que carrega, teclado, giro).
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [passo]);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') aoFechar();
      if (evento.key === 'Enter' || evento.key === ' ') aoAvancar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aoAvancar, aoFechar]);

  if (!passo) return null;

  const ultimo = indice === passos.length - 1;
  // O cartão fica embaixo do destaque; se não couber, vai para cima.
  const abaixo = area ? area.top + area.height + 200 < window.innerHeight : true;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ajuda: ${passo.titulo}`}
      className="fixed inset-0 z-[60]"
    >
      {area ? (
        // O escurecimento é a sombra deste retângulo: o "furo" é o próprio
        // elemento, que continua nítido e no lugar.
        <div
          className="pointer-events-none absolute ring-4 ring-menta-500 transition-all duration-200"
          style={{
            top: area.top,
            left: area.left,
            width: area.width,
            height: area.height,
            borderRadius: area.raio,
            boxShadow: '0 0 0 9999px rgba(10, 42, 70, 0.75)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-marca-800/75" />
      )}

      {/* Clicar fora avança, como a pessoa espera de um passo a passo. */}
      <button
        type="button"
        aria-label="Avançar"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={aoAvancar}
      />

      <div
        className="absolute inset-x-4 mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        style={
          area
            ? abaixo
              ? { top: area.top + area.height + 16 }
              : { top: Math.max(16, area.top - 200) }
            : { top: '50%', transform: 'translateY(-50%)' }
        }
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">{passo.titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar ajuda"
            className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <Icone nome="fechar" tamanho={20} />
          </button>
        </div>

        <p className="text-base text-slate-700">{passo.texto}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-label={`Passo ${indice + 1} de ${passos.length}`}>
            {passos.map((outro, i) => (
              <span
                key={outro.alvo}
                className={`h-2 w-2 rounded-full ${i === indice ? 'bg-marca-700' : 'bg-slate-300'}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {!ultimo && (
              <button
                type="button"
                onClick={aoFechar}
                className="min-h-toque px-3 text-base font-medium text-slate-600 hover:underline"
              >
                Pular
              </button>
            )}
            <button
              type="button"
              onClick={aoAvancar}
              className="min-h-toque rounded-xl bg-marca-700 px-5 text-base font-semibold text-white hover:bg-marca-800"
            >
              {ultimo ? 'Entendi' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Declara os passos da página. Chame uma vez, no topo da tela.
 * Os passos precisam ser estáveis entre renderizações — declare fora do
 * componente ou memorize.
 */
export function useTutorialDaPagina(pagina: string, passos: PassoDeTutorial[]): void {
  const contexto = useContext(Contexto);

  useEffect(() => {
    if (!contexto) return;
    // Um quadro de espera para os elementos já estarem no lugar quando medirmos.
    const relogio = setTimeout(() => contexto.registrar(pagina, passos), 120);
    return () => clearTimeout(relogio);
    // `contexto.registrar` é estável; `passos` vem de constante de módulo.
  }, [pagina, passos, contexto]);
}

export function useTutorial(): ContextoTutorial {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useTutorial precisa estar dentro de ProvedorDeTutorial');
  return contexto;
}

/**
 * Botão `(?)` fixo, que reabre o tutorial da página aberta.
 *
 * No celular fica na coluna do "+", empilhado logo acima dele quando o "+"
 * existe — os dois atalhos no mesmo canto, ao alcance do polegar. Onde não há
 * "+", ocupa o lugar dele. No computador volta para o topo direito.
 *
 * As posições vão em classe, e não em `style`, para o `md:` conseguir
 * sobrescrever: estilo inline venceria a media query.
 */
export function BotaoDeAjuda({
  acimaDoBotaoAdicionar = false,
}: {
  acimaDoBotaoAdicionar?: boolean;
}): ReactElement | null {
  const { reabrir, temTutorial } = useTutorial();
  if (!temTutorial) return null;

  // O "+" tem 64px e começa a 6rem do fim; 11.5rem deixa o (?) logo acima dele.
  // O recuo à direita é maior porque o (?) é menor: assim os dois ficam com o
  // mesmo centro na vertical.
  const posicao = acimaDoBotaoAdicionar
    ? 'bottom-[calc(11.5rem_+_env(safe-area-inset-bottom))] right-[1.875rem]'
    : 'bottom-[calc(6rem_+_env(safe-area-inset-bottom))] right-[1.875rem]';

  return (
    <button
      type="button"
      onClick={reabrir}
      aria-label="Ajuda desta tela"
      title="Ajuda desta tela"
      className={`fixed z-40 flex h-11 w-11 items-center justify-center rounded-full border
        border-slate-200 bg-white text-lg font-bold text-marca-700 shadow-sm hover:bg-marca-50
        md:bottom-auto md:right-6 md:top-6 ${posicao}`}
    >
      ?
    </button>
  );
}
