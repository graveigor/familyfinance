import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Botao } from './ui';
import { Icone } from './Icone';
import { AjudaDoPainel } from './Tutorial';
import { useT } from '../i18n';

/**
 * A trava de rolagem é do documento, e não de cada painel — por isso ela é
 * contada num lugar só.
 *
 * Antes cada painel guardava o `overflow` de antes e o devolvia ao fechar. Com
 * dois abertos ao mesmo tempo (um `Confirmar` por cima de um `Dialogo`, o que
 * acontece em Gastos, Família e Ajustes), os dois guardavam a MESMA variável
 * global em momentos diferentes: o segundo guardava "hidden", que era o valor
 * posto pelo primeiro. Fechando na ordem trocada, o último devolvia "hidden" e
 * a página nunca mais rolava — e só o F5 resolvia, porque recarregar zera o
 * estilo.
 *
 * Com um contador, o primeiro a abrir tranca e o último a fechar destranca. A
 * ordem deixa de importar, que é o ponto: ordem de desmontagem não é coisa que
 * dê para garantir no React.
 */
interface EstiloComOverflow {
  overflow: string;
}

let painesAbertos = 0;
let overflowAntesDoPrimeiro = '';

/** Tranca a rolagem e devolve a função que destranca. Exportada para teste. */
export function travarRolagem(estilo: EstiloComOverflow): () => void {
  if (painesAbertos === 0) {
    overflowAntesDoPrimeiro = estilo.overflow;
    estilo.overflow = 'hidden';
  }
  painesAbertos += 1;

  let jaDestravou = false;
  return () => {
    // O StrictMode monta e desmonta uma vez a mais no desenvolvimento; sem esta
    // guarda o contador ficaria negativo e a trava cairia cedo demais.
    if (jaDestravou) return;
    jaDestravou = true;
    painesAbertos -= 1;
    if (painesAbertos === 0) estilo.overflow = overflowAntesDoPrimeiro;
  };
}

/** Só para os testes, que precisam começar do zero em cada caso. */
export function zerarTravaDeRolagem(): void {
  painesAbertos = 0;
  overflowAntesDoPrimeiro = '';
}

/**
 * Painel que sobe pela base no celular e aparece centralizado no computador.
 * Fecha no Esc e no clique fora — nunca prende o usuário.
 */
export function Dialogo({
  aberto,
  aoFechar,
  titulo,
  children,
  rodape,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
}): ReactElement | null {
  const t = useT();
  const painel = useRef<HTMLDivElement>(null);

  // `aoFechar` costuma ser uma função nova a cada renderização (uma arrow
  // escrita na própria chamada). Ela ficava nas dependências do efeito abaixo,
  // que então re-rodava a cada tecla digitada — e levava junto o `focus()`,
  // tirando o cursor do campo que a pessoa estava preenchendo. Numa ref, o
  // efeito depende só de abrir e fechar.
  const aoFecharRef = useRef(aoFechar);
  aoFecharRef.current = aoFechar;

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') aoFecharRef.current();
    };
    document.addEventListener('keydown', aoTeclar);
    const destravarRolagem = travarRolagem(document.body.style);
    painel.current?.focus();
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      destravarRolagem();
    };
  }, [aberto]);

  if (!aberto) return null;

  // Vai direto para o <body>: assim o painel cobre a tela inteira, sem depender
  // de nenhum ancestral que possa criar bloco de contenção para `fixed`.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t('Fechar')}
        className="absolute inset-0 bg-slate-900/50"
        onClick={aoFechar}
      />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white
          shadow-xl outline-none sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <div className="-mr-2 flex items-center">
            {/* O `(?)` flutuante da tela fica ATRÁS deste painel e não aceita
                toque, então sem este aqui a explicação do painel seria coisa de
                uma vez só: rodaria na primeira abertura e nunca mais. */}
            <AjudaDoPainel />
            <button
              type="button"
              onClick={aoFechar}
              aria-label={t('Fechar')}
              className="flex h-toque w-toque items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            >
              <Icone nome="fechar" tamanho={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {rodape && (
          <div className="flex gap-3 border-t border-slate-200 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmação para tudo que apaga. A ação destrutiva nunca é o botão
 * automaticamente focado, e o texto diz exatamente o que vai acontecer.
 */
export function Confirmar({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar,
  aoConfirmar,
  aoCancelar,
  carregando = false,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  rotuloConfirmar?: string;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  carregando?: boolean;
}): ReactElement | null {
  const t = useT();
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoCancelar}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="secundario" larguraTotal onClick={aoCancelar}>
            {t('Cancelar')}
          </Botao>
          <Botao variante="perigo" larguraTotal onClick={aoConfirmar} carregando={carregando}>
            {rotuloConfirmar ?? t('Excluir')}
          </Botao>
        </>
      }
    >
      <p className="text-base text-slate-700">{descricao}</p>
    </Dialogo>
  );
}
