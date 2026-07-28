import {
  formatarBRL,
  formatarDataISO,
  hoje,
  inicioDoMes,
  fimDoMes,
  mesAnterior,
  parseData,
  pluralizar,
  rotuloDoDia,
  somarCentavos,
  type Gasto,
} from '@gastos/core';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialogo, Confirmar } from '../componentes/Dialogo';
import { Icone } from '../componentes/Icone';
import { ItemDeGasto } from '../componentes/ItemDeGasto';
import { Botao, CaixaDeErro, Carregando, Vazio, traduzirErro, useAviso } from '../componentes/ui';
import { api } from '../api';
import {
  useCategorias,
  useEnviarComprovante,
  useExcluirGasto,
  useGastos,
  useMembros,
  useRemoverComprovante,
} from '../consultas';

interface Filtros {
  busca: string;
  de?: string;
  ate?: string;
  userId?: string;
  categoriaId?: string;
  periodo: 'mes' | 'mes-passado' | 'tudo' | 'personalizado';
}

const AGORA = hoje();
const ANO = AGORA.getUTCFullYear();
const MES = AGORA.getUTCMonth() + 1;
const PASSADO = mesAnterior(ANO, MES);

const PERIODOS = {
  mes: {
    rotulo: 'Este mês',
    de: formatarDataISO(inicioDoMes(ANO, MES)),
    ate: formatarDataISO(fimDoMes(ANO, MES)),
  },
  'mes-passado': {
    rotulo: 'Mês passado',
    de: formatarDataISO(inicioDoMes(PASSADO.ano, PASSADO.mes)),
    ate: formatarDataISO(fimDoMes(PASSADO.ano, PASSADO.mes)),
  },
  tudo: { rotulo: 'Tudo', de: undefined, ate: undefined },
} as const;

