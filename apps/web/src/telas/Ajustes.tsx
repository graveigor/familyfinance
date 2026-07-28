import { CATEGORIAS_PADRAO, ROTULO_PAPEL, type Categoria, type Usuario } from '@gastos/core';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { CartaoInstalar } from '../componentes/InstalarApp';
import { Confirmar, Dialogo } from '../componentes/Dialogo';
import { Icone } from '../componentes/Icone';
import { Botao, CaixaDeErro, Campo, Carregando, traduzirErro, useAviso } from '../componentes/ui';
import { chaves, useCategorias, useCriarCategoria, useExcluirCategoria, useMembros } from '../consultas';
import { useSessao } from '../sessao';

export function Ajustes(): ReactElement {
  const { usuario, sair } = useSessao();
  const navegar = useNavigate();
  const membros = useMembros();
  const categorias = useCategorias();
  const aviso = useAviso();

  const household = useQuery({ queryKey: chaves.household, queryFn: () => api.household.obter() });

  const [painel, setPainel] = useState<
    'perfil' | 'familia' | 'categorias' | 'instalar' | 'exportar' | null
  >(null);

  const secoes = [
    { chave: 'perfil', icone: 'pessoa', titulo: 'Meu perfil', descricao: usuario?.email ?? '' },
    {
      chave: 'familia',
      icone: 'pessoas',
      titulo: 'Minha família',
      descricao: membros.data
        ? `${membros.data.length} ${membros.data.length === 1 ? 'pessoa' : 'pessoas'}`
        : '...',
    },
    {
      chave: 'categorias',
      icone: 'etiqueta',
      titulo: 'Categorias',
      descricao: categorias.data ? `${categorias.data.length} categorias` : '...',
    },
    {
      chave: 'importar',
      icone: 'planilha',
      titulo: 'Importar planilha',
      descricao: 'Trazer os gastos de um arquivo do Excel',
    },
    {
      chave: 'exportar',
      icone: 'baixar',
      titulo: 'Exportar meus dados',
      descricao: 'Baixar tudo em Excel ou csv',
    },
    { chave: 'instalar', icone: 'baixar', titulo: 'Instalar o app', descricao: 'No celular ou no computador' },
  ] as const;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Ajustes</h1>
        {household.data && <p className="text-base text-slate-600">{household.data.nome}</p>}
      </header>

      <ul className="cartao divide-y divide-slate-100 overflow-hidden">
        {secoes.map((secao) => (
          <li key={secao.chave}>
            <button
              type="button"
              onClick={() =>
                secao.chave === 'importar' ? navegar('/importar') : setPainel(secao.chave)
              }
              className="flex min-h-toque w-full items-center gap-4 px-4 py-4 text-left hover:bg-slate-50"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <Icone nome={secao.icone} tamanho={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-slate-900">{secao.titulo}</span>
                <span className="block truncate text-sm text-slate-600">{secao.descricao}</span>
              </span>
              <Icone nome="direita" tamanho={22} className="shrink-0 text-slate-400" />
            </button>
          </li>
        ))}
      </ul>

      <Botao
        variante="secundario"
        larguraTotal
        icone="sair"
        onClick={() => {
          void sair();
          aviso.mostrar('Você saiu da sua conta.');
        }}
      >
        Sair da conta
      </Botao>

      <p className="pb-4 text-center text-sm text-slate-500">Controle de Gastos · versão 0.1.0</p>

      <Dialogo aberto={painel === 'perfil'} aoFechar={() => setPainel(null)} titulo="Meu perfil">
        <PainelPerfil aoConcluir={() => setPainel(null)} />
      </Dialogo>

      <Dialogo aberto={painel === 'familia'} aoFechar={() => setPainel(null)} titulo="Minha família">
        <PainelFamilia membros={membros.data ?? []} />
      </Dialogo>

      <Dialogo aberto={painel === 'categorias'} aoFechar={() => setPainel(null)} titulo="Categorias">
        <PainelCategorias categorias={categorias.data ?? []} />
      </Dialogo>

      <Dialogo aberto={painel === 'exportar'} aoFechar={() => setPainel(null)} titulo="Exportar meus dados">
        <PainelExportar />
      </Dialogo>

      <Dialogo aberto={painel === 'instalar'} aoFechar={() => setPainel(null)} titulo="Instalar o app">
        <CartaoInstalar />
      </Dialogo>
    </div>
  );
}

