import {
  formatarBRL,
  formatarDataISO,
  fraseComparacaoMensal,
  hoje,
  inicioDoMes,
  nomeDoMes,
  pluralizar,
} from '@gastos/core';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { FaixaInstalar } from '../componentes/InstalarApp';
import { useTutorialDaPagina, type PassoDeTutorial } from '../componentes/Tutorial';
import { ItemDeGasto } from '../componentes/ItemDeGasto';
import { Carregando, CaixaDeErro, Vazio, traduzirErro } from '../componentes/ui';
import { useGastos, useResumoMensal } from '../consultas';
import { useSessao } from '../sessao';

const PASSOS: PassoDeTutorial[] = [
  {
    alvo: 'inicio-total',
    titulo: 'Quanto você gastou no mês',
    texto:
      'Este é o número que resume o mês, com a comparação com o mês passado logo abaixo. Só entra aqui o que é seu e o de quem escolheu compartilhar com o grupo.',
  },
  {
    alvo: 'inicio-ultimos',
    titulo: 'Seus últimos lançamentos',
    texto: 'Os gastos mais recentes ficam aqui. Toque em "Ver todos" para buscar e filtrar.',
  },
  {
    alvo: 'inicio-adicionar',
    titulo: 'Lançar um gasto',
    texto:
      'Este botão abre o lançamento. São dois campos obrigatórios: quanto foi e onde foi — leva menos de dez segundos.',
  },
];

export function Inicio(): ReactElement {
  useTutorialDaPagina('inicio', PASSOS);
  const { usuario } = useSessao();
  const referencia = hoje();
  const ano = referencia.getUTCFullYear();
  const mes = referencia.getUTCMonth() + 1;

  const resumo = useResumoMensal(ano, mes);
  const ultimos = useGastos({
    de: formatarDataISO(inicioDoMes(ano, mes)),
    porPagina: 10,
  });

  const primeiroNome = usuario?.nome.split(' ')[0] ?? '';

  return (
    <div className="space-y-5">
      <header>
        <p className="text-base text-slate-600">Olá, {primeiroNome}</p>
        <h1 className="text-xl font-bold text-slate-900">
          {nomeDoMes(mes).replace(/^./, (l) => l.toUpperCase())} de {ano}
        </h1>
      </header>

      <FaixaInstalar />

      {/* O total do mês é o maior elemento da tela — é a informação que a
          pessoa abre o app para ver. */}
      <section
        data-tutorial="inicio-total"
        className="cartao px-6 py-7 text-center"
        aria-labelledby="titulo-total"
      >
        <h2 id="titulo-total" className="text-base font-medium text-slate-600">
          Gastos deste mês
        </h2>

        {resumo.isPending ? (
          <div className="py-4">
            <Carregando texto="Somando..." />
          </div>
        ) : resumo.isError ? (
          <div className="pt-4">
            <CaixaDeErro mensagem={traduzirErro(resumo.error).mensagem} />
          </div>
        ) : (
          <>
            <p className="mt-2 text-5xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-6xl">
              {formatarBRL(resumo.data.totalCentavos)}
            </p>
            <p className="mt-3 text-base text-slate-700">
              {fraseComparacaoMensal(resumo.data)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {pluralizar(resumo.data.quantidade, 'gasto registrado', 'gastos registrados')}
            </p>
          </>
        )}
      </section>

      <section
        data-tutorial="inicio-ultimos"
        className="cartao overflow-hidden"
        aria-labelledby="titulo-ultimos"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="titulo-ultimos" className="text-base font-semibold text-slate-800">
            Últimos gastos
          </h2>
          <Link
            to="/gastos"
            className="min-h-toque px-2 py-2 text-base font-semibold text-marca-700 hover:underline"
          >
            Ver todos
          </Link>
        </div>

        {ultimos.isPending ? (
          <Carregando />
        ) : ultimos.isError ? (
          <div className="p-4">
            <CaixaDeErro mensagem={traduzirErro(ultimos.error).mensagem} />
          </div>
        ) : ultimos.data.itens.length === 0 ? (
          <Vazio
            titulo="Nenhum gasto ainda"
            descricao="Toque no botão + para lançar o primeiro. Leva menos de dez segundos."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {ultimos.data.itens.map((gasto) => (
              <li key={gasto.id}>
                <ItemDeGasto gasto={gasto} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
