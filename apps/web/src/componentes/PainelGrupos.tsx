import { formatarData, parseData, pluralizar, type GrupoDaPessoa } from '@gastos/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { api } from '../api';
import { Confirmar } from './Dialogo';
import { Icone } from './Icone';
import { Botao, CaixaDeErro, Campo, Carregando, traduzirErro, useAviso } from './ui';
import { useSessao } from '../sessao';
import { useIdioma } from '../i18n';

/**
 * Todos os grupos da pessoa: qual está em uso, o código de cada um para
 * compartilhar, e a porta de saída para apagar os que não servem mais.
 */
export function PainelGrupos(): ReactElement {
  const { t, tp, idioma } = useIdioma();
  const { atualizarUsuario } = useSessao();
  const queryClient = useQueryClient();
  const aviso = useAviso();

  const lista = useQuery({ queryKey: ['grupos'], queryFn: () => api.household.grupos() });

  const [nome, setNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aExcluir, setAExcluir] = useState<GrupoDaPessoa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function trocar(grupo: GrupoDaPessoa): Promise<void> {
    if (grupo.ativo) return;
    setOcupado(true);
    setErro(null);
    try {
      atualizarUsuario(await api.household.ativarGrupo(grupo.id));
      await queryClient.invalidateQueries();
      aviso.mostrar(t('Agora você está em "{nome}".', { nome: grupo.nome }));
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setOcupado(false);
    }
  }

  async function criar(): Promise<void> {
    setCriando(true);
    setErro(null);
    try {
      atualizarUsuario(await api.household.criarGrupo({ nome: nome.trim() }));
      await queryClient.invalidateQueries();
      aviso.mostrar(t('Grupo "{nome}" criado e em uso.', { nome: nome.trim() }));
      setNome('');
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setCriando(false);
    }
  }

  async function gerarCodigo(grupo: GrupoDaPessoa): Promise<void> {
    setOcupado(true);
    setErro(null);
    try {
      // O convite nasce no grupo ativo, então passamos por ele antes.
      if (!grupo.ativo) atualizarUsuario(await api.household.ativarGrupo(grupo.id));
      await api.household.criarConvite(7);
      await queryClient.invalidateQueries();
      aviso.mostrar(t('Código novo gerado.'));
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setOcupado(false);
    }
  }

  async function excluir(): Promise<void> {
    if (!aExcluir) return;
    setOcupado(true);
    try {
      atualizarUsuario(await api.household.excluirGrupo(aExcluir.id));
      await queryClient.invalidateQueries();
      aviso.mostrar(t('Grupo "{nome}" apagado.', { nome: aExcluir.nome }));
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setOcupado(false);
      setAExcluir(null);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-base text-slate-700">
        {t('Você pode participar de vários grupos — "Casa", "Família da mãe", "Casa da praia". Cada um tem os próprios gastos e o próprio código.')}
      </p>

      <CaixaDeErro mensagem={erro} />

      {lista.isPending ? (
        <Carregando />
      ) : lista.isError ? (
        <CaixaDeErro mensagem={traduzirErro(lista.error).mensagem} />
      ) : (
        <ul className="space-y-3">
          {lista.data.map((grupo) => (
            <li
              key={grupo.id}
              className={`rounded-xl border-2 p-4 ${
                grupo.ativo ? 'border-marca-600 bg-marca-50' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-slate-900">
                    {grupo.nome}
                  </span>
                  <span className="block text-sm text-slate-600">
                    {grupo.ativo ? t('Em uso agora · ') : ''}
                    {tp(grupo.totalMembros, '{quantidade} pessoa', '{quantidade} pessoas')} ·{' '}
                    {tp(grupo.totalGastos, '{quantidade} gasto', '{quantidade} gastos')}
                    {grupo.papel === 'ADMIN' ? t(' · você modera') : ''}
                  </span>
                </span>

                {grupo.papel === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => setAExcluir(grupo)}
                    aria-label={t('Apagar grupo {nome}', { nome: grupo.nome })}
                    className="flex h-toque w-toque shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Icone nome="lixeira" tamanho={20} />
                  </button>
                )}
              </div>

              {grupo.codigos.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  {grupo.codigos.map((codigo) => {
                    const validade = parseData(codigo.expiraEm.slice(0, 10));
                    return (
                      <li key={codigo.codigo} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold tracking-[0.15em] text-marca-800">
                            {codigo.codigo}
                          </span>
                          <span className="block text-sm text-slate-600">
                            {validade ? t('Vale até {data}', { data: formatarData(validade, idioma) }) : t('Ativo')}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(codigo.codigo);
                            aviso.mostrar(t('Código copiado.'));
                          }}
                          className="min-h-toque shrink-0 rounded-xl border-2 border-slate-300 px-3 text-sm font-semibold text-slate-700"
                        >
                          {t('Copiar')}
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `Entra no grupo "${grupo.nome}" no Family Finance com o código ${codigo.codigo}`,
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-toque shrink-0 items-center rounded-xl border-2 border-slate-300 px-3 text-sm font-semibold text-slate-700"
                        >
                          {t('Enviar')}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {!grupo.ativo && (
                  <Botao variante="secundario" disabled={ocupado} onClick={() => void trocar(grupo)}>
                    {t('Usar este grupo')}
                  </Botao>
                )}
                {grupo.papel === 'ADMIN' && (
                  <Botao
                    variante="secundario"
                    icone="pessoas"
                    disabled={ocupado}
                    onClick={() => void gerarCodigo(grupo)}
                  >
                    {grupo.codigos.length > 0 ? t('Gerar outro código') : t('Gerar código')}
                  </Botao>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-xl bg-slate-50 p-4">
        <p className="text-base font-semibold text-slate-800">{t('Novo grupo')}</p>
        <Campo
          rotulo={t('Nome do grupo')}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={t('Casa da praia, Família da mãe...')}
        />
        <Botao
          larguraTotal
          icone="mais"
          disabled={nome.trim().length < 2}
          carregando={criando}
          onClick={() => void criar()}
        >
          {t('Criar grupo')}
        </Botao>
      </div>

      <Confirmar
        aberto={aExcluir !== null}
        titulo={t('Apagar "{nome}"?', { nome: aExcluir?.nome ?? '' })}
        descricao={
          aExcluir
            ? t('Isto apaga o grupo e {lancamentos}. Não dá para desfazer.', {
                lancamentos: tp(
                  aExcluir.totalGastos,
                  'o lançamento feito nele',
                  'os lançamentos feitos nele',
                ),
              })
            : ''
        }
        rotuloConfirmar={t('Apagar grupo')}
        carregando={ocupado}
        aoCancelar={() => setAExcluir(null)}
        aoConfirmar={() => void excluir()}
      />
    </div>
  );
}
