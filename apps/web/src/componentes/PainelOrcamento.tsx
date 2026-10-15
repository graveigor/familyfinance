import { centavosDoTextoMascarado, hoje, type OrcamentoDaCategoria } from '@gastos/core';
import { useState, type ReactElement } from 'react';
import { Icone } from './Icone';
import { Botao, CaixaDeErro, Campo, Carregando, traduzirErro, useAviso } from './ui';
import {
  useCategorias,
  useDefinirOrcamento,
  useOrcamentos,
  useRemoverOrcamento,
} from '../consultas';
import { useDinheiro } from '../i18n/dinheiro';
import { useIdioma } from '../i18n';

/**
 * Onde a pessoa define o teto de cada categoria.
 *
 * O teto é só dela — nem quem compartilha os gastos mostra o seu limite. O
 * texto diz isso na cara, porque num app de família a suposição natural é a
 * oposta.
 */
export function PainelOrcamento(): ReactElement {
  const { t } = useIdioma();
  const { mascara } = useDinheiro();
  const aviso = useAviso();

  const agora = hoje();
  const lista = useOrcamentos(agora.getUTCFullYear(), agora.getUTCMonth() + 1);
  const categorias = useCategorias('DESPESA');
  const definir = useDefinirOrcamento();
  const remover = useRemoverOrcamento();

  const [categoriaId, setCategoriaId] = useState('');
  const [digitos, setDigitos] = useState('');
  const [erro, setErro] = useState<{ mensagem: string; campos: Record<string, string> }>({
    mensagem: '',
    campos: {},
  });

  const centavos = centavosDoTextoMascarado(digitos);
  const jaTemTeto = new Set((lista.data ?? []).map((o) => o.categoria.id));
  // Só oferece o que ainda não tem teto: para alterar, a pessoa usa a linha
  // da lista, que já mostra o valor atual.
  const disponiveis = (categorias.data ?? []).filter((c) => !jaTemTeto.has(c.id));

  async function salvar(): Promise<void> {
    setErro({ mensagem: '', campos: {} });
    try {
      await definir.mutateAsync({ categoriaId, limiteCentavos: centavos });
      setCategoriaId('');
      setDigitos('');
      aviso.mostrar(t('Limite salvo'));
    } catch (falha) {
      setErro(traduzirErro(falha));
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-base text-slate-700">
        {t('Um teto por mês em cada categoria. Só você vê os seus limites.')}
      </p>

      {lista.isPending ? (
        <Carregando />
      ) : lista.data && lista.data.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {lista.data.map((item) => (
            <LinhaDoTeto
              key={item.categoria.id}
              item={item}
              aoRemover={async () => {
                await remover.mutateAsync(item.categoria.id);
                aviso.mostrar(t('Limite removido'));
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-slate-50 p-4 text-base text-slate-600">
          {t('Nenhum limite definido ainda.')}
        </p>
      )}

      <div className="space-y-3 rounded-xl bg-slate-50 p-4">
        <p className="text-base font-semibold text-slate-800">{t('Novo limite')}</p>
        <CaixaDeErro mensagem={erro.mensagem} />

        <div>
          <label htmlFor="categoria-do-teto" className="rotulo">
            {t('Categoria')}
          </label>
          <select
            id="categoria-do-teto"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="campo"
          >
            <option value="">{t('Escolha uma categoria')}</option>
            {disponiveis.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {t(categoria.nome)}
              </option>
            ))}
          </select>
          {disponiveis.length === 0 && (
            <p className="mt-1 text-sm text-slate-600">
              {t('Todas as categorias já têm limite.')}
            </p>
          )}
        </div>

        <Campo
          rotulo={t('Limite por mês')}
          inputMode="numeric"
          value={mascara(digitos)}
          onChange={(e) => setDigitos(e.target.value.replace(/\D/g, ''))}
          placeholder={mascara('')}
          erro={erro.campos.limiteCentavos}
        />

        <Botao
          larguraTotal
          onClick={salvar}
          carregando={definir.isPending}
          disabled={!categoriaId || centavos === 0}
        >
          {t('Salvar limite')}
        </Botao>
      </div>

      <p className="text-sm text-slate-600">
        {t('O aviso acende quando o gasto chega a 80% do limite.')}
      </p>
      <p className="text-sm text-slate-600">
        {t('O limite compara com o SEU gasto, não com o da família.')}
      </p>
    </div>
  );
}

function LinhaDoTeto({
  item,
  aoRemover,
}: {
  item: OrcamentoDaCategoria;
  aoRemover: () => Promise<void>;
}): ReactElement {
  const { t } = useIdioma();
  const { dinheiro } = useDinheiro();

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${item.categoria.cor}1A`, color: item.categoria.cor }}
      >
        <Icone nome={item.categoria.icone} tamanho={22} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-slate-900">
          {t(item.categoria.nome)}
        </span>
        <span className="block truncate text-sm text-slate-600">
          {t('{gasto} de {limite} neste mês', {
            gasto: dinheiro(item.gastoCentavos),
            limite: dinheiro(item.limiteCentavos),
          })}
        </span>
      </span>

      <button
        type="button"
        onClick={aoRemover}
        aria-label={t('Remover limite de {nome}', { nome: t(item.categoria.nome) })}
        className="flex h-toque w-toque shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700"
      >
        <Icone nome="lixeira" tamanho={20} />
      </button>
    </li>
  );
}
