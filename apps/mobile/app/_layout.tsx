import { ErroApp } from '@gastos/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProvedorDeConexao } from '../src/conexao';
import { ProvedorDeSessao } from '../src/sessao';
import { cores } from '../src/tema';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      // Sessão expirada não melhora repetindo; falha de rede, sim.
      retry: (tentativas, erro) => {
        if (erro instanceof ErroApp && erro.codigo !== 'INTERNO') return false;
        return tentativas < 2;
      },
    },
  },
});

export default function Raiz(): ReactElement {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ProvedorDeSessao>
          <ProvedorDeConexao>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: cores.fundo },
            }}
          >
            <Stack.Screen name="(abas)" />
            <Stack.Screen name="entrar" />
            {/* Lançar gasto sobe como folha, do jeito que o sistema faz. */}
            <Stack.Screen name="gasto" options={{ presentation: 'modal' }} />
          </Stack>
          </ProvedorDeConexao>
        </ProvedorDeSessao>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
