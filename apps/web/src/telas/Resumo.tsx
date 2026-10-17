import {
  fraseComparacaoMensal,
  hoje,
  nomeCurtoDoMes,
  nomeDoMes,
  percentual,
  pluralizar,
  type ResumoMensal,
} from '@gastos/core';
import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { GraficoDeEvolucao } from '../componentes/GraficoDeEvolucao';
import { Icone } from '../componentes/Icone';
import { useTutorialDaPagina, type PassoDeTutorial } from '../componentes/Tutorial';
import { CaixaDeErro, Carregando, Vazio, traduzirErro } from '../componentes/ui';
import { useEvolucao, useOrcamentos, usePrevisao, useResumoMensal } from '../consultas';
import { useDinheiro } from '../i18n/dinheiro';
import { useIdioma, useT } from '../i18n';

const PASSOS: PassoDeTutorial[] = [
  {
    alvo: 'resumo-mes',
    titulo: 'Escolha o mês',
    texto:
      'As setas andam para trás e para frente no calendário. Tudo nesta tela fala do mês que estiver aqui.',
  },
  {
    alvo: 'resumo-total',
    titulo: 'Quanto foi no mês',
    texto:
      'O total e a comparação com o mês passado. Só entra o que é seu e o de quem escolheu compartilhar com o grupo.',
  },
  {
    alvo: 'resumo-saldo',
    titulo: 'Entrou, saiu, sobrou',
    texto:
      'Aparece quando você registra alguma entrada. Compara o que entrou no mês com o que saiu e diz o que sobrou — ou o que faltou, em vermelho.',
  },
  {
    alvo: 'resumo-orcamento',
    titulo: 'Seus limites',
    texto:
      'Uma barra por categoria com teto definido. Amarelo quando chega a 80% do limite, vermelho quando passa. Os tetos se definem em Ajustes, e só você os vê.',
  },
  {
    alvo: 'resumo-categorias',
    titulo: 'Para onde foi o dinheiro',
    texto:
      'A rosca e a lista mostram o peso de cada categoria. É onde costuma aparecer a surpresa do mês.',
  },
  {
    alvo: 'resumo-pessoas',
    titulo: 'Quem gastou quanto',
    texto: 'A divisão por pessoa, para quem divide as contas da casa.',
  },
  {
    alvo: 'resumo-previsao',
    titulo: 'O que o mês que vem já custa',
    texto:
      'Soma o que já está marcado para o próximo mês: as parcelas que você assumiu e as contas fixas que ainda vão nascer. Os dois ficam separados porque parcela não dá para cancelar, conta fixa dá.',
  },
  {
    alvo: 'resumo-evolucao',
    titulo: 'Os últimos seis meses',
    texto:
      'Responde "estou gastando mais que antes?" sem precisar abrir mês por mês.',
  },
];

export function Resumo(): ReactElement {
  useTutorialDaPagina('resumo', PASSOS);
  const { t, tp, idioma } = useIdioma();
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
      <h1 className="text-xl font-bold text-slate-900">{t('Resumo')}</h1>

      <div className="cartao flex items-center justify-between px-2 py-2" data-tutorial="resumo-mes">
        <button
          type="button"
          onClick={() => mudarMes(-1)}
          aria-label={t('Mês anterior')}
          className="flex h-toque w-toque items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
        >
          <Icone nome="esquerda" tamanho={26} />
        </button>

        <p className="text-lg font-semibold text-slate-900">
          {nomeDoMes(mes, idioma).replace(/^./, (l) => l.toUpperCase())}
          {idioma === 'en' ? ' ' : ' de '}
          {ano}
        </p>

        <button
          type="button"
          onClick={() => mudarMes(1)}
          aria-label={t('Próximo mês')}
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
          titulo={t('Nenhum gasto em {mes}', { mes: nomeDoMes(mes, idioma) })}
          descricao={t('Escolha outro mês nas setas acima.')}
        />
      ) : (
        <ConteudoDoResumo resumo={consulta.data} />
      )}

      <SecaoDeEvolucao />
    </div>
  );
}

/** Últimos seis meses lado a lado — a pergunta "estou gastando mais?". */
function SecaoDeEvolucao(): ReactElement {
  const t = useT();
  const evolucao = useEvolucao(6);

  return (
    <section className="cartao p-5" aria-labelledby="titulo-evolucao" data-tutorial="resumo-evolucao">
      <h2 id="titulo-evolucao" className="mb-4 text-base font-semibold text-slate-800">
        {t('Últimos 6 meses')}
      </h2>
      {evolucao.isPending ? (
        <Carregando />
      ) : evolucao.isError ? (
        <CaixaDeErro mensagem={traduzirErro(evolucao.error).mensagem} />
      ) : evolucao.data.maiorCentavos === 0 ? (
        <p className="text-base text-slate-600">{t('Ainda não há gastos para comparar.')}</p>
      ) : (
        <GraficoDeEvolucao evolucao={evolucao.data} />
      )}
    </section>
  );
}

