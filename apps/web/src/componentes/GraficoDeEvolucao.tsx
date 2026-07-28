import { formatarBRL, formatarBRLCurto, type Evolucao } from '@gastos/core';
import type { ReactElement } from 'react';

/**
 * Barras verticais, uma por mês, com uma linha tracejada na média. Sem eixos
 * nem grade: o número que importa está escrito em cima da barra.
 */
export function GraficoDeEvolucao({ evolucao }: { evolucao: Evolucao }): ReactElement {
  const maior = Math.max(evolucao.maiorCentavos, 1);
  const alturaDaMedia = (evolucao.mediaCentavos / maior) * 100;

  return (
    <div>
      {/* `items-stretch` + `h-full` nas colunas: sem um pai de altura definida,
          a altura em porcentagem das barras resolveria para zero. */}
      <div className="relative flex h-52 items-stretch gap-2 border-b-2 border-slate-200">
        {evolucao.mediaCentavos > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-slate-300"
            style={{ bottom: `${alturaDaMedia * 0.85}%` }}
            aria-hidden="true"
          />
        )}

        {evolucao.pontos.map((ponto) => {
          const altura = (ponto.totalCentavos / maior) * 100;
          const ehMaior = ponto.totalCentavos === evolucao.maiorCentavos && ponto.totalCentavos > 0;
          return (
            <div
              key={`${ponto.ano}-${ponto.mes}`}
              // `min-w-0`: sem isso o valor escrito acima da barra alarga a
              // coluna e as barras saem do lugar em relação aos meses.
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <div
                className={`relative w-full rounded-t-lg ${ehMaior ? 'bg-marca-700' : 'bg-marca-500'}`}
                // Os 85% deixam espaço para o valor escrito acima da barra.
                style={{ height: `${Math.max(altura * 0.85, ponto.totalCentavos > 0 ? 4 : 0)}%` }}
                role="img"
                aria-label={`${ponto.rotulo} de ${ponto.ano}: ${formatarBRL(ponto.totalCentavos)}`}
              >
                {/* Fora do fluxo, para não influenciar a largura da coluna. */}
                {ponto.totalCentavos > 0 && (
                  <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-xs font-medium tabular-nums text-slate-600">
                    {formatarBRLCurto(ponto.totalCentavos)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-2">
        {evolucao.pontos.map((ponto) => (
          <span
            key={`${ponto.ano}-${ponto.mes}`}
            className="flex-1 text-center text-sm text-slate-600"
          >
            {ponto.rotulo}
          </span>
        ))}
      </div>

      {evolucao.mediaCentavos > 0 && (
        <p className="mt-3 flex items-center gap-2 text-base text-slate-700">
          <span className="inline-block w-6 border-t-2 border-dashed border-slate-400" aria-hidden="true" />
          Média dos meses com gasto: {formatarBRL(evolucao.mediaCentavos)}
        </p>
      )}
    </div>
  );
}
