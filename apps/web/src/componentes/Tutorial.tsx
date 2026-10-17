import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icone } from './Icone';
import { useT } from '../i18n';

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
 *
 * As inscrições formam uma PILHA, e não um valor só. A ordem dela é por tempo
 * de inscrição: como efeito de filho roda antes do de pai, um painel que já
 * nascesse aberto junto com a tela (link direto, por exemplo) entraria ABAIXO
 * dela na pilha, e a página ganharia a vez. Hoje não acontece porque painel só
 * monta depois de alguém tocar nele.
 * Um painel que abre por
 * cima da página — orçamento, calculadora, cartões — inscreve o próprio
 * tutorial, que roda na primeira vez que aquilo é aberto e responde ao `(?)`
 * enquanto estiver na tela; ao fechar, a página embaixo volta a ser a dona.
 * Sem a pilha, o `(?)` continuaria explicando o painel que já saiu da tela.
 */

export interface PassoDeTutorial {
  /** Valor do `data-tutorial` do elemento a destacar. */
  alvo: string;
  titulo: string;
  texto: string;
}

interface ContextoTutorial {
  /**
   * Inscreve os passos de uma tela ou painel e roda na primeira visita.
   * Devolve a função que dá baixa na inscrição — quem inscreveu por último e
   * sai da tela devolve a vez a quem estava embaixo.
   */
  registrar(pagina: string, passos: PassoDeTutorial[]): () => void;
  /** Reabre o tutorial de quem está por cima (botão de ajuda). */
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

interface Inscricao {
  pagina: string;
  passos: PassoDeTutorial[];
}

export function ProvedorDeTutorial({ children }: { children: ReactNode }): ReactElement {
  const [pilha, setPilha] = useState<Inscricao[]>([]);
  const [indice, setIndice] = useState<number | null>(null);

  const dona = pilha[pilha.length - 1];
  const pagina = dona?.pagina ?? null;
  const passos = useMemo(() => dona?.passos ?? [], [dona]);

  const registrar = useCallback((novaPagina: string, novosPassos: PassoDeTutorial[]) => {
    const inscricao: Inscricao = { pagina: novaPagina, passos: novosPassos };
    setPilha((atual) => [...atual, inscricao]);

    // A inscrição é imediata; só ABRIR sozinho é que espera um quadro, para os
    // elementos já estarem no lugar quando forem medidos. Adiar a inscrição
    // também deixava a pilha vazia por 120 ms a cada troca de tela — e o `(?)`
    // sumia e voltava, empurrando a calculadora ao lado.
    let relogio: ReturnType<typeof setTimeout> | null = null;
    if (jaViu(novaPagina)) {
      // Painel já visto abrindo por cima de um tutorial em andamento: o passo
      // da página falaria de um elemento que agora está atrás do painel.
      setIndice(null);
    } else {
      relogio = setTimeout(() => setIndice(primeiroPassoVisivel(novosPassos, 0)), 120);
    }

    return () => {
      if (relogio) clearTimeout(relogio);
      setPilha((atual) => atual.filter((outra) => outra !== inscricao));
      // Fechar o painel fecha o passo que falava dele: o furo apontaria para um
      // elemento que não está mais lá.
      setIndice(null);
    };
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
  const t = useT();
  const passo = passos[indice];
  const [area, setArea] = useState<Retangulo | null>(null);
  const cartao = useRef<HTMLDivElement>(null);

  // Sem isto o foco fica onde estava — num campo do painel, atrás do
  // escurecido, invisível e inclicável. Quem navega por teclado ou leitor de
  // tela ficava tateando o que o tutorial justamente está escondendo.
  useEffect(() => {
    cartao.current?.focus();
  }, [indice]);

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

  // Em captura e cortando o evento ali mesmo: o `Dialogo` embaixo também ouve
  // Esc no `document`, e sem isto um Esc fecharia o tutorial E o painel que ele
  // está explicando — além de marcar o tutorial como visto no primeiro passo,
  // para nunca mais voltar. O `preventDefault` do espaço é pelo mesmo motivo:
  // o foco ainda está num campo atrás do escurecido.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key !== 'Escape' && evento.key !== 'Enter' && evento.key !== ' ') return;
      evento.preventDefault();
      evento.stopImmediatePropagation();
      if (evento.key === 'Escape') aoFechar();
      else aoAvancar();
    };
    document.addEventListener('keydown', aoTeclar, true);
    return () => document.removeEventListener('keydown', aoTeclar, true);
  }, [aoAvancar, aoFechar]);

  if (!passo) return null;

