import type { Sessao, Usuario } from '@gastos/core';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, lerSessaoLocal } from './api';

interface ContextoSessao {
  usuario: Usuario | null;
  autenticado: boolean;
  entrar(email: string, senha: string): Promise<void>;
  registrar(dados: {
    nome: string;
    email: string;
    senha: string;
    nomeHousehold?: string;
    codigoConvite?: string;
  }): Promise<void>;
  sair(): Promise<void>;
  atualizarUsuario(usuario: Usuario): void;
}

const Contexto = createContext<ContextoSessao | null>(null);

export function ProvedorDeSessao({ children }: { children: ReactNode }): JSX.Element {
  const [sessao, setSessao] = useState<Sessao | null>(() => lerSessaoLocal());
  const queryClient = useQueryClient();

  // O cliente HTTP dispara este evento quando a sessão cai (refresh recusado)
  // ou quando outra aba faz login/logout.
  useEffect(() => {
    const aoMudar = (): void => setSessao(lerSessaoLocal());
    window.addEventListener('sessao-alterada', aoMudar);
    window.addEventListener('storage', aoMudar);
    return () => {
      window.removeEventListener('sessao-alterada', aoMudar);
      window.removeEventListener('storage', aoMudar);
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
      entrar,
      registrar,
      sair,
      atualizarUsuario,
    }),
    [sessao, entrar, registrar, sair, atualizarUsuario],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): ContextoSessao {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSessao precisa estar dentro de ProvedorDeSessao');
  return contexto;
}
