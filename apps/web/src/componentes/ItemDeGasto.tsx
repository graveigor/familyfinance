import { formatarBRL, type Gasto } from '@gastos/core';
import type { ReactElement } from 'react';
import { Icone } from './Icone';

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
        <span className="block truncate text-sm text-slate-600">
          {gasto.usuario.nome}
          {gasto.categoria ? ` · ${gasto.categoria.nome}` : ' · Sem categoria'}
        </span>
      </span>

      <span
        className={`shrink-0 text-valor tabular-nums ${
          gasto.valorCentavos < 0 ? 'text-marca-700' : 'text-slate-900'
        }`}
      >
        {formatarBRL(gasto.valorCentavos)}
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