function PainelPerfil({ aoConcluir }: { aoConcluir: () => void }): ReactElement {
  const { usuario, atualizarUsuario } = useSessao();
  const aviso = useAviso();
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; campos: Record<string, string> }>({
    mensagem: '',
    campos: {},
  });

  async function salvar(): Promise<void> {
    setSalvando(true);
    setErro({ mensagem: '', campos: {} });
    try {
      const atualizado = await api.auth.atualizarPerfil({
        ...(nome !== usuario?.nome ? { nome } : {}),
        ...(novaSenha ? { novaSenha, senhaAtual } : {}),
      });
      atualizarUsuario(atualizado);
      aviso.mostrar('Perfil atualizado.');
      aoConcluir();
    } catch (falha) {
      setErro(traduzirErro(falha));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <CaixaDeErro mensagem={erro.mensagem || null} />
      <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} erro={erro.campos.nome} />
      <Campo rotulo="E-mail" value={usuario?.email ?? ''} disabled dica="O e-mail não pode ser alterado." />

      <details className="rounded-xl border-2 border-slate-200 p-4">
        <summary className="cursor-pointer text-base font-semibold text-slate-700">
          Trocar minha senha
        </summary>
        <div className="mt-4 space-y-4">
          <Campo
            rotulo="Senha atual"
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            autoComplete="current-password"
            erro={erro.campos.senhaAtual}
          />
          <Campo
            rotulo="Nova senha"
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            autoComplete="new-password"
            dica="Pelo menos 8 caracteres."
            erro={erro.campos.novaSenha}
          />
        </div>
      </details>

      <Botao larguraTotal carregando={salvando} onClick={() => void salvar()}>
        Salvar
      </Botao>
    </div>
  );
}