  const ultimo = indice === passos.length - 1;
  // O cartão fica embaixo do destaque; se não couber, vai para cima.
  const abaixo = area ? area.top + area.height + 200 < window.innerHeight : true;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Ajuda: {titulo}', { titulo: t(passo.titulo) })}
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
        aria-label={t('Avançar')}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={aoAvancar}
      />

      <div
        ref={cartao}
        tabIndex={-1}
        className="absolute inset-x-4 mx-auto max-w-sm rounded-2xl bg-white p-5 shadow-2xl
          outline-none"
        style={
          area
            ? abaixo
              ? { top: area.top + area.height + 16 }
              : { top: Math.max(16, area.top - 200) }
            : { top: '50%', transform: 'translateY(-50%)' }
        }
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">{t(passo.titulo)}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label={t('Fechar ajuda')}
            className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <Icone nome="fechar" tamanho={20} />
          </button>
        </div>

        <p className="text-base text-slate-700">{t(passo.texto)}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-label={t('Passo {atual} de {total}', { atual: indice + 1, total: passos.length })}>
            {/* Pelo índice, e não pelo alvo: dois passos seguidos podem explicar
                partes diferentes do MESMO elemento — na conta fixa, "só vira
                gasto no dia" e "paga ou atrasada" são a mesma lista. */}
            {passos.map((_, i) => (
              <span
                key={i}
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
                {t('Pular')}
              </button>
            )}
            <button
              type="button"
              onClick={aoAvancar}
              className="min-h-toque rounded-xl bg-marca-700 px-5 text-base font-semibold text-white hover:bg-marca-800"
            >
              {ultimo ? t('Entendi') : t('Próximo')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Declara os passos de uma tela ou de um painel. Chame uma vez, no topo do
 * componente; num painel, basta ele só existir enquanto estiver aberto.
 * Os passos precisam ser estáveis entre renderizações — declare fora do
 * componente ou memorize.
 */
export function useTutorialDaPagina(pagina: string, passos: PassoDeTutorial[]): void {
  // Só o `registrar`, e NÃO o contexto inteiro: `temTutorial` muda justamente
  // quando alguém se inscreve, então depender do objeto faria este efeito dar
  // baixa e se reinscrever a cada inscrição — um laço sem fim. `registrar` tem
  // identidade estável de propósito.
  const registrar = useContext(Contexto)?.registrar;

  useEffect(() => {
    if (!registrar) return;
    return registrar(pagina, passos);
    // `passos` vem de constante de módulo, então não remonta a cada render.
  }, [pagina, passos, registrar]);
}

export function useTutorial(): ContextoTutorial {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useTutorial precisa estar dentro de ProvedorDeTutorial');
  return contexto;
}

/**
 * Botão `(?)`, que reabre o tutorial da página aberta.
 *
 * Não se posiciona: quem decide onde ele fica é a coluna de atalhos do
 * `Layout`. Antes ele calculava o próprio `bottom` a partir da altura do "+",
 * e o segundo atalho flutuante teria de repetir a conta com outro número.
 */
export function BotaoDeAjuda(): ReactElement | null {
  const t = useT();
  const { reabrir, temTutorial } = useTutorial();
  if (!temTutorial) return null;

  return (
    <button
      type="button"
      onClick={reabrir}
      aria-label={t('Ajuda desta tela')}
      title={t('Ajuda desta tela')}
      className="flex h-11 w-11 items-center justify-center rounded-full border
        border-slate-200 bg-white text-lg font-bold text-marca-700 shadow-sm
        transition-colors hover:bg-marca-50 active:bg-marca-100"
    >
      ?
    </button>
  );
}

/**
 * `(?)` do cabeçalho de um painel.
 *
 * O atalho flutuante da tela mora numa camada abaixo do `Dialogo`, coberto
 * pelo escurecido — então, dentro de um painel, ele não existe. Sem este
 * botão, a explicação do painel rodaria na primeira abertura e nunca mais.
 *
 * Usa o contexto direto em vez do `useTutorial()` para não explodir caso um
 * `Dialogo` seja montado fora do provedor (num teste, por exemplo): ajuda que
 * falta é um botão a menos, não uma tela quebrada.
 */
export function AjudaDoPainel(): ReactElement | null {
  const t = useT();
  const contexto = useContext(Contexto);
  if (!contexto?.temTutorial) return null;

  return (
    <button
      type="button"
      onClick={contexto.reabrir}
      aria-label={t('Ajuda desta tela')}
      title={t('Ajuda desta tela')}
      className="flex h-toque w-toque items-center justify-center rounded-full
        text-lg font-bold text-marca-700 hover:bg-marca-50"
    >
      ?
    </button>
  );
}
