import {
  CAMPOS_IMPORTACAO,
  CAMPOS_OBRIGATORIOS,
  ROTULO_CAMPO,
  formatarBRL,
  formatarData,
  parseData,
  pluralizar,
  type CampoImportacao,
  type LinhaAnalisada,
  type MapeamentoColunas,
  type PreviaImportacao,
  type StatusLinha,
} from '@gastos/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Dialogo } from '../componentes/Dialogo';
import { Icone } from '../componentes/Icone';
import { useTutorialDaPagina, type PassoDeTutorial } from '../componentes/Tutorial';
import { Botao, CaixaDeErro, Campo, traduzirErro, useAviso } from '../componentes/ui';
import { chaves, useCategorias, useMembros } from '../consultas';

const PASSOS: PassoDeTutorial[] = [
  {
    alvo: 'importar-etapas',
    titulo: 'Três passos',
    texto:
      'Enviar o arquivo, dizer o que é cada coluna e conferir antes de gravar. Nada entra nos seus gastos até o último passo.',
  },
  {
    alvo: 'importar-arquivo',
    titulo: 'A planilha',
    texto:
      'Vale Excel (.xlsx) ou .csv. Pode arrastar o arquivo para cá ou tocar para procurar no celular.',
  },
  {
    alvo: 'importar-colunas',
    titulo: 'O que é cada coluna',
    texto:
      'O app tenta adivinhar sozinho olhando os títulos. Onde ele errar, corrija aqui — só data, valor e descrição são obrigatórios.',
  },
  {
    alvo: 'importar-conferencia',
    titulo: 'Confira antes de gravar',
    texto:
      'Desmarque o que não quiser trazer e corrija o que estiver estranho. Linhas com erro ficam de fora sozinhas.',
  },
];

type Etapa = 1 | 2 | 3;

const NOMES_DAS_ETAPAS: Record<Etapa, string> = {
  1: 'Escolher a planilha',
  2: 'Conferir as colunas',
  3: 'Conferir os gastos',
};

const CORES_STATUS: Record<StatusLinha, { fundo: string; texto: string; rotulo: string; icone: string }> =
  {
    PRONTA: { fundo: 'bg-marca-50', texto: 'text-marca-800', rotulo: 'Pronta', icone: 'confirmado' },
    AVISO: { fundo: 'bg-amber-50', texto: 'text-amber-800', rotulo: 'Atenção', icone: 'aviso' },
    ERRO: { fundo: 'bg-red-50', texto: 'text-red-800', rotulo: 'Não dá para importar', icone: 'fechar' },
  };