function ConteudoDoResumo({ resumo }: { resumo: ResumoMensal }): ReactElement {
  const { dinheiro, moeda } = useDinheiro();
  const { t, tp, idioma } = useIdioma();
  return (
    <>
      <section className="cartao px-6 py-6 text-center" data-tutorial="resumo-total">
        <p className="text-base text-slate-600">{t('Total do mês')}</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
          {dinheiro(resumo.totalCentavos)}
        </p>
        <p className="mt-2 text-base text-slate-700">{fraseComparacaoMensal(resumo, idioma, moeda)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {t('{quantidade} gastos · {mes} foi {valor}', {
            quantidade: resumo.quantidade,
            mes: nomeCurtoDoMes(resumo.mesAnterior.mes, idioma),
            valor: dinheiro(resumo.mesAnterior.totalCentavos),
          })}
        </p>
      </section>

      {/* Entrou, saiu, sobrou. Só aparece quando há receita registrada: sem ela,
          "sobrou -R$ 500" seria uma afirmação falsa sobre a vida de alguém que
          simplesmente não usa esta parte do app. */}
      {resumo.receitasCentavos > 0 && (
        <section className="cartao p-5" aria-labelledby="titulo-saldo" data-tutorial="resumo-saldo">
          <h2 id="titulo-saldo" className="mb-4 text-base font-semibold text-slate-800">
            {t('Entrou e saiu')}
          </h2>

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-menta-50 p-3">
              <dt className="text-sm text-menta-700">{t('Entrou')}</dt>
              <dd className="text-valor tabular-nums text-menta-700">
                {dinheiro(resumo.receitasCentavos)}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-sm text-slate-600">{t('Saiu')}</dt>
              <dd className="text-valor tabular-nums text-slate-900">
                {dinheiro(resumo.totalCentavos)}
              </dd>
            </div>
          </dl>

          <div
            className={`mt-3 rounded-xl p-4 text-center ${
              resumo.saldoCentavos < 0 ? 'bg-red-50' : 'bg-menta-50'
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                resumo.saldoCentavos < 0 ? 'text-red-700' : 'text-menta-700'
              }`}
            >
              {resumo.saldoCentavos < 0 ? t('Faltou') : t('Sobrou')}
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${
                resumo.saldoCentavos < 0 ? 'text-red-700' : 'text-menta-700'
              }`}
            >
              {/* Sem o sinal de menos: "Faltou" já diz a direção, e
                  "Faltou -R$ 500" lê como negativo duas vezes. */}
              {dinheiro(Math.abs(resumo.saldoCentavos))}
            </p>
          </div>

          <Link
            to="/receitas"
            className="mt-3 flex min-h-toque items-center justify-center gap-2 rounded-xl
              border-2 border-slate-300 text-base font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Icone nome="cima" tamanho={20} />
            {t('Registrar entrada')}
          </Link>
        </section>
      )}

      <BlocoDeOrcamento ano={resumo.ano} mes={resumo.mes} />

      <section className="cartao p-5" aria-labelledby="titulo-categorias" data-tutorial="resumo-categorias">
        <h2 id="titulo-categorias" className="mb-4 text-base font-semibold text-slate-800">
          {t('Por categoria')}
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
                    {t(linha.categoria?.nome ?? 'Sem categoria')}
                  </span>
                  <span className="shrink-0 text-base font-semibold tabular-nums text-slate-900">
                    {dinheiro(linha.totalCentavos)}
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

      <BlocoDePrevisao />

      <section className="cartao p-5" aria-labelledby="titulo-pessoas" data-tutorial="resumo-pessoas">
        <h2 id="titulo-pessoas" className="mb-4 text-base font-semibold text-slate-800">
          {t('Por pessoa')}
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
                    {dinheiro(linha.totalCentavos)}
                    <span className="ml-2 text-sm font-normal text-slate-600">{parte}%</span>
                  </span>
                </div>
                <div
                  className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
                  role="img"
                  aria-label={t('{nome}: {parte}% do total', { nome: linha.usuario.nome, parte })}
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

/**
 * O que o mês que vem já custa, antes de ele começar.
 *
 * Separa as duas origens porque elas são coisas diferentes para quem lê:
 * parcela é dívida que já foi assumida e não dá para desfazer; conta fixa é
 * compromisso que se repete e que dá para cancelar. Somar tudo num número só
 * esconderia essa diferença.
 */
function BlocoDePrevisao(): ReactElement | null {
  const { t, idioma } = useIdioma();
  const { dinheiro } = useDinheiro();
  const previsao = usePrevisao();

  // Sem nada comprometido não há o que mostrar — um cartão zerado só ocupa
  // espaço e faz a pessoa procurar significado onde não tem.
  if (!previsao.data || previsao.data.totalCentavos === 0) return null;

  const { ano, mes, totalCentavos, lancadosCentavos, contasFixasCentavos } = previsao.data;

  return (
    <section className="cartao p-5" aria-labelledby="titulo-previsao" data-tutorial="resumo-previsao">
      {/* `nomeDoMes` devolve minúsculo (é assim que se escreve mês em
          português), mas abrindo título fica estranho. A maiúscula é de
          apresentação, então mora aqui e não no core. */}
      <h2 id="titulo-previsao" className="text-base font-semibold text-slate-800">
        {t('{mes} já tem', { mes: comInicialMaiuscula(nomeDoMes(mes, idioma)) })}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {t('Comprometido antes de o mês começar.')}
      </p>

      <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
        {dinheiro(totalCentavos)}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-sm text-slate-600">{t('Parcelas')}</dt>
          <dd className="text-base font-semibold tabular-nums text-slate-900">
            {dinheiro(lancadosCentavos)}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-sm text-slate-600">{t('Contas fixas')}</dt>
          <dd className="text-base font-semibold tabular-nums text-slate-900">
            {dinheiro(contasFixasCentavos)}
          </dd>
        </div>
      </dl>

      {/* Para quem ouve a tela: "11 de 2026" não é como ninguém diz um mês. */}
      <p className="sr-only">
        {t('Previsão para {mes} de {ano}', { mes: nomeDoMes(mes, idioma), ano })}
      </p>
    </section>
  );
}

/** Primeira letra maiúscula, para nome de mês abrindo frase. */
function comInicialMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Cores da barra por situação. Verde não é "bom", é "ainda cabe". */
const CORES_DO_ORCAMENTO = {
  tranquilo: { barra: 'bg-menta-600', texto: 'text-menta-700', fundo: 'bg-menta-50' },
  atencao: { barra: 'bg-amber-500', texto: 'text-amber-700', fundo: 'bg-amber-50' },
  estourado: { barra: 'bg-red-600', texto: 'text-red-700', fundo: 'bg-red-50' },
} as const;

/**
 * Quanto de cada teto já foi gasto.
 *
 * O gasto que aparece aqui é o DA PESSOA, e não o do grupo que o bloco "Por
 * categoria" logo abaixo soma — o teto é pessoal, e comparar o seu limite com
 * o gasto da família daria uma barra sem sentido. O servidor já devolve assim.
 */
function BlocoDeOrcamento({ ano, mes }: { ano: number; mes: number }): ReactElement | null {
  const { t } = useIdioma();
  const { dinheiro } = useDinheiro();
  const orcamentos = useOrcamentos(ano, mes);

  // Sem teto definido não há bloco: um cartão vazio pedindo para configurar
  // algo é ruído em cima de uma tela que já responde o que foi perguntado.
  if (!orcamentos.data || orcamentos.data.length === 0) return null;

  return (
    <section className="cartao p-5" aria-labelledby="titulo-orcamento" data-tutorial="resumo-orcamento">
      <h2 id="titulo-orcamento" className="mb-1 text-base font-semibold text-slate-800">
        {t('Seus limites')}
      </h2>
      <p className="mb-4 text-sm text-slate-600">{t('Só você vê os seus limites.')}</p>

      <ul className="space-y-4">
        {orcamentos.data.map((item) => {
          const cores = CORES_DO_ORCAMENTO[item.situacao];
          return (
            <li key={item.categoria.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-base font-medium text-slate-800">
                  {t(item.categoria.nome)}
                </span>
                <span className="shrink-0 text-base tabular-nums text-slate-900">
                  <span className="font-semibold">{dinheiro(item.gastoCentavos)}</span>
                  <span className="text-sm font-normal text-slate-600">
                    {' '}
                    {t('de {limite}', { limite: dinheiro(item.limiteCentavos) })}
                  </span>
                </span>
              </div>

              <div
                className={`h-3 w-full overflow-hidden rounded-full ${cores.fundo}`}
                role="img"
                aria-label={t('{categoria}: {percentual}% do limite', {
                  categoria: t(item.categoria.nome),
                  percentual: item.percentual,
                })}
              >
                {/* A barra para em 100% mesmo estourando: passar da caixa não
                    informa mais nada, e quem diz que estourou é o texto. */}
                <div
                  className={`h-full rounded-full ${cores.barra}`}
                  style={{ width: `${Math.min(100, item.percentual)}%` }}
                />
              </div>

              {item.situacao !== 'tranquilo' && (
                <p className={`mt-1 text-sm font-semibold ${cores.texto}`}>
                  {item.situacao === 'estourado'
                    ? t('Passou {valor} do limite', {
                        valor: dinheiro(item.gastoCentavos - item.limiteCentavos),
                      })
                    : t('Falta {valor} para o limite', {
                        valor: dinheiro(item.limiteCentavos - item.gastoCentavos),
                      })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
