import NetInfo from '@react-native-community/netinfo';
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
import { aoMudarFila, lerFila, sincronizar } from './fila';

interface ContextoConexao {
  online: boolean;
  /** Quantos gastos estão esperando internet. */
  aguardando: number;
  sincronizarAgora(): Promise<void>;
}

const Contexto = createContext<ContextoConexao | null>(null);

/**
 * Observa a conexão e esvazia a fila assim que a internet volta. É o que faz o
 * lançamento offline valer: a pessoa registra o gasto no mercado sem sinal e
 * ele sobe sozinho quando o celular reconecta.
 */
export function ProvedorDeConexao({ children }: { children: ReactNode }): ReactElement {
  const [online, setOnline] = useState(true);
  const [aguardando, setAguardando] = useState(0);
  const queryClient = useQueryClient();

  const esvaziar = useCallback(async () => {
    const resultado = await sincronizar();
    setAguardando(resultado.restantes);
    if (resultado.enviados > 0) {
      await queryClient.invalidateQueries({ queryKey: ['gastos'] });
      await queryClient.invalidateQueries({ queryKey: ['resumos'] });
    }
  }, [queryClient]);

  useEffect(() => {
    void lerFila().then((fila) => setAguardando(fila.length));
    const pararDeOuvir = aoMudarFila((fila) => setAguardando(fila.length));

    const cancelar = NetInfo.addEventListener((estado) => {
      // `isInternetReachable` é null enquanto o sistema ainda não decidiu;
      // nesse caso confiamos em `isConnected` para não travar o app.
      const conectado = Boolean(estado.isConnected) && estado.isInternetReachable !== false;
      setOnline(conectado);
      if (conectado) void esvaziar();
    });

    return () => {
      pararDeOuvir();
      cancelar();
    };
  }, [esvaziar]);

  const valor = useMemo<ContextoConexao>(
    () => ({ online, aguardando, sincronizarAgora: esvaziar }),
    [online, aguardando, esvaziar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useConexao(): ContextoConexao {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useConexao precisa estar dentro de ProvedorDeConexao');
  return contexto;
}
