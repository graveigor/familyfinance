import { ErroApp } from '@gastos/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ProvedorDeTutorial } from './componentes/Tutorial';
import { ProvedorDeAviso } from './componentes/ui';
import { ProvedorDeSessao } from './sessao';
import './estilos.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      // Sessão expirada não se resolve tentando de novo; erro de rede, sim.
      retry: (tentativas, erro) => {
        if (erro instanceof ErroApp && erro.codigo !== 'INTERNO') return false;
        return tentativas < 2;
      },
      refetchOnWindowFocus: true,
    },
  },
});

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado no index.html');

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ProvedorDeSessao>
        <ProvedorDeAviso>
          <BrowserRouter>
            <ProvedorDeTutorial>
              <App />
            </ProvedorDeTutorial>
          </BrowserRouter>
        </ProvedorDeAviso>
      </ProvedorDeSessao>
    </QueryClientProvider>
  </StrictMode>,
);

// Service worker: o que torna o app instalável e capaz de abrir offline.
// Em desenvolvimento fica fora do caminho, para não servir arquivo antigo.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void (async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Entrega ao worker a lista do que esta página carregou (JS, CSS, ícones)
      // para que a primeira visita já fique utilizável offline.
      const urls = performance
        .getEntriesByType('resource')
        .filter((entrada): entrada is PerformanceResourceTiming => 'initiatorType' in entrada)
        .filter(
          (entrada) =>
            entrada.name.startsWith(window.location.origin) &&
            ['script', 'link', 'css', 'img'].includes(entrada.initiatorType),
        )
        .map((entrada) => entrada.name);

      const avisar = (): void =>
        navigator.serviceWorker.controller?.postMessage({ tipo: 'aquecer', urls });

      if (navigator.serviceWorker.controller) avisar();
      else navigator.serviceWorker.addEventListener('controllerchange', avisar, { once: true });
    })();
  });
}
