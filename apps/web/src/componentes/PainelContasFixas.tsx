import {
  centavosDoTextoMascarado,
  formatarBRL,
  formatarData,
  mascararMoeda,
  parseData,
  type Recorrencia,
} from '@gastos/core';
import { useState, type ReactElement } from 'react';
import { Confirmar } from './Dialogo';
import { EscolherCartao } from './EscolherCartao';
import { Icone } from './Icone';
import { Botao, CaixaDeErro, Campo, Carregando, traduzirErro, useAviso } from './ui';
import {
  useAlternarRecorrencia,
  useCategorias,
  useCriarRecorrencia,
  useExcluirRecorrencia,
  useRecorrencias,
} from '../consultas';
import { useIdioma } from '../i18n';

/**
 * Contas fixas: o que se repete todo mês (aluguel, internet, mensalidade).
 * O lançamento do mês é criado quando alguém abre o app — nada roda escondido.
 */
export function PainelContasFixas(): ReactElement {
  const { t, idioma } = useIdioma();
  const lista = useRecorrencias();
  const categorias = useCategorias();
  const criar = useCriarRecorrencia();
  const excluir = useExcluirRecorrencia();
  const alternar = useAlternarRecorrencia();
  const aviso = useAviso();

  const [digitos, setDigitos] = useState('');
  const [descricao, setDescricao] = useState('');
  const [diaDoMes, setDiaDoMes] = useState('10');
  const [categoriaId, setCategoriaId] = useState('');
  const [cartaoId, setCartaoId] = useState('');
  const [erro, setErro] = useState<{ mensagem: string; campos: Record<string, string> }>({
    mensagem: '',
    campos: {},
  });
  const [aExcluir, setAExcluir] = useState<Recorrencia | null>(null);

  const centavos = centavosDoTextoMascarado(digitos);

  async function adicionar(): Promise<void> {
    setErro({ mensagem: '', campos: {} });
    try {
      await criar.mutateAsync({
        descricao: descricao.trim(),
        valorCentavos: centavos,
        diaDoMes: Number(diaDoMes),
        formaPagamento: 'OUTRO',
        ...(categoriaId ? { categoriaId } : {}),
        ...(cartaoId ? { cartaoId } : {}),
      });
      setDigitos('');
      setDescricao('');
      aviso.mostrar(t('Conta fixa criada e já lançada neste mês.'));
    } catch (falha) {
      setErro(traduzirErro(falha));
    }
  }

  async function confirmarExclusao(): Promise<void> {
    if (!aExcluir) return;
    try {
      const resultado = (await excluir.mutateAsync(aExcluir.id)) as { gastosMantidos: number };
      aviso.mostrar(
        resultado.gastosMantidos > 0
          ? t('Conta fixa removida. Os {total} lançamentos já feitos continuam.', {
              total: resultado.gastosMantidos,
            })
          : t('Conta fixa removida.'),
      );
    } catch (falha) {
      aviso.mostrar(traduzirErro(falha).mensagem);
    } finally {
      setAExcluir(null);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-base text-slate-700">
        {t('Contas que se repetem todo mês. O lançamento entra sozinho na data escolhida — você não precisa digitar de novo.')}
      </p>

      {lista.isPending ? (
        <Carregando />
      ) : lista.isError ? (
        <CaixaDeErro mensagem={traduzirErro(lista.error).mensagem} />
      ) : lista.data.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-base text-slate-600">
          {t('Nenhuma conta fixa ainda.')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {lista.data.map((recorrencia) => {
            const proximo = recorrencia.proximoEm ? parseData(recorrencia.proximoEm) : null;
            return (
              <li key={recorrencia.id} className="flex items-center gap-3 py-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: recorrencia.categoria
                      ? `${recorrencia.categoria.cor}1A`
                      : '#F1F5F9',
                    color: recorrencia.categoria?.cor ?? '#64748B',
                  }}
                >
                  <Icone nome={recorrencia.categoria?.icone ?? 'calendario'} tamanho={22} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-slate-900">
                    {recorrencia.descricao}
                  </span>
                  <span className="block truncate text-sm text-slate-600">
                    {formatarBRL(recorrencia.valorCentavos, idioma)} ·{' '}
                    {t('todo dia {dia}', { dia: recorrencia.diaDoMes })}
                    {recorrencia.cartao ? ` · ${recorrencia.cartao.nome}` : ''}
                    {recorrencia.ativa && proximo
                      ? ` · ${t('próximo em {data}', { data: formatarData(proximo, idioma) })}`
                      : ` · ${t('pausada')}`}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() =>
                    alternar.mutate({ id: recorrencia.id, ativa: !recorrencia.ativa })
                  }
                  aria-label={
                    recorrencia.ativa
                      ? t('Pausar {nome}', { nome: recorrencia.descricao })
                      : t('Retomar {nome}', { nome: recorrencia.descricao })
                  }
                  className={`min-h-toque shrink-0 rounded-xl border-2 px-3 text-sm font-semibold ${
                    recorrencia.ativa
                      ? 'border-marca-600 bg-marca-50 text-marca-900'
                      : 'border-slate-300 text-slate-600'
                  }`}
                >
                  {recorrencia.ativa ? t('Ativa') : t('Pausada')}
                </button>

                <button
                  type="button"
                  onClick={() => setAExcluir(recorrencia)}
                  aria-label={t('Excluir {nome}', { nome: recorrencia.descricao })}
                  className="flex h-toque w-toque shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Icone nome="lixeira" tamanho={20} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-3 rounded-xl bg-slate-50 p-4">
        <p className="text-base font-semibold text-slate-800">{t('Nova conta fixa')}</p>
        <CaixaDeErro mensagem={erro.mensagem || null} />

        <Campo
          rotulo={t('O que é')}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={t('Aluguel, internet, mensalidade...')}
          erro={erro.campos.descricao}
        />

        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo={t('Valor')}
            inputMode="numeric"
            value={mascararMoeda(digitos, idioma)}
            onChange={(e) => setDigitos(e.target.value.replace(/\D/g, ''))}
            placeholder="R$ 0,00"
            erro={erro.campos.valorCentavos}
          />
          <Campo
            rotulo={t('Todo dia')}
            type="number"
            min={1}
            max={31}
            value={diaDoMes}
            onChange={(e) => setDiaDoMes(e.target.value)}
            dica={t('Dia 31 cai no último dia dos meses curtos.')}
            erro={erro.campos.diaDoMes}
          />
        </div>

        <div>
          <label htmlFor="categoria-fixa" className="rotulo">
            {t('Categoria (opcional)')}
          </label>
          <select
            id="categoria-fixa"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="campo"
          >
            <option value="">{t('Sem categoria')}</option>
            {categorias.data?.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {t(categoria.nome)}
              </option>
            ))}
          </select>
        </div>

        <EscolherCartao id="cartao-fixa" valor={cartaoId} aoMudar={setCartaoId} />

        <Botao
          larguraTotal
          icone="mais"
          disabled={descricao.trim().length < 1 || centavos === 0}
          carregando={criar.isPending}
          onClick={() => void adicionar()}
        >
          {t('Adicionar conta fixa')}
        </Botao>
      </div>

      <Confirmar
        aberto={aExcluir !== null}
        titulo={`Excluir "${aExcluir?.descricao ?? ''}"?`}
        descricao="Os lançamentos que já foram feitos continuam no histórico — para de gerar só daqui para a frente."
        carregando={excluir.isPending}
        aoConfirmar={() => void confirmarExclusao()}
        aoCancelar={() => setAExcluir(null)}
      />
    </div>
  );
}
