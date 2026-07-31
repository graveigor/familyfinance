import {
  FORMAS_PAGAMENTO,
  MAXIMO_DE_PARCELAS,
  ROTULO_FORMA_PAGAMENTO,
  calcularParcelas,
  centavosDoTextoMascarado,
  formatarBRL,
  formatarData,
  formatarDataISO,
  hoje,
  mascararMoeda,
  ontem,
  parseData,
  type FormaPagamento,
} from '@gastos/core';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { EscolherCartao } from '../componentes/EscolherCartao';
import { Icone } from '../componentes/Icone';
import { Botao, CaixaDeErro, Campo, Carregando, traduzirErro, useAviso } from '../componentes/ui';
import {
  useAtualizarGasto,
  useCartoes,
  useCategorias,
  useCriarGasto,
  useMembros,
  useSugestoes,
} from '../consultas';
import { useSessao } from '../sessao';

/**
 * Soma meses a uma data ISO segurando o dia no fim do mês quando preciso:
 * compra dia 31 de janeiro gera parcela em 28/29 de fevereiro, não 2 de março.
 */
function somarMesesISO(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const alvo = new Date(Date.UTC(ano!, (mes! - 1) + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia!, ultimoDia));
  return formatarDataISO(alvo);
}

/** `"2,5"` ou `"2.5"` -> `2.5`. Devolve 0 quando não há número. */
function taxaDigitada(texto: string): number {
  const numero = Number(texto.replace(',', '.'));
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

/**
 * Formulário curto, em uma tela só, na ordem em que a pessoa pensa:
 * quanto, onde, do quê, quando, quem. Só "quanto" e "onde" são obrigatórios.
 */
export function NovoGasto(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const aviso = useAviso();
  const { usuario } = useSessao();

  const categorias = useCategorias();
  const membros = useMembros();
  const criar = useCriarGasto();
  const atualizar = useAtualizarGasto();

  const gastoExistente = useQuery({
    queryKey: ['gastos', 'um', id],
    queryFn: () => api.gastos.obter(id ?? ''),
    enabled: editando,
  });

  const [digitosValor, setDigitosValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [data, setData] = useState(() => formatarDataISO(hoje()));
  const [cartaoId, setCartaoId] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('CARTAO');
  const [observacao, setObservacao] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [temJuros, setTemJuros] = useState(false);
  const [jurosDigitado, setJurosDigitado] = useState('');
  const [mostrarMais, setMostrarMais] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; campos: Record<string, string> }>({
    mensagem: '',
    campos: {},
  });

  const campoValor = useRef<HTMLInputElement>(null);
  const [sugestaoAberta, setSugestaoAberta] = useState(false);
  const sugestoes = useSugestoes(descricao);

  // Ao abrir para lançar, o cursor já vai para o valor e o teclado numérico
  // sobe sozinho: um toque a menos.
  useEffect(() => {
    if (!editando) campoValor.current?.focus();
  }, [editando]);

  useEffect(() => {
    const gasto = gastoExistente.data;
    if (!gasto) return;
    setDigitosValor(String(Math.abs(gasto.valorCentavos)));
    setDescricao(gasto.descricao);
    setCategoriaId(gasto.categoria?.id ?? null);
    setCartaoId(gasto.cartao?.id ?? '');
    setData(gasto.data);
    setUserId(gasto.usuario.id);
    setFormaPagamento(gasto.formaPagamento);
    setObservacao(gasto.observacao ?? '');
    if (gasto.observacao || gasto.formaPagamento !== 'CARTAO') setMostrarMais(true);
  }, [gastoExistente.data]);

  useEffect(() => {
    if (!userId && usuario) setUserId(usuario.id);
  }, [usuario, userId]);

  const centavos = centavosDoTextoMascarado(digitosValor);
  const dataComoTexto = useMemo(() => {
    const convertida = parseData(data);
    return convertida ? formatarData(convertida) : data;
  }, [data]);

  const jurosMensal = temJuros ? taxaDigitada(jurosDigitado) : 0;
  // Com juros o valor digitado é o preço à vista, e o parcelamento custa mais
  // que ele — é o que vai cair na fatura.
  const plano = useMemo(
    () => calcularParcelas(centavos, parcelas, jurosMensal),
    [centavos, parcelas, jurosMensal],
  );

  const salvando = criar.isPending || atualizar.isPending;

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    setErro({ mensagem: '', campos: {} });

    if (centavos === 0) {
      setErro({ mensagem: '', campos: { valorCentavos: 'Informe um valor maior que zero.' } });
      campoValor.current?.focus();
      return;
    }

    const dados = {
      descricao: descricao.trim(),
      valorCentavos: centavos,
      data,
      formaPagamento,
      observacao: observacao.trim() || null,
      categoriaId,
      cartaoId: cartaoId || null,
      ...(userId ? { userId } : {}),
    };

    try {
      if (editando && id) {
        await atualizar.mutateAsync({ id, dados });
        aviso.mostrar('Gasto atualizado.');
      } else if (parcelas > 1) {
        // Um lançamento por mês, com o número da parcela no nome, para o total
        // de cada mês já refletir só a parcela daquele mês.
        const nota =
          jurosMensal > 0
            ? `Compra de ${formatarBRL(centavos)} em ${parcelas}x com juros de ${jurosDigitado.replace('.', ',')}% ao mês (total ${formatarBRL(plano.totalCentavos)}).`
            : '';
        // Uma chamada por parcela, em ordem. Num parcelamento longo isso são
        // dezenas de idas ao servidor: se cair no meio, a pessoa precisa saber
        // quantas já entraram para não lançar tudo de novo em duplicidade.
        for (let i = 0; i < parcelas; i += 1) {
          try {
            await criar.mutateAsync({
              ...dados,
              descricao: `${dados.descricao} (${i + 1}/${parcelas})`,
              valorCentavos: plano.valores[i]!,
              data: somarMesesISO(data, i),
              // A nota explica por que a parcela não é o preço dividido — sem
              // ela o valor na fatura parece errado meses depois.
              observacao: [dados.observacao, nota].filter(Boolean).join(' ') || null,
            });
          } catch (falha) {
            const detalhe = traduzirErro(falha);
            setErro({
              campos: detalhe.campos,
              mensagem:
                i === 0
                  ? detalhe.mensagem
                  : `${detalhe.mensagem} As ${i} primeiras parcelas já foram salvas — lance só as que faltam, da ${i + 1}ª em diante.`,
            });
            return;
          }
        }
        aviso.mostrar(
          jurosMensal > 0
            ? `Salvo em ${parcelas}x de ${formatarBRL(plano.valores[0]!)} — total ${formatarBRL(plano.totalCentavos)}.`
            : `Compra de ${formatarBRL(centavos)} salva em ${parcelas} parcelas.`,
        );
      } else {
        await criar.mutateAsync(dados);
        aviso.mostrar(`Gasto de ${formatarBRL(centavos)} salvo.`);
      }
      navegar(-1);
    } catch (falha) {
      setErro(traduzirErro(falha));
    }
  }

  if (editando && gastoExistente.isPending) return <Carregando />;

  return (
    <form onSubmit={(e) => void enviar(e)} className="space-y-6 pb-28">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navegar(-1)}
          aria-label="Voltar"
          className="-ml-2 flex h-toque w-toque items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
        >
          <Icone nome="esquerda" tamanho={26} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {editando ? 'Editar gasto' : 'Novo gasto'}
        </h1>
      </header>

      <CaixaDeErro mensagem={erro.mensagem || null} />

      {/* 1. Valor */}
      <section className="cartao p-5">
        <label htmlFor="valor" className="rotulo">
          Quanto foi?
        </label>
        <input
          id="valor"
          ref={campoValor}
          // `inputMode="numeric"` faz o celular abrir o teclado de números.
          inputMode="numeric"
          autoComplete="off"
          value={mascararMoeda(digitosValor)}
          onChange={(e) => setDigitosValor(e.target.value.replace(/\D/g, ''))}
          placeholder="R$ 0,00"
          aria-describedby={erro.campos.valorCentavos ? 'valor-erro' : undefined}
          className={`w-full rounded-xl border-2 bg-white px-4 py-4 text-center text-4xl font-bold
            tabular-nums text-slate-900 placeholder:text-slate-300 focus:outline-none ${
              erro.campos.valorCentavos
                ? 'border-red-500 bg-red-50'
                : 'border-slate-300 focus:border-marca-600'
            }`}
        />
        {erro.campos.valorCentavos && (
          <p id="valor-erro" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700">
            <Icone nome="aviso" tamanho={16} />
            {erro.campos.valorCentavos}
          </p>
        )}
      </section>

      {/* 2. Onde foi */}
      <section className="cartao relative p-5">
        <Campo
          rotulo="Onde foi?"
          value={descricao}
          onChange={(e) => {
            setDescricao(e.target.value);
            setSugestaoAberta(true);
          }}
          onFocus={() => setSugestaoAberta(true)}
          // Espera o clique na sugestão antes de fechar a lista.
          onBlur={() => setTimeout(() => setSugestaoAberta(false), 150)}
          placeholder="Supermercado, farmácia, posto..."
          autoComplete="off"
          erro={erro.campos.descricao}
          required
        />

        {sugestaoAberta && (sugestoes.data?.length ?? 0) > 0 && (
          <ul className="absolute inset-x-5 z-20 mt-1 overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-lg">
            {sugestoes.data?.map((texto) => (
              <li key={texto}>
                <button
                  type="button"
                  onMouseDown={() => {
                    setDescricao(texto);
                    setSugestaoAberta(false);
                  }}
                  className="min-h-toque w-full px-4 py-3 text-left text-base hover:bg-slate-50"
                >
                  {texto}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. Categoria */}
      <section className="cartao p-5">
        <p className="rotulo">Categoria (opcional)</p>
        {categorias.isPending ? (
          <Carregando texto="Carregando categorias..." />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {categorias.data?.map((categoria) => {
              const escolhida = categoriaId === categoria.id;
              return (
                <button
                  key={categoria.id}
                  type="button"
                  aria-pressed={escolhida}
                  aria-label={`Categoria ${categoria.nome}`}
                  onClick={() => setCategoriaId(escolhida ? null : categoria.id)}
                  className={`flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl
                    border-2 px-2 py-3 text-sm font-medium transition-colors ${
                      escolhida
                        ? 'border-marca-600 bg-marca-50 text-marca-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${categoria.cor}1A`, color: categoria.cor }}
                  >
                    <Icone nome={categoria.icone} tamanho={22} />
                  </span>
                  <span className="text-center leading-tight">{categoria.nome}</span>
                  {/* Marca de seleção: não depende só da cor da borda. */}
                  {escolhida && (
                    <span className="sr-only">selecionada</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Data */}
      <section className="cartao p-5">
        <p className="rotulo">Quando foi?</p>
        <div className="flex flex-wrap gap-2">
          <BotaoDeData
            rotulo="Hoje"
            ativo={data === formatarDataISO(hoje())}
            onClick={() => setData(formatarDataISO(hoje()))}
          />
          <BotaoDeData
            rotulo="Ontem"
            ativo={data === formatarDataISO(ontem())}
            onClick={() => setData(formatarDataISO(ontem()))}
          />
          <label className="flex min-h-toque flex-1 items-center gap-2 rounded-xl border-2 border-slate-300 px-3">
            <Icone nome="calendario" tamanho={20} className="shrink-0 text-slate-500" />
            <span className="sr-only">Escolher outra data</span>
            <input
              type="date"
              value={data}
              max={formatarDataISO(hoje())}
              onChange={(e) => setData(e.target.value)}
              className="w-full bg-transparent py-2 text-base text-slate-900 focus:outline-none"
            />
          </label>
        </div>
        <p className="mt-2 text-sm text-slate-600">Data escolhida: {dataComoTexto}</p>
      </section>

      {/* 4a. Cartão — some sozinho quando a família não cadastrou nenhum. */}
      <SecaoCartao valor={cartaoId} aoMudar={setCartaoId} />

      {/* 4b. Parcelamento — só ao lançar; editar mexe em uma parcela por vez. */}
      {!editando && (
        <section className="cartao p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="parcelas" className="rotulo">
                Foi parcelado?
              </label>
              <select
                id="parcelas"
                value={parcelas}
                onChange={(e) => {
                  const novo = Number(e.target.value);
                  setParcelas(novo);
                  // À vista não tem juros de parcelamento: limpa para o resumo
                  // não continuar mostrando uma conta que não vale mais.
                  if (novo === 1) setTemJuros(false);
                }}
                className="campo px-2"
              >
                <option value={1}>Não, à vista</option>
                {Array.from({ length: MAXIMO_DE_PARCELAS - 1 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    Sim, em {n}x
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tem-juros" className="rotulo">
                Teve juros?
              </label>
              <select
                id="tem-juros"
                value={temJuros ? 'sim' : 'nao'}
                disabled={parcelas === 1}
                onChange={(e) => setTemJuros(e.target.value === 'sim')}
                className="campo px-2 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="nao">Não, sem juros</option>
                <option value="sim">Sim, teve juros</option>
              </select>
            </div>
          </div>

          {temJuros && parcelas > 1 && (
            <div className="mt-3">
              <label htmlFor="juros" className="rotulo">
                Juros ao mês
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="juros"
                  inputMode="decimal"
                  autoComplete="off"
                  value={jurosDigitado}
                  onChange={(e) => setJurosDigitado(e.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="2,5"
                  className="campo"
                />
                <span className="text-xl font-semibold text-slate-600">%</span>
              </div>
              <p className="mt-1.5 text-sm text-slate-600">
                A taxa mensal que a loja ou o cartão informou. O valor lá em cima é o preço à
                vista.
              </p>
            </div>
          )}

          {parcelas > 1 && centavos > 0 && (
            <div className="mt-3 rounded-xl bg-slate-50 p-4">
              <p className="text-base font-semibold text-slate-900">
                {parcelas}x de {formatarBRL(plano.valores[0] ?? 0)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {jurosMensal > 0 ? (
                  <>
                    Total de {formatarBRL(plano.totalCentavos)}, sendo{' '}
                    {formatarBRL(plano.jurosCentavos)} de juros. Cada parcela entra num mês, a
                    partir da data escolhida.
                  </>
                ) : temJuros ? (
                  'Digite a taxa acima para eu calcular as parcelas.'
                ) : (
                  <>
                    O valor informado é o total da compra. Cada parcela entra num mês, a partir da
                    data escolhida.
                  </>
                )}
              </p>
            </div>
          )}
        </section>
      )}

      {/* 5. Quem gastou — só aparece quando a família tem mais de uma pessoa */}
      {(membros.data?.length ?? 0) > 1 && (
        <section className="cartao p-5">
          <label htmlFor="quem" className="rotulo">
            Quem gastou?
          </label>
          <select
            id="quem"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="campo"
          >
            {membros.data?.map((membro) => (
              <option key={membro.id} value={membro.id}>
                {membro.nome}
                {membro.id === usuario?.id ? ' (você)' : ''}
              </option>
            ))}
          </select>
        </section>
      )}

      {/* Detalhes que quase ninguém preenche ficam escondidos por padrão. */}
      <section className="cartao p-5">
        <button
          type="button"
          onClick={() => setMostrarMais(!mostrarMais)}
          className="flex min-h-toque w-full items-center justify-between text-base font-semibold text-slate-700"
        >
          Mais detalhes
          <Icone nome={mostrarMais ? 'cima' : 'baixo'} tamanho={22} />
        </button>

        {mostrarMais && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="rotulo">Forma de pagamento</p>
              <div className="flex flex-wrap gap-2">
                {FORMAS_PAGAMENTO.map((forma) => (
                  <button
                    key={forma}
                    type="button"
                    aria-pressed={formaPagamento === forma}
                    onClick={() => setFormaPagamento(forma)}
                    className={`min-h-toque rounded-xl border-2 px-4 text-base font-medium ${
                      formaPagamento === forma
                        ? 'border-marca-600 bg-marca-50 text-marca-900'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {ROTULO_FORMA_PAGAMENTO[forma]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="observacao" className="rotulo">
                Observação
              </label>
              <textarea
                id="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                maxLength={500}
                className="campo resize-none"
                placeholder="Algo que ajude a lembrar depois."
              />
            </div>
          </div>
        )}
      </section>

      {/* Salvar fixo na base: sempre alcançável, sem rolar. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:left-60"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-3xl">
          <Botao type="submit" larguraTotal carregando={salvando} className="text-lg">
            {editando ? 'Salvar alterações' : 'Salvar gasto'}
          </Botao>
        </div>
      </div>
    </form>
  );
}

/** O cartão só ganha um cartão-seção quando existe cartão para escolher. */
function SecaoCartao({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (id: string) => void;
}): ReactElement | null {
  const cartoes = useCartoes();
  if ((cartoes.data?.length ?? 0) === 0) return null;

  return (
    <section className="cartao p-5">
      <EscolherCartao id="cartao-do-gasto" valor={valor} aoMudar={aoMudar} />
    </section>
  );
}

function BotaoDeData({
  rotulo,
  ativo,
  onClick,
}: {
  rotulo: string;
  ativo: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`min-h-toque rounded-xl border-2 px-5 text-base font-semibold ${
        ativo
          ? 'border-marca-600 bg-marca-50 text-marca-900'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {rotulo}
    </button>
  );
}