function PainelFamilia({ membros }: { membros: Usuario[] }): ReactElement {
  const { usuario } = useSessao();
  const aviso = useAviso();
  const [convite, setConvite] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const ehAdmin = usuario?.papel === 'ADMIN';

  async function gerarConvite(): Promise<void> {
    setGerando(true);
    try {
      const novo = await api.household.criarConvite(7);
      setConvite(novo.codigo);
    } catch (falha) {
      aviso.mostrar(traduzirErro(falha).mensagem);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-slate-100">
        {membros.map((membro) => (
          <li key={membro.id} className="flex items-center gap-3 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-marca-100 text-base font-bold text-marca-800">
              {membro.nome.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium text-slate-900">
                {membro.nome}
                {membro.id === usuario?.id && ' (você)'}
              </span>
              <span className="block truncate text-sm text-slate-600">
                {ROTULO_PAPEL[membro.papel]} · {membro.email}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {ehAdmin ? (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4">
          <p className="text-base text-slate-700">
            Para incluir alguém, gere um código e mande para a pessoa. Ela cria a conta usando o
            código e já entra na sua família.
          </p>

          {convite ? (
            <div className="rounded-xl border-2 border-marca-200 bg-white p-4 text-center">
              <p className="text-sm text-slate-600">Código do convite (vale por 7 dias)</p>
              <p className="my-2 text-3xl font-bold tracking-[0.3em] text-marca-800">{convite}</p>
              <Botao
                variante="secundario"
                onClick={() => {
                  void navigator.clipboard?.writeText(convite);
                  aviso.mostrar('Código copiado.');
                }}
              >
                Copiar código
              </Botao>
            </div>
          ) : (
            <Botao larguraTotal carregando={gerando} onClick={() => void gerarConvite()}>
              Gerar código de convite
            </Botao>
          )}
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 p-4 text-base text-slate-700">
          Para incluir alguém na família, peça a quem administra.
        </p>
      )}
    </div>
  );
}

function PainelCategorias({ categorias }: { categorias: Categoria[] }): ReactElement {
  const criar = useCriarCategoria();
  const excluir = useExcluirCategoria();
  const aviso = useAviso();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CATEGORIAS_PADRAO[0]?.cor ?? '#16A34A');
  const [icone, setIcone] = useState('etiqueta');
  const [aExcluir, setAExcluir] = useState<Categoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const iconesDisponiveis = [...new Set(CATEGORIAS_PADRAO.map((c) => c.icone).concat('pata'))];

  async function adicionar(): Promise<void> {
    setErro(null);
    try {
      await criar.mutateAsync({ nome: nome.trim(), icone, cor });
      setNome('');
      aviso.mostrar('Categoria criada.');
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    }
  }

  async function confirmarExclusao(): Promise<void> {
    if (!aExcluir) return;
    try {
      const resultado = (await excluir.mutateAsync(aExcluir.id)) as { gastosSemCategoria: number };
      aviso.mostrar(
        resultado.gastosSemCategoria > 0
          ? `Categoria excluída. ${resultado.gastosSemCategoria} gasto(s) ficaram sem categoria.`
          : 'Categoria excluída.',
      );
    } catch (falha) {
      aviso.mostrar(traduzirErro(falha).mensagem);
    } finally {
      setAExcluir(null);
    }
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-slate-100">
        {categorias.map((categoria) => (
          <li key={categoria.id} className="flex items-center gap-3 py-2">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `${categoria.cor}1A`, color: categoria.cor }}
            >
              <Icone nome={categoria.icone} tamanho={20} />
            </span>
            <span className="flex-1 truncate text-base text-slate-900">{categoria.nome}</span>
            <button
              type="button"
              onClick={() => setAExcluir(categoria)}
              aria-label={`Excluir categoria ${categoria.nome}`}
              className="flex h-toque w-toque items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700"
            >
              <Icone nome="lixeira" tamanho={20} />
            </button>
          </li>
        ))}
      </ul>

      <div className="space-y-3 rounded-xl bg-slate-50 p-4">
        <p className="text-base font-semibold text-slate-800">Nova categoria</p>
        <CaixaDeErro mensagem={erro} />
        <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />

        <div>
          <p className="rotulo">Ícone</p>
          <div className="flex flex-wrap gap-2">
            {iconesDisponiveis.map((nomeIcone) => (
              <button
                key={nomeIcone}
                type="button"
                aria-pressed={icone === nomeIcone}
                aria-label={`Ícone ${nomeIcone}`}
                onClick={() => setIcone(nomeIcone)}
                className={`flex h-toque w-toque items-center justify-center rounded-xl border-2 ${
                  icone === nomeIcone ? 'border-marca-600 bg-marca-50' : 'border-slate-200 bg-white'
                }`}
              >
                <Icone nome={nomeIcone} tamanho={22} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="cor" className="rotulo">
            Cor
          </label>
          <input
            id="cor"
            type="color"
            value={cor}
            onChange={(e) => setCor(e.target.value.toUpperCase())}
            className="h-toque w-24 cursor-pointer rounded-xl border-2 border-slate-300 bg-white p-1"
          />
        </div>

        <Botao
          larguraTotal
          icone="mais"
          disabled={nome.trim().length < 2}
          carregando={criar.isPending}
          onClick={() => void adicionar()}
        >
          Adicionar categoria
        </Botao>
      </div>

      <Confirmar
        aberto={aExcluir !== null}
        titulo={`Excluir "${aExcluir?.nome ?? ''}"?`}
        descricao="Os gastos dessa categoria NÃO serão apagados — eles apenas ficam sem categoria e continuam somando no total."
        carregando={excluir.isPending}
        aoConfirmar={() => void confirmarExclusao()}
        aoCancelar={() => setAExcluir(null)}
      />
    </div>
  );
}

function PainelExportar(): ReactElement {
  const aviso = useAviso();
  const [formato, setFormato] = useState<'xlsx' | 'csv'>('xlsx');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar(): Promise<void> {
    setBaixando(true);
    setErro(null);
    try {
      const arquivo = await api.gastos.exportar({
        formato,
        ...(de ? { de } : {}),
        ...(ate ? { ate } : {}),
      });

      // Link temporário: é como o navegador entrega um arquivo gerado na hora.
      const endereco = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = endereco;
      link.download = `gastos.${formato}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(endereco);

      aviso.mostrar('Arquivo baixado.');
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="space-y-4">
      <CaixaDeErro mensagem={erro} />
      <p className="text-base text-slate-700">
        Baixe seus gastos a qualquer momento. O arquivo abre no Excel e nos programas de planilha.
      </p>

      <div>
        <p className="rotulo">Formato</p>
        <div className="flex gap-2">
          {(['xlsx', 'csv'] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              aria-pressed={formato === opcao}
              onClick={() => setFormato(opcao)}
              className={`min-h-toque flex-1 rounded-xl border-2 px-4 text-base font-semibold ${
                formato === opcao
                  ? 'border-marca-600 bg-marca-50 text-marca-900'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {opcao === 'xlsx' ? 'Excel (.xlsx)' : 'Texto (.csv)'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-slate-600">
          De (opcional)
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="campo mt-1" />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Até (opcional)
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="campo mt-1" />
        </label>
      </div>
      <p className="text-sm text-slate-600">Sem período escolhido, baixa o histórico inteiro.</p>

      <Botao larguraTotal icone="baixar" carregando={baixando} onClick={() => void baixar()}>
        Baixar arquivo
      </Botao>
    </div>
  );
}
