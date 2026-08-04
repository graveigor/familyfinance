import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Botao } from './ui';
import { Icone } from './Icone';
import { useT } from '../i18n';

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

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    // Trava o rolar do fundo enquanto o painel está aberto.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    painel.current?.focus();
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, aoFechar]);

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
          <button
            type="button"
            onClick={aoFechar}
            aria-label={t('Fechar')}
            className="-mr-2 flex h-toque w-toque items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          >
            <Icone nome="fechar" tamanho={24} />
          </button>
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
