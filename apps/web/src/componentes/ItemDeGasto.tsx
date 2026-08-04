import { formatarBRL, type Gasto } from '@gastos/core';
import type { ReactElement } from 'react';
import { Icone } from './Icone';
import { useIdioma } from '../i18n';

/**
 * Linha de gasto. O valor fica maior e à direita, que é onde o olho procura;
 * a categoria aparece com ícone E nome — cor sozinha não informa nada a quem
 * não distingue tons.
 */
export function ItemDeGasto({
  gasto,
  aoTocar,
}: {
  gasto: Gasto;
  aoTocar?: (gasto: Gasto) => void;
}): ReactElement {
  const { t, idioma } = useIdioma();
  const conteudo = (
    <>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: gasto.categoria ? `${gasto.categoria.cor}1A` : '#F1F5F9',
          color: gasto.categoria?.cor ?? '#64748B',
        }}
      >
        <Icone nome={gasto.categoria?.icone ?? 'etiqueta'} tamanho={22} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-slate-900">
          {gasto.descricao}
        </span>
        {/* Quebra em vez de cortar: no celular o nome do cartão sumia no
            "..." e era justamente o que a pessoa queria conferir. */}
        <span className="flex flex-wrap items-center gap-x-1.5 text-sm text-slate-600">
          <span>{gasto.usuario.nome}</span>
          <span aria-hidden="true">·</span>
          <span>{t(gasto.categoria?.nome ?? 'Sem categoria')}</span>
          {gasto.cartao && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: gasto.cartao.cor }}
                />
                {gasto.cartao.nome}
              </span>
            </>
          )}
        </span>
      </span>

      <span
        className={`shrink-0 text-valor tabular-nums ${
          gasto.valorCentavos < 0 ? 'text-marca-700' : 'text-slate-900'
        }`}
      >
        {formatarBRL(gasto.valorCentavos, idioma)}
      </span>
    </>
  );

  if (!aoTocar) {
    return <div className="flex items-center gap-3 px-4 py-3">{conteudo}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => aoTocar(gasto)}
      className="flex min-h-toque w-full items-center gap-3 px-4 py-3 text-left transition-colors
        hover:bg-slate-50 active:bg-slate-100"
    >
      {conteudo}
    </button>
  );
}
