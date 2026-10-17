import { centavosDoTextoMascarado, formatarData, hoje, parseData, type Receita } from '@gastos/core';
import { useEffect, useState, type ReactElement } from 'react';
import { Confirmar } from '../componentes/Dialogo';
import { Icone } from '../componentes/Icone';
import { useTutorialDaPagina, type PassoDeTutorial } from '../componentes/Tutorial';
import {
  Botao,
  CaixaDeErro,
  Campo,
  Carregando,
  Vazio,
  traduzirErro,
  useAviso,
} from '../componentes/ui';
import {
  useCategorias,
  useCriarReceita,
  useExcluirReceita,
  useMembros,
  useReceitas,
} from '../consultas';
import { useDinheiro } from '../i18n/dinheiro';
import { useIdioma } from '../i18n';
import { useSessao } from '../sessao';

/**
 * O que entra: salário, freela, aluguel recebido.
 *
 * Tela separada da de gastos de propósito. Misturar os dois num formulário só,
 * com um botãozinho de sinal, é o jeito mais rápido de alguém lançar o salário
 * como despesa — e o número do mês só mentiria depois, quando ninguém mais
 * lembra de onde veio.
 */

const PASSOS: PassoDeTutorial[] = [
  {
    alvo: 'receita-valor',
    titulo: 'Quanto entrou',
    texto: 'Digite só os números: o app põe a vírgula sozinho, como no lançamento de gasto.',
  },
  {
    alvo: 'receita-categoria',
    titulo: 'Categorias de entrada',
    texto:
      'Aqui só aparecem categorias de entrada — "Salário", "Freela" —, nunca as de gasto. São listas separadas de propósito: salário não é despesa de mercado.',
  },
  {
    alvo: 'receita-lista',
    titulo: 'Suas entradas',
    texto:
      'Tudo o que entrou aparece aqui, da mais recente para a mais antiga. Só você vê as suas, como acontece com os gastos.',
  },
];

