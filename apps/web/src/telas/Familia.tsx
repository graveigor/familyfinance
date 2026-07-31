import {
  centavosDoTextoMascarado,
  formatarBRL,
  mascararMoeda,
  type Meta,
  type Usuario,
} from '@gastos/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { api } from '../api';
import { Confirmar, Dialogo } from '../componentes/Dialogo';
import { Icone } from '../componentes/Icone';
import { useTutorialDaPagina, type PassoDeTutorial } from '../componentes/Tutorial';
import { Botao, CaixaDeErro, Campo, Carregando, traduzirErro, useAviso } from '../componentes/ui';
import { chaves, useMembros } from '../consultas';
import { useSessao } from '../sessao';

const PASSOS: PassoDeTutorial[] = [
  {
    alvo: 'familia-privacidade',
    titulo: 'Seus gastos são só seus',
    texto:
      'Por padrão, ninguém do grupo vê o que você lança — nem quem administra. Ligue a chave aqui se quiser que o grupo acompanhe seus gastos. Dá para desligar quando quiser.',
  },
  {
    alvo: 'familia-codigo',
    titulo: 'Convide quem você quiser',
    texto:
      'Gere um código como FF-9A3K2 e mande pelo WhatsApp. Quem receber usa esse código ao criar a conta e entra no seu grupo.',
  },
  {
    alvo: 'familia-membros',
    titulo: 'Quem está no grupo',
    texto:
      'Aqui aparecem as pessoas do grupo e quem escolheu compartilhar os gastos. O cadeado indica que os lançamentos daquela pessoa são privados.',
  },
  {
    alvo: 'familia-metas',
    titulo: 'Metas de todo mundo',
    texto:
      'Metas conjuntas, como "Viagem de férias", aparecem para o grupo inteiro. É o único valor que todos veem junto.',
  },
];

