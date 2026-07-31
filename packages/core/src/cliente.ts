import { ErroApp, ehCorpoErro, type CodigoErro } from './erros.js';
import type {
  Cartao,
  Categoria,
  Convite,
  Gasto,
  GrupoDaPessoa,
  Household,
  ListaDeGastos,
  Meta,
  Papel,
  Evolucao,
  Recorrencia,
  ResumoMensal,
  Sessao,
  Usuario,
} from './tipos.js';
import type { AtualizarPerfilEntrada, LoginEntrada, RegistrarEntrada } from './schemas/auth.js';
import type { AtualizarCartaoEntrada, CriarCartaoEntrada } from './schemas/cartao.js';
import type {
  AtualizarCategoriaEntrada,
  CriarCategoriaEntrada,
} from './schemas/categoria.js';
import type { CriarGrupoEntrada, CriarMetaEntrada } from './schemas/household.js';
import type {
  AtualizarGastoEntrada,
  CriarGastoEntrada,
  ExportarGastosEntrada,
  ListarGastosEntrada,
} from './schemas/gasto.js';
import type {
  ConfirmarImportacaoEntrada,
  RemapearEntrada,
} from './schemas/importacao.js';
import type { PreviaImportacao } from './importacao.js';
import type {
  AtualizarRecorrenciaEntrada,
  CriarRecorrenciaEntrada,
} from './schemas/recorrencia.js';
import type { StatusImportacao } from './tipos.js';

/**
 * Cliente HTTP compartilhado entre web e mobile. Só usa `fetch`, sem nenhuma
 * dependência de plataforma, e devolve sempre `ErroApp` — a interface nunca
 * precisa olhar status HTTP nem tratar exceção de rede na mão.
 */

/** A sessão pode viver no localStorage (web) ou no AsyncStorage (mobile). */
export interface ArmazenamentoDeSessao {
  ler(): Sessao | null | Promise<Sessao | null>;
  gravar(sessao: Sessao | null): void | Promise<void>;
}

export interface OpcoesCliente {
  baseUrl: string;
  armazenamento: ArmazenamentoDeSessao;
  /** Chamado quando a sessão cai de vez (refresh recusado). */
  aoPerderSessao?: () => void;
}

type Parametros = Record<string, string | number | boolean | undefined | null>;

function montarUrl(baseUrl: string, caminho: string, parametros?: Parametros): string {
  const url = `${baseUrl.replace(/\/$/, '')}${caminho}`;
  if (!parametros) return url;

  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      busca.set(chave, String(valor));
    }
  }
  const texto = busca.toString();
  return texto ? `${url}?${texto}` : url;
}

async function lerErro(resposta: Response): Promise<ErroApp> {
  let corpo: unknown = null;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = null;
  }

  if (ehCorpoErro(corpo)) {
    return new ErroApp(corpo.erro.codigo as CodigoErro, corpo.erro.mensagem, corpo.erro.campos);
  }
  // Servidor fora do ar ou proxy no caminho: resposta que não é do nosso formato.
  return new ErroApp('INTERNO');
}