export function Receitas(): ReactElement {
  const { t, idioma } = useIdioma();
  const { dinheiro, mascara } = useDinheiro();
  const { usuario } = useSessao();
  const aviso = useAviso();
  useTutorialDaPagina('receitas', PASSOS);

  const lista = useReceitas();
  const categorias = useCategorias('RECEITA');
  const membros = useMembros();
  const criar = useCriarReceita();
  const excluir = useExcluirReceita();

  const [digitos, setDigitos] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(() => hoje().toISOString().slice(0, 10));
  const [categoriaId, setCategoriaId] = useState('');
  const [userId, setUserId] = useState('');
  const [aExcluir, setAExcluir] = useState<Receita | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; campos: Record<string, string> }>({
    mensagem: '',
    campos: {},
  });

  useEffect(() => {
    if (!userId && usuario) setUserId(usuario.id);
  }, [usuario, userId]);

  const centavos = centavosDoTextoMascarado(digitos);

  async function enviar(): Promise<void> {
    setErro({ mensagem: '', campos: {} });
    try {
      await criar.mutateAsync({
        descricao: descricao.trim(),
        valorCentavos: centavos,
        data,
        ...(categoriaId ? { categoriaId } : {}),
        ...(userId ? { userId } : {}),
      });
      setDigitos('');
      setDescricao('');
      setCategoriaId('');
      aviso.mostrar(t('Entrada registrada'));
    } catch (falha) {
      setErro(traduzirErro(falha));
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{t('Entradas')}</h1>
        <p className="mt-1 text-base text-slate-600">
          {t('Salário, freela, aluguel recebido — o que entra.')}
        </p>
      </header>

      {/* O total puxa para o verde, que é a cor de dinheiro que entra no app. */}
      {lista.data && lista.data.totalCentavos > 0 && (
        <section className="rounded-2xl bg-menta-50 px-6 py-5 text-center">
          <p className="text-base text-menta-700">{t('Total das entradas')}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-menta-700">
            {dinheiro(lista.data.totalCentavos)}
          </p>
        </section>
      )}

      <section className="cartao space-y-3 p-5">
        <p className="text-base font-semibold text-slate-800">{t('Nova entrada')}</p>
        <CaixaDeErro mensagem={erro.mensagem} />

        <div data-tutorial="receita-valor">
          <Campo
            rotulo={t('Quanto entrou')}
            inputMode="numeric"
            value={mascara(digitos)}
            onChange={(e) => setDigitos(e.target.value.replace(/\D/g, ''))}
            placeholder={mascara('')}
            erro={erro.campos.valorCentavos}
          />
        </div>

        <Campo
          rotulo={t('De onde veio')}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={t('Salário, freela do site, aluguel...')}
          erro={erro.campos.descricao}
        />

        <Campo
          rotulo={t('Quando')}
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          erro={erro.campos.data}
        />

        <div data-tutorial="receita-categoria">
          <label htmlFor="categoria-receita" className="rotulo">
            {t('Categoria')}
          </label>
          <select
            id="categoria-receita"
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

        {(membros.data?.length ?? 0) > 1 && (
          <div>
            <label htmlFor="quem-recebeu" className="rotulo">
              {t('Quem recebeu?')}
            </label>
            <select
              id="quem-recebeu"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="campo"
            >
              {membros.data?.map((membro) => (
                <option key={membro.id} value={membro.id}>
                  {membro.nome}
                  {membro.id === usuario?.id ? t(' (você)') : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <Botao
          larguraTotal
          onClick={enviar}
          carregando={criar.isPending}
          disabled={centavos === 0 || descricao.trim().length < 1}
        >
          {t('Salvar entrada')}
        </Botao>
      </section>

      <section className="cartao p-5" data-tutorial="receita-lista">
        <h2 className="mb-3 text-base font-semibold text-slate-800">{t('Suas entradas')}</h2>

        {lista.isPending ? (
          <Carregando />
        ) : lista.data && lista.data.itens.length === 0 ? (
          <Vazio
            icone="cima"
            titulo={t('Nenhuma entrada ainda')}
            descricao={t('Registre o salário ou um freela para o saldo do mês fazer sentido.')}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.data?.itens.map((receita) => {
              const quando = parseData(receita.data);
              return (
                <li key={receita.id} className="flex items-center gap-3 py-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: receita.categoria ? `${receita.categoria.cor}1A` : '#ECFDF7',
                      color: receita.categoria?.cor ?? '#0E8F6D',
                    }}
                  >
                    <Icone nome={receita.categoria?.icone ?? 'cima'} tamanho={22} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-slate-900">
                      {receita.descricao}
                    </span>
                    <span className="block truncate text-sm text-slate-600">
                      {receita.usuario.nome}
                      {quando ? ` · ${formatarData(quando, idioma)}` : ''}
                      {receita.categoria ? ` · ${t(receita.categoria.nome)}` : ''}
                    </span>
                  </span>

                  <span className="shrink-0 text-valor tabular-nums text-menta-700">
                    {dinheiro(receita.valorCentavos)}
                  </span>

                  <button
                    type="button"
                    onClick={() => setAExcluir(receita)}
                    aria-label={t('Excluir {nome}', { nome: receita.descricao })}
                    className="flex h-toque w-toque shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Icone nome="lixeira" tamanho={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Confirmar
        aberto={aExcluir !== null}
        titulo={t('Excluir "{nome}"?', { nome: aExcluir?.descricao ?? '' })}
        descricao={t('A entrada sai do saldo do mês. Não dá para desfazer.')}
        aoCancelar={() => setAExcluir(null)}
        carregando={excluir.isPending}
        aoConfirmar={async () => {
          if (!aExcluir) return;
          await excluir.mutateAsync(aExcluir.id);
          setAExcluir(null);
          aviso.mostrar(t('Entrada excluída'));
        }}
      />
    </div>
  );
}