export function Familia(): ReactElement {
  useTutorialDaPagina('familia', PASSOS);

  const { usuario, atualizarUsuario } = useSessao();
  const membros = useMembros();
  const aviso = useAviso();
  const queryClient = useQueryClient();

  const grupo = useQuery({ queryKey: chaves.household, queryFn: () => api.household.obter() });
  const metas = useQuery({ queryKey: ['metas'], queryFn: () => api.household.metas() });

  const [codigo, setCodigo] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [alternando, setAlternando] = useState(false);
  const [painel, setPainel] = useState<'novo-grupo' | 'entrar-grupo' | 'nova-meta' | null>(null);
  const [metaAExcluir, setMetaAExcluir] = useState<Meta | null>(null);
  const [membroARemover, setMembroARemover] = useState<Usuario | null>(null);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const compartilhando = usuario?.compartilhaGastos ?? false;
  const souModerador = usuario?.papel === 'ADMIN';
  const grupoTemMaisGente = (membros.data?.length ?? 0) > 1;

  async function removerMembro(): Promise<void> {
    if (!membroARemover) return;
    try {
      await api.household.removerMembro(membroARemover.id);
      await queryClient.invalidateQueries();
      aviso.mostrar(`${membroARemover.nome} saiu do grupo. Os lançamentos foram junto.`);
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setMembroARemover(null);
    }
  }

  async function sairDoGrupo(): Promise<void> {
    setSaindo(true);
    setErro(null);
    try {
      const atualizado = await api.household.sair();
      atualizarUsuario(atualizado);
      await queryClient.invalidateQueries();
      aviso.mostrar('Você saiu do grupo. Seus lançamentos vieram com você.');
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setSaindo(false);
      setConfirmandoSaida(false);
    }
  }

  async function alternarCompartilhamento(): Promise<void> {
    setAlternando(true);
    setErro(null);
    try {
      const atualizado = await api.auth.atualizarPerfil({ compartilhaGastos: !compartilhando });
      atualizarUsuario(atualizado);
      await queryClient.invalidateQueries();
      aviso.mostrar(
        atualizado.compartilhaGastos
          ? 'Seus gastos agora aparecem para o grupo.'
          : 'Seus gastos voltaram a ser privados.',
      );
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setAlternando(false);
    }
  }

  async function gerarCodigo(): Promise<void> {
    setGerando(true);
    setErro(null);
    try {
      const convite = await api.household.criarConvite(7);
      setCodigo(convite.codigo);
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Família</h1>
        {grupo.data && <p className="text-base text-slate-600">{grupo.data.nome}</p>}
      </header>

      <CaixaDeErro mensagem={erro} />

      {/* Privacidade em primeiro lugar: é a pergunta que a pessoa faz ao entrar. */}
      <section data-tutorial="familia-privacidade" className="cartao p-5">
        <div className="flex items-start gap-4">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              compartilhando ? 'bg-menta-100 text-menta-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Icone nome={compartilhando ? 'pessoas' : 'cadeado'} tamanho={22} />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">
              {compartilhando ? 'Seus gastos aparecem para o grupo' : 'Seus gastos são privados'}
            </h2>
            <p className="mt-1 text-base text-slate-600">
              {compartilhando
                ? 'As pessoas do grupo veem o que você lança. Você pode desligar quando quiser.'
                : 'Ninguém do grupo vê o que você lança — nem quem administra.'}
            </p>
          </div>
        </div>

        <Botao
          variante={compartilhando ? 'secundario' : 'principal'}
          larguraTotal
          className="mt-4"
          carregando={alternando}
          onClick={() => void alternarCompartilhamento()}
        >
          {compartilhando ? 'Voltar a esconder meus gastos' : 'Compartilhar meus gastos'}
        </Botao>
      </section>

      {/* Código do grupo */}
      <section data-tutorial="familia-codigo" className="cartao space-y-3 p-5">
        <h2 className="text-base font-semibold text-slate-900">Convidar para o grupo</h2>

        {codigo ? (
          <div className="rounded-xl border-2 border-menta-200 bg-menta-50 p-4 text-center">
            <p className="text-sm text-slate-600">Código do grupo (vale por 7 dias)</p>
            <p className="my-2 text-3xl font-bold tracking-[0.2em] text-marca-800">{codigo}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Botao
                variante="secundario"
                onClick={() => {
                  void navigator.clipboard?.writeText(codigo);
                  aviso.mostrar('Código copiado.');
                }}
              >
                Copiar
              </Botao>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Entra no nosso grupo no Family Finance com o código ${codigo}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-toque items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-5 text-base font-semibold text-slate-800 hover:bg-slate-50"
              >
                Enviar no WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <>
            <p className="text-base text-slate-600">
              Gere um código e mande para quem você quer no grupo. Convidar não mostra seus gastos
              a ninguém.
            </p>
            <Botao larguraTotal icone="pessoas" carregando={gerando} onClick={() => void gerarCodigo()}>
              Gerar código do grupo
            </Botao>
          </>
        )}

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
          <Botao variante="secundario" onClick={() => setPainel('entrar-grupo')}>
            Entrar em outro grupo
          </Botao>
          <Botao variante="secundario" onClick={() => setPainel('novo-grupo')}>
            Criar novo grupo
          </Botao>
          {/* Sair não depende de quem modera — e não faz sentido sozinho. */}
          {grupoTemMaisGente && (
            <Botao variante="secundario" icone="sair" onClick={() => setConfirmandoSaida(true)}>
              Sair do grupo
            </Botao>
          )}
        </div>
      </section>

      {/* Quem está no grupo */}
      <section data-tutorial="familia-membros" className="cartao overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-base font-semibold text-slate-900">
          Quem está no grupo
        </h2>
        {membros.isPending ? (
          <Carregando />
        ) : (
          <ul className="divide-y divide-slate-100">
            {membros.data?.map((membro) => (
              <li key={membro.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar usuario={membro} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-slate-900">
                    {membro.nome}
                    {membro.id === usuario?.id && ' (você)'}
                  </span>
                  <span className="block truncate text-sm text-slate-600">
                    {membro.papel === 'ADMIN' ? 'Modera o grupo · ' : ''}
                    {membro.compartilhaGastos
                      ? 'Compartilha os gastos com o grupo'
                      : 'Gastos privados'}
                  </span>
                </span>
                {!membro.compartilhaGastos && (
                  <span className="shrink-0 text-slate-400" title="Gastos privados">
                    <Icone nome="cadeado" tamanho={20} />
                    <span className="sr-only">Gastos privados</span>
                  </span>
                )}
                {souModerador && membro.id !== usuario?.id && (
                  <button
                    type="button"
                    onClick={() => setMembroARemover(membro)}
                    aria-label={`Remover ${membro.nome} do grupo`}
                    className="flex h-toque w-toque shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Icone nome="sair" tamanho={20} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Metas conjuntas */}
      <section data-tutorial="familia-metas" className="cartao overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Metas do grupo</h2>
          <button
            type="button"
            onClick={() => setPainel('nova-meta')}
            className="min-h-toque px-2 text-base font-semibold text-marca-700 hover:underline"
          >
            Nova meta
          </button>
        </div>

        {metas.isPending ? (
          <Carregando />
        ) : (metas.data?.length ?? 0) === 0 ? (
          <p className="px-4 py-6 text-base text-slate-600">
            Nenhuma meta ainda. "Viagem de férias", "Reserva de emergência" — o grupo inteiro vê.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {metas.data?.map((meta) => (
              <li key={meta.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-menta-50 text-menta-700">
                  <Icone nome="alvo" tamanho={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-slate-900">
                    {meta.nome}
                  </span>
                  <span className="block truncate text-sm text-slate-600">
                    {meta.valorAlvoCentavos !== null
                      ? `${formatarBRL(meta.valorAlvoCentavos)} · criada por ${meta.criadoPor.nome}`
                      : `Criada por ${meta.criadoPor.nome}`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setMetaAExcluir(meta)}
                  aria-label={`Remover meta ${meta.nome}`}
                  className="flex h-toque w-toque shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Icone nome="lixeira" tamanho={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PainelNovoGrupo
        aberto={painel === 'novo-grupo'}
        aoFechar={() => setPainel(null)}
        aoConcluir={() => setPainel(null)}
      />
      <PainelEntrarNoGrupo
        aberto={painel === 'entrar-grupo'}
        aoFechar={() => setPainel(null)}
        aoConcluir={() => setPainel(null)}
      />
      <PainelNovaMeta
        aberto={painel === 'nova-meta'}
        aoFechar={() => setPainel(null)}
        aoConcluir={() => setPainel(null)}
      />

      <Confirmar
        aberto={membroARemover !== null}
        titulo={`Tirar ${membroARemover?.nome ?? ''} do grupo?`}
        descricao={`${membroARemover?.nome ?? 'A pessoa'} passa a ter um grupo só dela e leva os próprios lançamentos junto. Nada é apagado, e o que é seu continua com você.`}
        rotuloConfirmar="Tirar do grupo"
        aoCancelar={() => setMembroARemover(null)}
        aoConfirmar={() => void removerMembro()}
      />

      <Confirmar
        aberto={confirmandoSaida}
        titulo="Sair deste grupo?"
        descricao="Você passa a ter um grupo só seu, levando os seus lançamentos. O que é das outras pessoas fica com elas. Para voltar, é só usar um código do grupo."
        rotuloConfirmar="Sair do grupo"
        carregando={saindo}
        aoCancelar={() => setConfirmandoSaida(false)}
        aoConfirmar={() => void sairDoGrupo()}
      />

      <Confirmar
        aberto={metaAExcluir !== null}
        titulo={`Remover "${metaAExcluir?.nome ?? ''}"?`}
        descricao="A meta some para todo o grupo. Nenhum gasto é afetado."
        rotuloConfirmar="Remover"
        aoCancelar={() => setMetaAExcluir(null)}
        aoConfirmar={() => {
          const alvo = metaAExcluir;
          setMetaAExcluir(null);
          if (!alvo) return;
          void api.household
            .excluirMeta(alvo.id)
            .then(() => queryClient.invalidateQueries({ queryKey: ['metas'] }))
            .then(() => aviso.mostrar('Meta removida.'))
            .catch((falha: unknown) => setErro(traduzirErro(falha).mensagem));
        }}
      />
    </div>
  );
}

function Avatar({ usuario }: { usuario: Usuario }): ReactElement {
  // Iniciais em vez de foto: nada para enviar, nada para hospedar, e funciona
  // offline.
  const iniciais = usuario.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');

  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marca-100 text-base font-bold text-marca-800"
    >
      {iniciais || '?'}
    </span>
  );
}

function PainelNovoGrupo({
  aberto,
  aoFechar,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: () => void;
}): ReactElement {
  const { atualizarUsuario } = useSessao();
  const queryClient = useQueryClient();
  const aviso = useAviso();
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(): Promise<void> {
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await api.household.criarGrupo({ nome: nome.trim() });
      atualizarUsuario(atualizado);
      await queryClient.invalidateQueries();
      aviso.mostrar('Grupo criado. Seus lançamentos vieram junto.');
      setNome('');
      aoConcluir();
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Criar novo grupo">
      <div className="space-y-4">
        <CaixaDeErro mensagem={erro} />
        <p className="text-base text-slate-700">
          Você sai do grupo atual e começa um novo, como administrador. Seus lançamentos vão junto —
          o que é dos outros fica com eles.
        </p>
        <Campo
          rotulo="Nome do grupo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Casa da Ana, Família Silva..."
        />
        <Botao
          larguraTotal
          disabled={nome.trim().length < 2}
          carregando={salvando}
          onClick={() => void criar()}
        >
          Criar grupo
        </Botao>
      </div>
    </Dialogo>
  );
}

function PainelEntrarNoGrupo({
  aberto,
  aoFechar,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: () => void;
}): ReactElement {
  const { atualizarUsuario } = useSessao();
  const queryClient = useQueryClient();
  const aviso = useAviso();
  const [codigo, setCodigo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(): Promise<void> {
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await api.household.entrar(codigo.trim());
      atualizarUsuario(atualizado);
      await queryClient.invalidateQueries();
      aviso.mostrar('Você entrou no grupo.');
      setCodigo('');
      aoConcluir();
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Entrar em um grupo">
      <div className="space-y-4">
        <CaixaDeErro mensagem={erro} />
        <p className="text-base text-slate-700">
          Digite o código que você recebeu. Seus lançamentos vão com você, e continuam privados
          até você decidir compartilhar.
        </p>
        <Campo
          rotulo="Código do grupo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="FF-9A3K2"
          maxLength={8}
          className="uppercase tracking-widest"
        />
        <Botao
          larguraTotal
          disabled={codigo.trim().length < 5}
          carregando={salvando}
          onClick={() => void entrar()}
        >
          Entrar no grupo
        </Botao>
      </div>
    </Dialogo>
  );
}

function PainelNovaMeta({
  aberto,
  aoFechar,
  aoConcluir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: () => void;
}): ReactElement {
  const queryClient = useQueryClient();
  const aviso = useAviso();
  const [nome, setNome] = useState('');
  const [digitos, setDigitos] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const centavos = centavosDoTextoMascarado(digitos);

  async function criar(): Promise<void> {
    setSalvando(true);
    setErro(null);
    try {
      await api.household.criarMeta({
        nome: nome.trim(),
        ...(centavos > 0 ? { valorAlvoCentavos: centavos } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['metas'] });
      aviso.mostrar('Meta criada para o grupo.');
      setNome('');
      setDigitos('');
      aoConcluir();
    } catch (falha) {
      setErro(traduzirErro(falha).mensagem);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Nova meta do grupo">
      <div className="space-y-4">
        <CaixaDeErro mensagem={erro} />
        <p className="text-base text-slate-700">
          Metas aparecem para todo o grupo, mesmo para quem mantém os gastos privados.
        </p>
        <Campo
          rotulo="Qual é a meta"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Viagem de férias, reserva de emergência..."
        />
        <Campo
          rotulo="Valor (opcional)"
          inputMode="numeric"
          value={mascararMoeda(digitos)}
          onChange={(e) => setDigitos(e.target.value.replace(/\D/g, ''))}
          placeholder="R$ 0,00"
          dica="Pode deixar em branco se ainda não tem um número."
        />
        <Botao
          larguraTotal
          disabled={nome.trim().length < 2}
          carregando={salvando}
          onClick={() => void criar()}
        >
          Criar meta
        </Botao>
      </div>
    </Dialogo>
  );
}