export function Gastos(): ReactElement {
  const navegar = useNavigate();
  const aviso = useAviso();
  const categorias = useCategorias();
  const membros = useMembros();
  const excluir = useExcluirGasto();

  const [filtros, setFiltros] = useState<Filtros>({
    busca: '',
    periodo: 'mes',
    de: PERIODOS.mes.de,
    ate: PERIODOS.mes.ate,
  });
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [emFoco, setEmFoco] = useState<Gasto | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<Gasto | null>(null);
  const [pagina, setPagina] = useState(1);

  // Espera a pessoa parar de digitar antes de consultar o servidor.
  useEffect(() => {
    const relogio = setTimeout(() => {
      setFiltros((atual) => ({ ...atual, busca: buscaDigitada }));
      setPagina(1);
    }, 350);
    return () => clearTimeout(relogio);
  }, [buscaDigitada]);

  const consulta = useGastos({
    ...(filtros.busca ? { busca: filtros.busca } : {}),
    ...(filtros.de ? { de: filtros.de } : {}),
    ...(filtros.ate ? { ate: filtros.ate } : {}),
    ...(filtros.userId ? { userId: filtros.userId } : {}),
    ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
    pagina,
    porPagina: 50,
  });

  /** Agrupa por dia mantendo a ordem que o servidor mandou (mais novo primeiro). */
  const dias = useMemo(() => {
    const grupos = new Map<string, Gasto[]>();
    for (const gasto of consulta.data?.itens ?? []) {
      const lista = grupos.get(gasto.data);
      if (lista) lista.push(gasto);
      else grupos.set(gasto.data, [gasto]);
    }
    return [...grupos.entries()];
  }, [consulta.data]);

  const etiquetas: Array<{ texto: string; remover: () => void }> = [];
  if (filtros.periodo !== 'tudo') {
    const texto =
      filtros.periodo === 'personalizado'
        ? `${filtros.de ?? '...'} a ${filtros.ate ?? '...'}`
        : PERIODOS[filtros.periodo].rotulo;
    etiquetas.push({
      texto,
      remover: () =>
        setFiltros((a) => ({ ...a, periodo: 'tudo', de: undefined, ate: undefined })),
    });
  }
  if (filtros.userId) {
    const nome = membros.data?.find((m) => m.id === filtros.userId)?.nome ?? 'Pessoa';
    etiquetas.push({
      texto: nome,
      remover: () => setFiltros((a) => ({ ...a, userId: undefined })),
    });
  }
  if (filtros.categoriaId) {
    const nome =
      filtros.categoriaId === 'sem-categoria'
        ? 'Sem categoria'
        : (categorias.data?.find((c) => c.id === filtros.categoriaId)?.nome ?? 'Categoria');
    etiquetas.push({
      texto: nome,
      remover: () => setFiltros((a) => ({ ...a, categoriaId: undefined })),
    });
  }

  async function confirmarExclusao(): Promise<void> {
    if (!confirmandoExclusao) return;
    try {
      await excluir.mutateAsync(confirmandoExclusao.id);
      aviso.mostrar('Gasto excluído.');
    } catch (falha) {
      aviso.mostrar(traduzirErro(falha).mensagem);
    } finally {
      setConfirmandoExclusao(null);
      setEmFoco(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Gastos</h1>
        <button
          type="button"
          onClick={() => setGavetaAberta(true)}
          className="flex min-h-toque items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Icone nome="filtro" tamanho={20} />
          Filtrar
        </button>
      </header>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          <Icone nome="lupa" tamanho={22} />
        </span>
        <input
          type="search"
          value={buscaDigitada}
          onChange={(e) => setBuscaDigitada(e.target.value)}
          placeholder="Buscar por onde foi o gasto"
          aria-label="Buscar gastos"
          className="campo pl-12"
        />
      </div>

      {etiquetas.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {etiquetas.map((etiqueta) => (
            <li key={etiqueta.texto}>
              <button
                type="button"
                onClick={etiqueta.remover}
                className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-marca-100 px-3 text-base font-medium text-marca-900 hover:bg-marca-200"
              >
                {etiqueta.texto}
                <Icone nome="fechar" tamanho={16} />
                <span className="sr-only">Remover filtro</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {consulta.data && (
        <div className="cartao flex items-baseline justify-between px-4 py-3">
          <span className="text-base text-slate-600">
            {pluralizar(consulta.data.paginacao.totalItens, 'gasto', 'gastos')}
          </span>
          <span className="text-xl font-bold tabular-nums text-slate-900">
            {formatarBRL(consulta.data.totalCentavos)}
          </span>
        </div>
      )}

      {consulta.isPending ? (
        <Carregando />
      ) : consulta.isError ? (
        <CaixaDeErro mensagem={traduzirErro(consulta.error).mensagem} />
      ) : dias.length === 0 ? (
        <Vazio
          icone="lupa"
          titulo="Nenhum gasto encontrado"
          descricao="Tente mudar o período ou limpar os filtros."
          acao={
            <Botao
              variante="secundario"
              onClick={() => {
                setBuscaDigitada('');
                setFiltros({ busca: '', periodo: 'tudo' });
              }}
            >
              Limpar filtros
            </Botao>
          }
        />
      ) : (
        <div className="space-y-4">
          {dias.map(([dia, gastos]) => {
            const data = parseData(dia);
            const subtotal = somarCentavos(gastos.map((g) => g.valorCentavos));
            return (
              <section key={dia} className="cartao overflow-hidden">
                <div className="flex items-baseline justify-between bg-slate-50 px-4 py-2.5">
                  <h2 className="text-base font-semibold text-slate-800">
                    {data ? rotuloDoDia(data) : dia}
                  </h2>
                  <span className="text-base font-semibold tabular-nums text-slate-700">
                    {formatarBRL(subtotal)}
                  </span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {gastos.map((gasto) => (
                    <li key={gasto.id}>
                      <ItemDeGasto gasto={gasto} aoTocar={setEmFoco} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {consulta.data.paginacao.totalPaginas > 1 && (
            <div className="flex items-center justify-between gap-3 py-2">
              <Botao
                variante="secundario"
                icone="esquerda"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Botao>
              <span className="text-base text-slate-600">
                Página {consulta.data.paginacao.pagina} de {consulta.data.paginacao.totalPaginas}
              </span>
              <Botao
                variante="secundario"
                disabled={pagina >= consulta.data.paginacao.totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Botao>
            </div>
          )}
        </div>
      )}

      {/* Ações do gasto: um toque no item abre editar/excluir. */}
      <Dialogo
        aberto={emFoco !== null}
        aoFechar={() => setEmFoco(null)}
        titulo={emFoco?.descricao ?? ''}
      >
        {emFoco && (
          <div className="space-y-5">
            <p className="text-3xl font-bold tabular-nums text-slate-900">
              {formatarBRL(emFoco.valorCentavos)}
            </p>
            <dl className="space-y-2 text-base">
              <Linha rotulo="Quem gastou" valor={emFoco.usuario.nome} />
              <Linha
                rotulo="Data"
                valor={parseData(emFoco.data) ? rotuloDoDia(parseData(emFoco.data)!) : emFoco.data}
              />
              <Linha rotulo="Categoria" valor={emFoco.categoria?.nome ?? 'Sem categoria'} />
              {emFoco.observacao && <Linha rotulo="Observação" valor={emFoco.observacao} />}
              {emFoco.recorrenciaId && (
                <Linha rotulo="Origem" valor="Lançado por uma conta fixa" />
              )}
            </dl>

            <Comprovante
              gasto={emFoco}
              aoMudar={(atualizado) => setEmFoco(atualizado)}
            />

            <div className="flex gap-3">
              <Botao
                variante="secundario"
                larguraTotal
                icone="lapis"
                onClick={() => {
                  navegar(`/gastos/${emFoco.id}/editar`);
                  setEmFoco(null);
                }}
              >
                Editar
              </Botao>
              <Botao
                variante="perigo"
                larguraTotal
                icone="lixeira"
                onClick={() => setConfirmandoExclusao(emFoco)}
              >
                Excluir
              </Botao>
            </div>
          </div>
        )}
      </Dialogo>

      <Confirmar
        aberto={confirmandoExclusao !== null}
        titulo="Excluir este gasto?"
        descricao={
          confirmandoExclusao
            ? `"${confirmandoExclusao.descricao}" de ${formatarBRL(confirmandoExclusao.valorCentavos)} será removido e o total do mês vai mudar. Não dá para desfazer.`
            : ''
        }
        carregando={excluir.isPending}
        aoConfirmar={() => void confirmarExclusao()}
        aoCancelar={() => setConfirmandoExclusao(null)}
      />

      <GavetaDeFiltros
        aberta={gavetaAberta}
        aoFechar={() => setGavetaAberta(false)}
        filtros={filtros}
        aoAplicar={(novos) => {
          setFiltros(novos);
          setPagina(1);
          setGavetaAberta(false);
        }}
        membros={membros.data ?? []}
        categorias={categorias.data ?? []}
      />
    </div>
  );
}

/**
 * Foto ou PDF do comprovante. Fica dentro do painel do gasto porque é onde a
 * pessoa procura: "quanto foi isso mesmo?" e "cadê a nota?".
 */
function Comprovante({
  gasto,
  aoMudar,
}: {
  gasto: Gasto;
  aoMudar: (gasto: Gasto) => void;
}): ReactElement {
  const enviar = useEnviarComprovante();
  const remover = useRemoverComprovante();
  const aviso = useAviso();
  const entrada = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(arquivo: File): Promise<void> {
    setErro(null);
    try {
      const atualizado = (await enviar.mutateAsync({ id: gasto.id, arquivo })) as Gasto;
      aoMudar(atualizado);
      aviso.mostrar('Comprovante anexado.');
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <CaixaDeErro mensagem={erro} />

      {gasto.temComprovante ? (
        <>
          <a
            href={api.gastos.urlDoComprovante(gasto.id)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-toque items-center gap-3 rounded-xl border-2 border-slate-200 px-4 text-base font-medium text-marca-800 hover:bg-slate-50"
          >
            <Icone nome="planilha" tamanho={22} />
            Ver comprovante
          </a>
          <div className="flex gap-3">
            <Botao
              variante="secundario"
              larguraTotal
              carregando={enviar.isPending}
              onClick={() => entrada.current?.click()}
            >
              Trocar
            </Botao>
            <Botao
              variante="secundario"
              larguraTotal
              carregando={remover.isPending}
              onClick={() => {
                remover.mutate(gasto.id, {
                  onSuccess: () => {
                    aoMudar({ ...gasto, temComprovante: false });
                    aviso.mostrar('Comprovante removido.');
                  },
                  onError: (falha) => setErro(traduzirErro(falha).mensagem),
                });
              }}
            >
              Remover
            </Botao>
          </div>
        </>
      ) : (
        <Botao
          variante="secundario"
          larguraTotal
          icone="planilha"
          carregando={enviar.isPending}
          onClick={() => entrada.current?.click()}
        >
          Anexar comprovante
        </Botao>
      )}

      <input
        ref={entrada}
        type="file"
        // `capture` faz o celular abrir a câmera direto, que é o caso comum.
        accept="image/*,application/pdf"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) void escolher(arquivo);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }): ReactElement {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-600">{rotulo}</dt>
      <dd className="text-right font-medium text-slate-900">{valor}</dd>
    </div>
  );
}

function GavetaDeFiltros({
  aberta,
  aoFechar,
  filtros,
  aoAplicar,
  membros,
  categorias,
}: {
  aberta: boolean;
  aoFechar: () => void;
  filtros: Filtros;
  aoAplicar: (filtros: Filtros) => void;
  membros: Array<{ id: string; nome: string }>;
  categorias: Array<{ id: string; nome: string }>;
}): ReactElement {
  const [rascunho, setRascunho] = useState(filtros);

  useEffect(() => {
    if (aberta) setRascunho(filtros);
  }, [aberta, filtros]);

  return (
    <Dialogo
      aberto={aberta}
      aoFechar={aoFechar}
      titulo="Filtrar gastos"
      rodape={
        <>
          <Botao
            variante="secundario"
            larguraTotal
            onClick={() => aoAplicar({ busca: filtros.busca, periodo: 'tudo' })}
          >
            Limpar
          </Botao>
          <Botao larguraTotal onClick={() => aoAplicar(rascunho)}>
            Aplicar
          </Botao>
        </>
      }
    >
      <div className="space-y-6">
        <fieldset>
          <legend className="rotulo">Período</legend>
          <div className="flex flex-wrap gap-2">
            {(['mes', 'mes-passado', 'tudo'] as const).map((chave) => (
              <button
                key={chave}
                type="button"
                aria-pressed={rascunho.periodo === chave}
                onClick={() =>
                  setRascunho({
                    ...rascunho,
                    periodo: chave,
                    de: PERIODOS[chave].de,
                    ate: PERIODOS[chave].ate,
                  })
                }
                className={`min-h-toque rounded-xl border-2 px-4 text-base font-medium ${
                  rascunho.periodo === chave
                    ? 'border-marca-600 bg-marca-50 text-marca-900'
                    : 'border-slate-200 text-slate-700'
                }`}
              >
                {PERIODOS[chave].rotulo}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-slate-600">
              De
              <input
                type="date"
                value={rascunho.de ?? ''}
                onChange={(e) =>
                  setRascunho({ ...rascunho, de: e.target.value || undefined, periodo: 'personalizado' })
                }
                className="campo mt-1"
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Até
              <input
                type="date"
                value={rascunho.ate ?? ''}
                onChange={(e) =>
                  setRascunho({ ...rascunho, ate: e.target.value || undefined, periodo: 'personalizado' })
                }
                className="campo mt-1"
              />
            </label>
          </div>
        </fieldset>

        {membros.length > 1 && (
          <div>
            <label htmlFor="filtro-pessoa" className="rotulo">
              Pessoa
            </label>
            <select
              id="filtro-pessoa"
              value={rascunho.userId ?? ''}
              onChange={(e) => setRascunho({ ...rascunho, userId: e.target.value || undefined })}
              className="campo"
            >
              <option value="">Todas as pessoas</option>
              {membros.map((membro) => (
                <option key={membro.id} value={membro.id}>
                  {membro.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="filtro-categoria" className="rotulo">
            Categoria
          </label>
          <select
            id="filtro-categoria"
            value={rascunho.categoriaId ?? ''}
            onChange={(e) => setRascunho({ ...rascunho, categoriaId: e.target.value || undefined })}
            className="campo"
          >
            <option value="">Todas as categorias</option>
            <option value="sem-categoria">Sem categoria</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Dialogo>
  );
}