export function Importar(): ReactElement {
  useTutorialDaPagina('importar', PASSOS);
  const navegar = useNavigate();
  const aviso = useAviso();
  const queryClient = useQueryClient();
  const membros = useMembros();
  const categorias = useCategorias();

  const [etapa, setEtapa] = useState<Etapa>(1);
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [linhas, setLinhas] = useState<LinhaAnalisada[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [emEdicao, setEmEdicao] = useState<LinhaAnalisada | null>(null);

  // Mantém a lista editável em sincronia com o que o servidor devolveu.
  useEffect(() => {
    if (previa) setLinhas(previa.linhas);
  }, [previa]);

  async function enviarArquivo(arquivo: File): Promise<void> {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await api.importacoes.analisar(arquivo, arquivo.name);
      setPrevia(resultado);
      setEtapa(2);
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setOcupado(false);
    }
  }

  async function remapear(
    mapeamento: MapeamentoColunas,
    mesReferencia: string | null,
  ): Promise<void> {
    if (!previa) return;
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await api.importacoes.mapear(previa.importacaoId, {
        mapeamento,
        mesReferencia,
      });
      setPrevia(resultado);
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(): Promise<void> {
    if (!previa) return;
    const marcadas = linhas.filter((linha) => linha.incluir && linha.status !== 'ERRO');
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await api.importacoes.confirmar(previa.importacaoId, {
        linhas: marcadas.map((linha) => ({
          linha: linha.linha,
          descricao: linha.descricao,
          valorCentavos: linha.valorCentavos ?? 0,
          data: linha.data ?? '',
          categoriaId: linha.categoriaId,
          userId: linha.userId ?? '',
        })),
      });
      await queryClient.invalidateQueries({ queryKey: chaves.gastos });
      await queryClient.invalidateQueries({ queryKey: ['resumos'] });
      aviso.mostrar(
        `${pluralizar(resultado.linhasImportadas, 'gasto importado', 'gastos importados')}.`,
      );
      navegar('/gastos');
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar(): Promise<void> {
    if (previa) {
      try {
        await api.importacoes.cancelar(previa.importacaoId);
      } catch {
        // Cancelar é só limpeza: se falhar, a pessoa não precisa saber.
      }
    }
    navegar('/ajustes');
  }

  const marcadas = linhas.filter((linha) => linha.incluir && linha.status !== 'ERRO');
  const totalMarcado = marcadas.reduce((soma, linha) => soma + (linha.valorCentavos ?? 0), 0);

  return (
    <div className="space-y-5 pb-32">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void cancelar()}
          aria-label="Voltar"
          className="-ml-2 flex h-toque w-toque items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
        >
          <Icone nome="esquerda" tamanho={26} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Importar planilha</h1>
      </header>

      <div data-tutorial="importar-etapas">
        <BarraDeEtapas etapa={etapa} />
      </div>

      <CaixaDeErro mensagem={erro} />

      {etapa === 1 && (
        <div data-tutorial="importar-arquivo">
          <EtapaArquivo ocupado={ocupado} aoEscolher={(a) => void enviarArquivo(a)} />
        </div>
      )}

      {etapa === 2 && previa && (
        <div data-tutorial="importar-colunas">
        <EtapaColunas
          previa={previa}
          ocupado={ocupado}
          aoRemapear={(m, mes) => void remapear(m, mes)}
          aoAvancar={() => setEtapa(3)}
        />
        </div>
      )}

      {etapa === 3 && previa && (
        <div data-tutorial="importar-conferencia">
        <EtapaConferencia
          linhas={linhas}
          previa={previa}
          aoAlternar={(numero) =>
            setLinhas((atuais) =>
              atuais.map((linha) =>
                linha.linha === numero ? { ...linha, incluir: !linha.incluir } : linha,
              ),
            )
          }
          aoMarcarTodas={(incluir) =>
            setLinhas((atuais) =>
              atuais.map((linha) =>
                linha.status === 'ERRO' ? linha : { ...linha, incluir },
              ),
            )
          }
          aoEditar={setEmEdicao}
          aoVoltar={() => setEtapa(2)}
        />
        </div>
      )}

      {etapa === 3 && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:left-60"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900">
                {formatarBRL(totalMarcado)}
              </p>
              <p className="truncate text-sm text-slate-600">
                {pluralizar(marcadas.length, 'selecionado', 'selecionados')}
              </p>
            </div>
            <Botao
              onClick={() => void confirmar()}
              carregando={ocupado}
              disabled={marcadas.length === 0}
            >
              Confirmar importação
            </Botao>
          </div>
        </div>
      )}

      <DialogoDeEdicao
        linha={emEdicao}
        membros={membros.data ?? []}
        categorias={categorias.data ?? []}
        aoFechar={() => setEmEdicao(null)}
        aoSalvar={(atualizada) => {
          setLinhas((atuais) =>
            atuais.map((linha) => (linha.linha === atualizada.linha ? atualizada : linha)),
          );
          setEmEdicao(null);
        }}
      />
    </div>
  );
}

