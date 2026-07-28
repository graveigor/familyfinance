import {
  formatarBRL,
  fraseComparacaoMensal,
  hoje,
  nomeCurtoDoMes,
  nomeDoMes,
  percentual,
  pluralizar,
  type ResumoMensal,
} from '@gastos/core';
import { useState, type ReactElement } from 'react';
import { Icone } from '../componentes/Icone';
import { CaixaDeErro, Carregando, Vazio, traduzirErro } from '../componentes/ui';
import { useResumoMensal } from '../consultas';

export function Resumo(): ReactElement {
  const agora = hoje();
  const [ano, setAno] = useState(agora.getUTCFullYear());
  const [mes, setMes] = useState(agora.getUTCMonth() + 1);
  const consulta = useResumoMensal(ano, mes);

  function mudarMes(passo: number): void {
    const novo = mes + passo;
    if (novo < 1) {
      setMes(12);
      setAno(ano - 1);
    } else if (novo > 12) {
      setMes(1);
      setAno(ano + 1);
    } else {
      setMes(novo);
    }
  }

  const ehMesAtual = ano === agora.getUTCFullYear() && mes === agora.getUTCMonth() + 1;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Resumo</h1>

      <div className="cartao flex items-center justify-between px-2 py-2">
        <button
          type="button"
          onClick={() => mudarMes(-1)}
          aria-label="Mês anterior"
          className="flex h-toque w-toque items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
        >
          <Icone nome="esquerda" tamanho={26} />
        </button>

        <p className="text-lg font-semibold text-slate-900">
          {nomeDoMes(mes).replace(/^./, (l) => l.toUpperCase())} de {ano}
        </p>

        <button
          type="button"
          onClick={() => mudarMes(1)}
          aria-label="Próximo mês"
          disabled={ehMesAtual}
          className="flex h-toque w-toque items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 disabled:opacity-30"
        >
          <Icone nome="direita" tamanho={26} />
        </button>
      </div>

      {consulta.isPending ? (
        <Carregando />
      ) : consulta.isError ? (
        <CaixaDeErro mensagem={traduzirErro(consulta.error).mensagem} />
      ) : consulta.data.quantidade === 0 ? (
        <Vazio
          icone="grafico"
          titulo={`Nenhum gasto em ${nomeDoMes(mes)}`}
          descricao="Escolha outro mês nas setas acima."
        />
      ) : (
        <ConteudoDoResumo resumo={consulta.data} />
      )}
    </div>
  );
}

function ConteudoDoResumo({ resumo }: { resumo: ResumoMensal }): ReactElement {
  return (
    <>
      <section className="cartao px-6 py-6 text-center">
        <p className="text-base text-slate-600">Total do mês</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
          {formatarBRL(resumo.totalCentavos)}
        </p>
        <p className="mt-2 text-base text-slate-700">{fraseComparacaoMensal(resumo)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {pluralizar(resumo.quantidade, 'gasto', 'gastos')} ·{' '}
          {nomeCurtoDoMes(resumo.mesAnterior.mes)} foi{' '}
          {formatarBRL(resumo.mesAnterior.totalCentavos)}
        </p>
      </section>

      <section className="cartao p-5" aria-labelledby="titulo-categorias">
        <h2 id="titulo-categorias" className="mb-4 text-base font-semibold text-slate-800">
          Por categoria
        </h2>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Rosca resumo={resumo} />
          <ul className="w-full flex-1 space-y-3">
            {resumo.porCategoria.map((linha) => {
              const parte = percentual(linha.totalCentavos, resumo.totalCentavos);
              const cor = linha.categoria?.cor ?? '#94A3B8';
              return (
                <li key={linha.categoria?.id ?? 'sem'} className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${cor}1A`, color: cor }}
                  >
                    <Icone nome={linha.categoria?.icone ?? 'etiqueta'} tamanho={18} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base text-slate-800">
                    {linha.categoria?.nome ?? 'Sem categoria'}
                  </span>
                  <span className="shrink-0 text-base font-semibold tabular-nums text-slate-900">
                    {formatarBRL(linha.totalCentavos)}
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm tabular-nums text-slate-600">
                    {parte}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="cartao p-5" aria-labelledby="titulo-pessoas">
        <h2 id="titulo-pessoas" className="mb-4 text-base font-semibold text-slate-800">
          Por pessoa
        </h2>
        <ul className="space-y-4">
          {resumo.porPessoa.map((linha) => {
            const parte = percentual(linha.totalCentavos, resumo.totalCentavos);
            return (
              <li key={linha.usuario.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="truncate text-base font-medium text-slate-800">
                    {linha.usuario.nome}
                  </span>
                  <span className="shrink-0 text-base font-semibold tabular-nums text-slate-900">
                    {formatarBRL(linha.totalCentavos)}
                    <span className="ml-2 text-sm font-normal text-slate-600">{parte}%</span>
                  </span>
                </div>
                <div
                  className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
                  role="img"
                  aria-label={`${linha.usuario.nome}: ${parte}% do total`}
                >
                  <div
                    className="h-full rounded-full bg-marca-600"
                    style={{ width: `${Math.max(parte, 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/**
 * Rosca desenhada com um círculo por fatia: cada um recebe um traço do
 * tamanho da sua fatia e é deslocado pela soma das anteriores. Sem biblioteca
 * de gráficos — são poucas linhas e funciona offline.
 */
function Rosca({ resumo }: { resumo: ResumoMensal }): ReactElement {
  const RAIO = 60;
  const CIRCUNFERENCIA = 2 * Math.PI * RAIO;
  let acumulado = 0;

  // Estorno (valor negativo) não desenha fatia: o total só considera positivos.
  const positivos = resumo.porCategoria.filter((linha) => linha.totalCentavos > 0);
  const total = positivos.reduce((soma, linha) => soma + linha.totalCentavos, 0) || 1;

  return (
    <svg viewBox="0 0 160 160" className="h-44 w-44 shrink-0 -rotate-90" role="presentation">
      <circle cx="80" cy="80" r={RAIO} fill="none" stroke="#F1F5F9" strokeWidth="26" />
      {positivos.map((linha) => {
        const fracao = linha.totalCentavos / total;
        const comprimento = fracao * CIRCUNFERENCIA;
        const deslocamento = -acumulado * CIRCUNFERENCIA;
        acumulado += fracao;
        return (
          <circle
            key={linha.categoria?.id ?? 'sem'}
            cx="80"
            cy="80"
            r={RAIO}
            fill="none"
            stroke={linha.categoria?.cor ?? '#94A3B8'}
            strokeWidth="26"
            strokeDasharray={`${comprimento} ${CIRCUNFERENCIA - comprimento}`}
            strokeDashoffset={deslocamento}
          />
        );
      })}
    </svg>
  );
}