export interface Cliente {
  autenticado(): Promise<boolean>;
  sessao(): Promise<Sessao | null>;
  auth: {
    registrar(dados: RegistrarEntrada): Promise<Sessao>;
    login(dados: LoginEntrada): Promise<Sessao>;
    eu(): Promise<{ usuario: Usuario; household: Household }>;
    atualizarPerfil(dados: AtualizarPerfilEntrada): Promise<Usuario>;
    sair(): Promise<void>;
  };
  gastos: {
    listar(filtros?: Partial<ListarGastosEntrada>): Promise<ListaDeGastos>;
    obter(id: string): Promise<Gasto>;
    criar(dados: CriarGastoEntrada): Promise<Gasto>;
    atualizar(id: string, dados: AtualizarGastoEntrada): Promise<Gasto>;
    excluir(id: string): Promise<void>;
    sugestoes(termo: string): Promise<string[]>;
    /** Arquivo pronto para download; quem chama decide o que fazer com ele. */
    exportar(filtros?: Partial<ExportarGastosEntrada>): Promise<Blob>;
    /** Anexa a foto ou o PDF do comprovante. */
    enviarComprovante(id: string, arquivo: Blob, nomeArquivo: string): Promise<Gasto>;
    baixarComprovante(id: string): Promise<Blob>;
    removerComprovante(id: string): Promise<void>;
    /** Endereço direto do comprovante, para usar em <img> ou no mobile. */
    urlDoComprovante(id: string): string;
  };
  recorrencias: {
    listar(): Promise<Array<Recorrencia & { proximoEm: string | null }>>;
    criar(dados: CriarRecorrenciaEntrada): Promise<Recorrencia>;
    atualizar(id: string, dados: AtualizarRecorrenciaEntrada): Promise<Recorrencia>;
    excluir(id: string): Promise<{ gastosMantidos: number }>;
    /** Cria os lançamentos dos meses pendentes. Repetir não duplica nada. */
    gerar(): Promise<{ gastosCriados: number; recorrenciasProcessadas: number }>;
  };
  importacoes: {
    analisar(arquivo: File | Blob, nomeArquivo: string): Promise<PreviaImportacao>;
    mapear(id: string, dados: RemapearEntrada): Promise<PreviaImportacao>;
    confirmar(
      id: string,
      dados: ConfirmarImportacaoEntrada,
    ): Promise<{ importacaoId: string; linhasImportadas: number; totalCentavos: number }>;
    cancelar(id: string): Promise<void>;
    historico(): Promise<
      Array<{
        id: string;
        nomeArquivo: string;
        status: StatusImportacao;
        totalLinhas: number;
        linhasImportadas: number;
        criadoEm: string;
      }>
    >;
  };
  categorias: {
    listar(): Promise<Categoria[]>;
    criar(dados: CriarCategoriaEntrada): Promise<Categoria>;
    atualizar(id: string, dados: AtualizarCategoriaEntrada): Promise<Categoria>;
    excluir(id: string): Promise<{ gastosSemCategoria: number }>;
  };
  cartoes: {
    listar(): Promise<Cartao[]>;
    criar(dados: CriarCartaoEntrada): Promise<Cartao>;
    atualizar(id: string, dados: AtualizarCartaoEntrada): Promise<Cartao>;
    /** Apagar o cartão não apaga gasto: os lançamentos ficam sem cartão. */
    excluir(id: string): Promise<{ gastosSemCartao: number }>;
  };
  household: {
    obter(): Promise<Household>;
    renomear(nome: string): Promise<Household>;
    membros(): Promise<Usuario[]>;
    trocarPapel(id: string, papel: Papel): Promise<Usuario>;
    /** Tira alguém do grupo (só quem modera). A pessoa vai para um grupo só dela. */
    removerMembro(id: string): Promise<{ removido: string }>;
    /** Sai do grupo por conta própria, levando os próprios lançamentos. */
    sair(): Promise<Usuario>;
    criarConvite(validadeDias?: number): Promise<Convite>;
    entrar(codigo: string): Promise<Usuario>;
    /** Cria mais um grupo e passa a usá-lo, sem deixar os que já existem. */
    criarGrupo(dados: CriarGrupoEntrada): Promise<Usuario>;
    /** Todos os grupos da pessoa, com códigos dos que ela administra. */
    grupos(): Promise<GrupoDaPessoa[]>;
    /** Troca o grupo em uso. */
    ativarGrupo(id: string): Promise<Usuario>;
    /** Apaga o grupo e tudo que foi lançado nele. Devolve o grupo que ficou ativo. */
    excluirGrupo(id: string): Promise<Usuario>;
    metas(): Promise<Meta[]>;
    criarMeta(dados: CriarMetaEntrada): Promise<Meta>;
    excluirMeta(id: string): Promise<void>;
  };
  resumos: {
    mensal(ano: number, mes: number): Promise<ResumoMensal>;
    evolucao(meses?: number): Promise<Evolucao>;
  };
}