function BarraDeEtapas({ etapa }: { etapa: Etapa }): ReactElement {
  return (
    <div>
      <p className="mb-2 text-base font-semibold text-slate-700">
        Passo {etapa} de 3 — {NOMES_DAS_ETAPAS[etapa]}
      </p>
      <div className="flex gap-2" role="img" aria-label={`Passo ${etapa} de 3`}>
        {([1, 2, 3] as const).map((numero) => (
          <div
            key={numero}
            className={`h-2.5 flex-1 rounded-full ${
              numero <= etapa ? 'bg-marca-600' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function EtapaArquivo({
  ocupado,
  aoEscolher,
}: {
  ocupado: boolean;
  aoEscolher: (arquivo: File) => void;
}): ReactElement {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  function aoSoltar(evento: DragEvent<HTMLDivElement>): void {
    evento.preventDefault();
    setArrastando(false);
    const arquivo = evento.dataTransfer.files[0];
    if (arquivo) aoEscolher(arquivo);
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        className={`cartao flex flex-col items-center gap-4 px-6 py-10 text-center transition-colors ${
          arrastando ? 'border-marca-600 bg-marca-50' : ''
        }`}
      >
        <span className="rounded-full bg-slate-100 p-4 text-slate-500">
          <Icone nome="planilha" tamanho={36} />
        </span>
        <div>
          <p className="text-lg font-semibold text-slate-900">Escolha a planilha da família</p>
          <p className="mt-1 text-base text-slate-600">
            Aceita arquivos do Excel (.xlsx, .xls) e .csv.
          </p>
          {/* Arrastar só existe no computador; no celular a frase seria mentira. */}
          <p className="mt-1 hidden text-base text-slate-600 md:block">
            Você também pode arrastar o arquivo para cá.
          </p>
        </div>

        <input
          ref={entrada}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="sr-only"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) aoEscolher(arquivo);
          }}
        />
        <Botao icone="planilha" carregando={ocupado} onClick={() => entrada.current?.click()}>
          Escolher arquivo
        </Botao>
      </div>

      <div className="cartao space-y-2 p-5 text-base text-slate-700">
        <p className="font-semibold text-slate-900">Como funciona</p>
        <p>
          Nada é gravado agora. Você vai conferir tudo na tela e só no final aperta
          "Confirmar importação".
        </p>
        <p>
          O app procura sozinho as colunas de nome, local, valor e data — mesmo que a planilha
          tenha título no topo ou linha de total no fim.
        </p>
      </div>
    </div>
  );
}

function EtapaColunas({
  previa,
  ocupado,
  aoRemapear,
  aoAvancar,
}: {
  previa: PreviaImportacao;
  ocupado: boolean;
  aoRemapear: (mapeamento: MapeamentoColunas, mesReferencia: string | null) => void;
  aoAvancar: () => void;
}): ReactElement {
  const [mapeamento, setMapeamento] = useState<MapeamentoColunas>(previa.mapeamento);
  const [mesReferencia, setMesReferencia] = useState<string>(previa.mesReferencia ?? '');

  useEffect(() => {
    setMapeamento(previa.mapeamento);
    setMesReferencia(previa.mesReferencia ?? '');
  }, [previa]);

  const faltando = CAMPOS_OBRIGATORIOS.filter((campo) => mapeamento[campo] === undefined);
  const precisaDeMes = mapeamento.data === undefined;
  const primeiras = previa.linhas.slice(0, 5);

  function trocar(campo: CampoImportacao, valor: string): void {
    const novo: MapeamentoColunas = { ...mapeamento };
    if (valor === '') delete novo[campo];
    else novo[campo] = Number(valor);
    setMapeamento(novo);
    aoRemapear(novo, mesReferencia || null);
  }

  return (
    <div className="space-y-4">
      <div className="cartao p-5">
        <p className="mb-1 text-base font-semibold text-slate-900">
          Encontramos estas colunas em "{previa.nomeArquivo}"
        </p>
        <p className="mb-4 text-base text-slate-600">
          Se alguma estiver errada, é só trocar.
        </p>

        <div className="space-y-4">
          {CAMPOS_IMPORTACAO.map((campo) => {
            const obrigatorio = CAMPOS_OBRIGATORIOS.includes(campo);
            const faltandoEste = obrigatorio && mapeamento[campo] === undefined;
            return (
              <div key={campo}>
                <label htmlFor={`coluna-${campo}`} className="rotulo">
                  {ROTULO_CAMPO[campo]}
                  {obrigatorio && <span className="ml-1 text-red-700">(obrigatória)</span>}
                </label>
                <select
                  id={`coluna-${campo}`}
                  value={mapeamento[campo] ?? ''}
                  onChange={(e) => trocar(campo, e.target.value)}
                  className={`campo ${faltandoEste ? 'campo-com-erro' : ''}`}
                >
                  <option value="">Não tem essa coluna</option>
                  {previa.colunas.map((titulo, indice) => (
                    <option key={`${titulo}-${indice}`} value={indice}>
                      {titulo || `Coluna ${indice + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {precisaDeMes && (
          <div className="mt-4 rounded-xl bg-amber-50 p-4">
            <label htmlFor="mes-referencia" className="rotulo">
              A planilha não tem data. De qual mês ela é?
            </label>
            <input
              id="mes-referencia"
              type="month"
              value={mesReferencia}
              onChange={(e) => {
                setMesReferencia(e.target.value);
                aoRemapear(mapeamento, e.target.value || null);
              }}
              className="campo"
            />
            <p className="mt-1.5 text-sm text-slate-700">
              Os gastos vão entrar no dia 1 desse mês.
            </p>
          </div>
        )}
      </div>

      <div className="cartao overflow-hidden">
        <p className="border-b border-slate-200 px-4 py-3 text-base font-semibold text-slate-800">
          Como ficaram as primeiras linhas
        </p>
        {primeiras.length === 0 ? (
          <p className="px-4 py-6 text-base text-slate-600">
            Nenhuma linha foi reconhecida ainda. Confira as colunas acima.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {primeiras.map((linha) => (
              <li key={linha.linha} className="px-4 py-3">
                <ResumoDaLinha linha={linha} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Botao
        larguraTotal
        carregando={ocupado}
        disabled={faltando.length > 0 || (precisaDeMes && !mesReferencia)}
        onClick={aoAvancar}
      >
        {faltando.length > 0
          ? `Escolha a coluna de ${faltando.map((c) => ROTULO_CAMPO[c].toLowerCase()).join(' e ')}`
          : 'Continuar'}
      </Botao>
    </div>
  );
}

function EtapaConferencia({
  linhas,
  previa,
  aoAlternar,
  aoMarcarTodas,
  aoEditar,
  aoVoltar,
}: {
  linhas: LinhaAnalisada[];
  previa: PreviaImportacao;
  aoAlternar: (linha: number) => void;
  aoMarcarTodas: (incluir: boolean) => void;
  aoEditar: (linha: LinhaAnalisada) => void;
  aoVoltar: () => void;
}): ReactElement {
  const grupos = useMemo(
    () => ({
      PRONTA: linhas.filter((l) => l.status === 'PRONTA'),
      AVISO: linhas.filter((l) => l.status === 'AVISO'),
      ERRO: linhas.filter((l) => l.status === 'ERRO'),
    }),
    [linhas],
  );

  return (
    <div className="space-y-4">
      <div className="cartao grid grid-cols-3 divide-x divide-slate-200">
        {(['PRONTA', 'AVISO', 'ERRO'] as const).map((status) => (
          <div key={status} className="px-3 py-4 text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              {grupos[status].length}
            </p>
            <p className="text-sm text-slate-600">{CORES_STATUS[status].rotulo}</p>
          </div>
        ))}
      </div>

      {previa.totais.ignoradas > 0 && (
        <p className="text-base text-slate-600">
          {pluralizar(previa.totais.ignoradas, 'linha ignorada', 'linhas ignoradas')} (em branco ou
          de total).
        </p>
      )}

      <div className="flex gap-2">
        <Botao variante="secundario" onClick={() => aoMarcarTodas(true)}>
          Marcar todas
        </Botao>
        <Botao variante="secundario" onClick={() => aoMarcarTodas(false)}>
          Desmarcar todas
        </Botao>
        <Botao variante="texto" icone="esquerda" onClick={aoVoltar}>
          Trocar colunas
        </Botao>
      </div>

      {(['PRONTA', 'AVISO', 'ERRO'] as const).map((status) =>
        grupos[status].length === 0 ? null : (
          <section key={status} className="cartao overflow-hidden">
            <div className={`flex items-center gap-2 px-4 py-3 ${CORES_STATUS[status].fundo}`}>
              <Icone nome={CORES_STATUS[status].icone} tamanho={20} className={CORES_STATUS[status].texto} />
              <h2 className={`text-base font-semibold ${CORES_STATUS[status].texto}`}>
                {CORES_STATUS[status].rotulo} · {grupos[status].length}
              </h2>
            </div>

            {status === 'ERRO' && (
              <p className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">
                Estas linhas não serão importadas. Toque para corrigir.
              </p>
            )}

            <ul className="divide-y divide-slate-100">
              {grupos[status].map((linha) => (
                <li key={linha.linha} className="flex items-start gap-3 px-4 py-3">
                  {status !== 'ERRO' && (
                    <label className="flex h-toque w-8 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={linha.incluir}
                        onChange={() => aoAlternar(linha.linha)}
                        className="h-6 w-6 rounded border-2 border-slate-400 text-marca-600 focus:ring-marca-500"
                      />
                      <span className="sr-only">Importar a linha {linha.linha}</span>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => aoEditar(linha)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <ResumoDaLinha linha={linha} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

function ResumoDaLinha({ linha }: { linha: LinhaAnalisada }): ReactElement {
  const data = linha.data ? parseData(linha.data) : null;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-base font-medium text-slate-900">
          {linha.descricao || <span className="text-slate-400">sem descrição</span>}
        </span>
        <span className="shrink-0 text-base font-semibold tabular-nums text-slate-900">
          {linha.valorCentavos === null ? '—' : formatarBRL(linha.valorCentavos)}
        </span>
      </div>
      <p className="truncate text-sm text-slate-600">
        Linha {linha.linha} · {data ? formatarData(data) : 'sem data'}
        {linha.textoPessoa ? ` · ${linha.textoPessoa}` : ''}
      </p>
      {[...linha.erros, ...linha.avisos].map((texto) => (
        <p
          key={texto}
          className={`mt-1 text-sm ${linha.erros.includes(texto) ? 'text-red-700' : 'text-amber-800'}`}
        >
          {texto}
        </p>
      ))}
    </div>
  );
}

function DialogoDeEdicao({
  linha,
  membros,
  categorias,
  aoFechar,
  aoSalvar,
}: {
  linha: LinhaAnalisada | null;
  membros: Array<{ id: string; nome: string }>;
  categorias: Array<{ id: string; nome: string }>;
  aoFechar: () => void;
  aoSalvar: (linha: LinhaAnalisada) => void;
}): ReactElement | null {
  const [rascunho, setRascunho] = useState<LinhaAnalisada | null>(linha);
  const [valorTexto, setValorTexto] = useState('');

  useEffect(() => {
    setRascunho(linha);
    setValorTexto(linha?.valorCentavos !== null && linha ? String(Math.abs(linha.valorCentavos)) : '');
  }, [linha]);

  if (!linha || !rascunho) return null;

  const centavos = valorTexto === '' ? 0 : Number(valorTexto.replace(/\D/g, ''));
  const negativo = (linha.valorCentavos ?? 0) < 0;
  const podeSalvar = rascunho.descricao.trim() !== '' && centavos !== 0 && Boolean(rascunho.data);

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo={`Linha ${linha.linha}`}
      rodape={
        <>
          <Botao variante="secundario" larguraTotal onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            larguraTotal
            disabled={!podeSalvar}
            onClick={() => {
              const valor = negativo ? -centavos : centavos;
              aoSalvar({
                ...rascunho,
                valorCentavos: valor,
                // Corrigida à mão, a linha passa a valer e entra na importação.
                status: 'AVISO',
                erros: [],
                avisos: ['Corrigida por você.'],
                incluir: true,
              });
            }}
          >
            Salvar linha
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo
          rotulo="Onde foi"
          value={rascunho.descricao}
          onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
        />
        <Campo
          rotulo="Valor"
          inputMode="numeric"
          value={centavos === 0 ? '' : formatarBRL(negativo ? -centavos : centavos)}
          onChange={(e) => setValorTexto(e.target.value.replace(/\D/g, ''))}
          placeholder="R$ 0,00"
          dica={negativo ? 'Este lançamento é um estorno (valor negativo).' : undefined}
        />
        <Campo
          rotulo="Data"
          type="date"
          value={rascunho.data ?? ''}
          onChange={(e) => setRascunho({ ...rascunho, data: e.target.value || null })}
        />

        <div>
          <label htmlFor="edicao-pessoa" className="rotulo">
            Quem gastou
          </label>
          <select
            id="edicao-pessoa"
            value={rascunho.userId ?? ''}
            onChange={(e) => setRascunho({ ...rascunho, userId: e.target.value })}
            className="campo"
          >
            {membros.map((membro) => (
              <option key={membro.id} value={membro.id}>
                {membro.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="edicao-categoria" className="rotulo">
            Categoria
          </label>
          <select
            id="edicao-categoria"
            value={rascunho.categoriaId ?? ''}
            onChange={(e) => setRascunho({ ...rascunho, categoriaId: e.target.value || null })}
            className="campo"
          >
            <option value="">Sem categoria</option>
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
