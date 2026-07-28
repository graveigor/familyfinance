import type { Sessao, Usuario } from '@gastos/core';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { aoMudarSessao, api, lerSessaoGuardada } from './api';

interface ContextoSessao {
  usuario: Usuario | null;
  autenticado: boolean;
  /** Enquanto lemos a sessão do disco, não dá para decidir a tela inicial. */
  carregando: boolean;
  entrar(email: string, senha: string): Promise<void>;
  registrar(dados: {
    nome: string;
    email: string;
    senha: string;
    codigoConvite?: string;
  }): Promise<void>;
  sair(): Promise<void>;
  atualizarUsuario(usuario: Usuario): void;
}

const Contexto = createContext<ContextoSessao | null>(null);

export function ProvedorDeSessao({ children }: { children: ReactNode }): ReactElement {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let ativo = true;
    void lerSessaoGuardada().then((guardada) => {
      if (!ativo) return;
      setSessao(guardada);
      setCarregando(false);
    });

    // O cliente HTTP avisa quando a sessão cai por conta própria.
    const cancelar = aoMudarSessao(() => {
      void lerSessaoGuardada().then((atual) => {
        if (ativo) setSessao(atual);
      });
    });

    return () => {
      ativo = false;
      cancelar();
    };
  }, []);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const nova = await api.auth.login({ email, senha });
      setSessao(nova);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const registrar = useCallback<ContextoSessao['registrar']>(
    async (dados) => {
      const nova = await api.auth.registrar(dados);
      setSessao(nova);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const sair = useCallback(async () => {
    await api.auth.sair();
    setSessao(null);
    queryClient.clear();
  }, [queryClient]);

  const atualizarUsuario = useCallback((usuario: Usuario) => {
    setSessao((atual) => (atual ? { ...atual, usuario } : atual));
  }, []);

  const valor = useMemo<ContextoSessao>(
    () => ({
      usuario: sessao?.usuario ?? null,
      autenticado: Boolean(sessao?.accessToken),
      carregando,
      entrar,
      registrar,
      sair,
      atualizarUsuario,
    }),
    [sessao, carregando, entrar, registrar, sair, atualizarUsuario],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): ContextoSessao {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSessao precisa estar dentro de ProvedorDeSessao');
  return contexto;
}