export function criarCliente({ baseUrl, armazenamento, aoPerderSessao }: OpcoesCliente): Cliente {
  // Um refresh por vez: se três telas receberem 401 juntas, todas esperam a
  // mesma renovação em vez de disparar três.
  let renovacaoEmAndamento: Promise<Sessao | null> | null = null;

  async function renovar(): Promise<Sessao | null> {
    renovacaoEmAndamento ??= (async () => {
      const atual = await armazenamento.ler();
      if (!atual?.refreshToken) return null;

      try {
        const resposta = await fetch(montarUrl(baseUrl, '/api/v1/auth/refresh'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: atual.refreshToken }),
        });
        if (!resposta.ok) return null;
        const nova = (await resposta.json()) as Sessao;
        await armazenamento.gravar(nova);
        return nova;
      } catch {
        return null;
      } finally {
        // Libera para a próxima tentativa, mesmo em caso de falha.
        setTimeout(() => {
          renovacaoEmAndamento = null;
        }, 0);
      }
    })();

    return renovacaoEmAndamento;
  }

  async function requisitar<T>(
    metodo: string,
    caminho: string,
    opcoes: {
      corpo?: unknown;
      /** FormData e afins: o navegador monta o cabeçalho, não nós. */
      corpoBruto?: BodyInit;
      parametros?: Parametros;
      publica?: boolean;
      tentouRenovar?: boolean;
      binaria?: boolean;
    } = {},
  ): Promise<T> {
    const sessao = opcoes.publica ? null : await armazenamento.ler();

    const cabecalhos: Record<string, string> = {};
    if (!opcoes.binaria) cabecalhos.accept = 'application/json';
    if (opcoes.corpo !== undefined) cabecalhos['content-type'] = 'application/json';
    if (sessao?.accessToken) cabecalhos.authorization = `Bearer ${sessao.accessToken}`;

    let resposta: Response;
    try {
      resposta = await fetch(montarUrl(baseUrl, caminho, opcoes.parametros), {
        method: metodo,
        headers: cabecalhos,
        ...(opcoes.corpoBruto !== undefined
          ? { body: opcoes.corpoBruto }
          : opcoes.corpo !== undefined
            ? { body: JSON.stringify(opcoes.corpo) }
            : {}),
      });
    } catch {
      throw new ErroApp(
        'INTERNO',
        'Não conseguimos falar com o aplicativo. Verifique sua internet e tente de novo.',
      );
    }

    // Token de acesso vencido: renova uma vez e repete a mesma chamada.
    if (resposta.status === 401 && !opcoes.publica && !opcoes.tentouRenovar) {
      const nova = await renovar();
      if (nova) {
        return requisitar<T>(metodo, caminho, { ...opcoes, tentouRenovar: true });
      }
      await armazenamento.gravar(null);
      aoPerderSessao?.();
    }

    if (!resposta.ok) throw await lerErro(resposta);
    if (resposta.status === 204) return undefined as T;
    if (opcoes.binaria) return (await resposta.blob()) as T;
    return (await resposta.json()) as T;
  }

  async function guardarSessao(sessao: Sessao): Promise<Sessao> {
    await armazenamento.gravar(sessao);
    return sessao;
  }

  return {
    async autenticado() {
      return Boolean((await armazenamento.ler())?.accessToken);
    },
    async sessao() {
      return armazenamento.ler();
    },

    auth: {
      async registrar(dados) {
        const sessao = await requisitar<Sessao>('POST', '/api/v1/auth/registrar', {
          corpo: dados,
          publica: true,
        });
        return guardarSessao(sessao);
      },
      async login(dados) {
        const sessao = await requisitar<Sessao>('POST', '/api/v1/auth/login', {
          corpo: dados,
          publica: true,
        });
        return guardarSessao(sessao);
      },
      eu: () => requisitar('GET', '/api/v1/auth/eu'),
      atualizarPerfil: (dados) => requisitar('PATCH', '/api/v1/auth/eu', { corpo: dados }),
      async sair() {
        await armazenamento.gravar(null);
      },
    },

    gastos: {
      listar: (filtros = {}) =>
        requisitar('GET', '/api/v1/gastos', { parametros: filtros as Parametros }),
      obter: (id) => requisitar('GET', `/api/v1/gastos/${id}`),
      criar: (dados) => requisitar('POST', '/api/v1/gastos', { corpo: dados }),
      atualizar: (id, dados) => requisitar('PATCH', `/api/v1/gastos/${id}`, { corpo: dados }),
      excluir: (id) => requisitar('DELETE', `/api/v1/gastos/${id}`),
      async sugestoes(termo) {
        const { descricoes } = await requisitar<{ descricoes: string[] }>(
          'GET',
          '/api/v1/gastos/sugestoes',
          { parametros: { termo } },
        );
        return descricoes;
      },
      exportar: (filtros = {}) =>
        requisitar<Blob>('GET', '/api/v1/gastos/exportar', {
          parametros: filtros as Parametros,
          binaria: true,
        }),
      enviarComprovante(id, arquivo, nomeArquivo) {
        const formulario = new FormData();
        formulario.append('arquivo', arquivo, nomeArquivo);
        return requisitar('PUT', `/api/v1/gastos/${id}/comprovante`, { corpoBruto: formulario });
      },
      baixarComprovante: (id) =>
        requisitar<Blob>('GET', `/api/v1/gastos/${id}/comprovante`, { binaria: true }),
      removerComprovante: (id) => requisitar('DELETE', `/api/v1/gastos/${id}/comprovante`),
      urlDoComprovante: (id) => `${baseUrl.replace(/\/$/, '')}/api/v1/gastos/${id}/comprovante`,
    },

    recorrencias: {
      async listar() {
        const { itens } = await requisitar<{
          itens: Array<Recorrencia & { proximoEm: string | null }>;
        }>('GET', '/api/v1/recorrencias');
        return itens;
      },
      criar: (dados) => requisitar('POST', '/api/v1/recorrencias', { corpo: dados }),
      atualizar: (id, dados) => requisitar('PATCH', `/api/v1/recorrencias/${id}`, { corpo: dados }),
      excluir: (id) => requisitar('DELETE', `/api/v1/recorrencias/${id}`),
      gerar: () => requisitar('POST', '/api/v1/recorrencias/gerar'),
    },

    importacoes: {
      analisar(arquivo, nomeArquivo) {
        const formulario = new FormData();
        formulario.append('arquivo', arquivo, nomeArquivo);
        return requisitar('POST', '/api/v1/importacoes/analisar', { corpoBruto: formulario });
      },
      mapear: (id, dados) =>
        requisitar('POST', `/api/v1/importacoes/${id}/mapear`, { corpo: dados }),
      confirmar: (id, dados) =>
        requisitar('POST', `/api/v1/importacoes/${id}/confirmar`, { corpo: dados }),
      cancelar: (id) => requisitar('DELETE', `/api/v1/importacoes/${id}`),
      async historico() {
        const { itens } = await requisitar<{
          itens: Array<{
            id: string;
            nomeArquivo: string;
            status: StatusImportacao;
            totalLinhas: number;
            linhasImportadas: number;
            criadoEm: string;
          }>;
        }>('GET', '/api/v1/importacoes');
        return itens;
      },
    },

    categorias: {
      async listar() {
        const { itens } = await requisitar<{ itens: Categoria[] }>('GET', '/api/v1/categorias');
        return itens;
      },
      criar: (dados) => requisitar('POST', '/api/v1/categorias', { corpo: dados }),
      atualizar: (id, dados) => requisitar('PATCH', `/api/v1/categorias/${id}`, { corpo: dados }),
      excluir: (id) => requisitar('DELETE', `/api/v1/categorias/${id}`),
    },

    cartoes: {
      async listar() {
        const { itens } = await requisitar<{ itens: Cartao[] }>('GET', '/api/v1/cartoes');
        return itens;
      },
      criar: (dados) => requisitar('POST', '/api/v1/cartoes', { corpo: dados }),
      atualizar: (id, dados) => requisitar('PATCH', `/api/v1/cartoes/${id}`, { corpo: dados }),
      excluir: (id) => requisitar('DELETE', `/api/v1/cartoes/${id}`),
    },

    household: {
      obter: () => requisitar('GET', '/api/v1/household'),
      renomear: (nome) => requisitar('PATCH', '/api/v1/household', { corpo: { nome } }),
      async membros() {
        const { itens } = await requisitar<{ itens: Usuario[] }>(
          'GET',
          '/api/v1/household/membros',
        );
        return itens;
      },
      trocarPapel: (id, papel) =>
        requisitar('PATCH', `/api/v1/household/membros/${id}`, { corpo: { papel } }),
      removerMembro: (id) => requisitar('DELETE', `/api/v1/household/membros/${id}`),
      sair: () => requisitar('POST', '/api/v1/household/sair'),
      criarConvite: (validadeDias = 7) =>
        requisitar('POST', '/api/v1/household/convites', { corpo: { validadeDias } }),
      entrar: (codigo) => requisitar('POST', '/api/v1/household/entrar', { corpo: { codigo } }),
      criarGrupo: (dados) => requisitar('POST', '/api/v1/household/nova', { corpo: dados }),
      async grupos() {
        const { itens } = await requisitar<{ itens: GrupoDaPessoa[] }>(
          'GET',
          '/api/v1/household/grupos',
        );
        return itens;
      },
      ativarGrupo: (id) => requisitar('POST', `/api/v1/household/grupos/${id}/ativar`),
      excluirGrupo: (id) => requisitar('DELETE', `/api/v1/household/grupos/${id}`),
      async metas() {
        const { itens } = await requisitar<{ itens: Meta[] }>('GET', '/api/v1/household/metas');
        return itens;
      },
      criarMeta: (dados) => requisitar('POST', '/api/v1/household/metas', { corpo: dados }),
      excluirMeta: (id) => requisitar('DELETE', `/api/v1/household/metas/${id}`),
    },

    resumos: {
      mensal: (ano, mes) =>
        requisitar('GET', '/api/v1/resumos/mensal', { parametros: { ano, mes } }),
      evolucao: (meses = 6) =>
        requisitar('GET', '/api/v1/resumos/evolucao', { parametros: { meses } }),
    },
  };
}
