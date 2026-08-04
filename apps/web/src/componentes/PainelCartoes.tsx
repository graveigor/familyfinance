import { ROTULO_TIPO_CARTAO, TIPOS_CARTAO, type Cartao, type TipoCartao } from '@gastos/core';
import { useState, type ReactElement } from 'react';
import { Confirmar } from './Dialogo';
import { Icone } from './Icone';
import { Botao, CaixaDeErro, Campo, Carregando, traduzirErro, useAviso } from './ui';
import { useCartoes, useCriarCartao, useExcluirCartao } from '../consultas';
import { useT } from '../i18n';

const CORES = ['#334155', '#EA580C', '#DC2626', '#7C3AED', '#0891B2', '#16A34A'];

/**
 * Cadastro dos cartões da família. O apelido é livre porque é assim que a
 * pessoa fala: "o do Itaú", "o cartão da farmácia". Crédito/débito é só uma
 * etiqueta a mais, para dois cartões do mesmo banco não se confundirem.
 */
export function PainelCartoes(): ReactElement {
  const t = useT();
  const lista = useCartoes();
  const criar = useCriarCartao();
  const excluir = useExcluirCartao();
  const aviso = useAviso();

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoCartao>('CREDITO');
  const [cor, setCor] = useState(CORES[0] ?? '#334155');
  const [aExcluir, setAExcluir] = useState<Cartao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar(): Promise<void> {
    setErro(null);
    try {
      await criar.mutateAsync({ nome: nome.trim(), tipo, cor });
      setNome('');
      aviso.mostrar(t('Cartão adicionado.'));
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    }
  }

  async function confirmarExclusao(): Promise<void> {
    if (!aExcluir) return;
    try {
      const resultado = (await excluir.mutateAsync(aExcluir.id)) as { gastosSemCartao: number };
      aviso.mostrar(
        resultado.gastosSemCartao > 0
          ? t('Cartão removido. {total} gasto(s) ficaram sem cartão.', {
              total: resultado.gastosSemCartao,
            })
          : t('Cartão removido.'),
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
        {t('Separe os gastos por cartão para saber quanto foi em cada um. Dê o nome que você usa no dia a dia — "Itaú", "Bradesco", "Vale-refeição".')}
      </p>

      {lista.isPending ? (
        <Carregando />
      ) : lista.isError ? (
        <CaixaDeErro mensagem={traduzirErro(lista.error).mensagem} />
      ) : lista.data.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-base text-slate-600">
          {t('Nenhum cartão ainda. Enquanto não houver nenhum, o campo de cartão nem aparece ao lançar um gasto.')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {lista.data.map((cartao) => (
            <li key={cartao.id} className="flex items-center gap-3 py-2">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${cartao.cor}1A`, color: cartao.cor }}
              >
                <Icone nome="cartao" tamanho={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base text-slate-900">{cartao.nome}</span>
                <span className="block text-sm text-slate-600">
                  {t(ROTULO_TIPO_CARTAO[cartao.tipo])}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setAExcluir(cartao)}
                aria-label={t('Excluir cartão {nome}', { nome: cartao.nome })}
                className="flex h-toque w-toque shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700"
              >
                <Icone nome="lixeira" tamanho={20} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-xl bg-slate-50 p-4">
        <p className="text-base font-semibold text-slate-800">{t('Novo cartão')}</p>
        <CaixaDeErro mensagem={erro} />

        <Campo
          rotulo={t('Nome ou apelido')}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={t('Itaú, Bradesco, Nubank da Ana...')}
        />

        <div>
          <p className="rotulo">{t('Tipo')}</p>
          <div className="flex gap-2">
            {TIPOS_CARTAO.map((opcao) => (
              <button
                key={opcao}
                type="button"
                aria-pressed={tipo === opcao}
                onClick={() => setTipo(opcao)}
                className={`min-h-toque flex-1 rounded-xl border-2 px-4 text-base font-semibold ${
                  tipo === opcao
                    ? 'border-marca-600 bg-marca-50 text-marca-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {t(ROTULO_TIPO_CARTAO[opcao])}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="rotulo">{t('Cor')}</p>
          <div className="flex flex-wrap gap-2">
            {CORES.map((opcao) => (
              <button
                key={opcao}
                type="button"
                aria-pressed={cor === opcao}
                aria-label={t('Cor {cor}', { cor: opcao })}
                onClick={() => setCor(opcao)}
                className={`flex h-toque w-toque items-center justify-center rounded-xl border-2 ${
                  cor === opcao ? 'border-marca-600' : 'border-slate-200'
                }`}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: opcao, color: '#FFFFFF' }}
                >
                  {cor === opcao && <Icone nome="confirmado" tamanho={16} />}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Botao
          larguraTotal
          icone="mais"
          disabled={nome.trim().length < 2}
          carregando={criar.isPending}
          onClick={() => void adicionar()}
        >
          {t('Adicionar cartão')}
        </Botao>
      </div>

      <Confirmar
        aberto={aExcluir !== null}
        titulo={t('Excluir "{nome}"?', { nome: aExcluir?.nome ?? '' })}
        descricao={t('Os gastos desse cartão NÃO serão apagados — eles apenas ficam sem cartão e continuam somando no total.')}
        carregando={excluir.isPending}
        aoConfirmar={() => void confirmarExclusao()}
        aoCancelar={() => setAExcluir(null)}
      />
    </div>
  );
}
