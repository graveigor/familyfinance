import { useEffect, useState, type ReactElement } from 'react';
import { Icone } from './Icone';
import { Botao } from './ui';

/**
 * Instalação do app na tela inicial / área de trabalho.
 *
 * Chrome, Edge e Android disparam `beforeinstallprompt` e dá para instalar com
 * um toque. O Safari do iPhone não tem esse evento: lá o caminho é
 * Compartilhar > Adicionar à Tela de Início, então mostramos as instruções.
 */

interface EventoDeInstalacao extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function ehIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function jaInstalado(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari usa uma propriedade própria fora do padrão.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstalacao(): {
  podeInstalar: boolean;
  instalado: boolean;
  precisaDeInstrucoes: boolean;
  instalar: () => Promise<void>;
} {
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);
  const [instalado, setInstalado] = useState(jaInstalado);

  useEffect(() => {
    const aoPoderInstalar = (e: Event): void => {
      e.preventDefault(); // Guardamos para disparar no clique do usuário.
      setEvento(e as EventoDeInstalacao);
    };
    const aoInstalar = (): void => {
      setInstalado(true);
      setEvento(null);
    };

    window.addEventListener('beforeinstallprompt', aoPoderInstalar);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoPoderInstalar);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  return {
    podeInstalar: Boolean(evento) && !instalado,
    instalado,
    precisaDeInstrucoes: !instalado && !evento && ehIOS(),
    instalar: async () => {
      if (!evento) return;
      await evento.prompt();
      const { outcome } = await evento.userChoice;
      if (outcome === 'accepted') setInstalado(true);
      setEvento(null);
    },
  };
}

export function CartaoInstalar(): ReactElement | null {
  const { podeInstalar, instalado, precisaDeInstrucoes, instalar } = useInstalacao();

  if (instalado) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-marca-50 p-4 text-base text-marca-800">
        <Icone nome="confirmado" tamanho={22} />
        <p>O app já está instalado neste aparelho.</p>
      </div>
    );
  }

  if (podeInstalar) {
    return (
      <div className="space-y-3">
        <p className="text-base text-slate-700">
          Instale o app para abrir direto da tela inicial, sem a barra do navegador.
        </p>
        <Botao icone="baixar" onClick={() => void instalar()}>
          Instalar o app
        </Botao>
      </div>
    );
  }

  if (precisaDeInstrucoes) {
    return (
      <div className="space-y-2 text-base text-slate-700">
        <p>Para instalar no iPhone ou iPad:</p>
        <ol className="ml-5 list-decimal space-y-1">
          <li>
            Toque no botão <strong>Compartilhar</strong> do Safari (o quadrado com a seta para
            cima).
          </li>
          <li>
            Escolha <strong>Adicionar à Tela de Início</strong>.
          </li>
          <li>
            Toque em <strong>Adicionar</strong>.
          </li>
        </ol>
      </div>
    );
  }

  return (
    <p className="text-base text-slate-700">
      Para instalar, abra o app no Chrome, no Edge ou no Safari do iPhone e procure a opção de
      instalar ou adicionar à tela de início.
    </p>
  );
}

/** Faixa discreta na tela inicial, que some depois de dispensada. */
export function FaixaInstalar(): ReactElement | null {
  const { podeInstalar, instalar } = useInstalacao();
  const [dispensada, setDispensada] = useState(
    () => localStorage.getItem('gastos.instalar-dispensado') === 'sim',
  );

  if (!podeInstalar || dispensada) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-marca-200 bg-marca-50 p-4">
      <span className="shrink-0 text-marca-700">
        <Icone nome="baixar" tamanho={24} />
      </span>
      <p className="flex-1 text-base text-marca-900">
        Instale o app na tela inicial para abrir mais rápido.
      </p>
      <button
        type="button"
        onClick={() => void instalar()}
        className="min-h-toque rounded-xl bg-marca-600 px-4 text-base font-semibold text-white hover:bg-marca-700"
      >
        Instalar
      </button>
      <button
        type="button"
        aria-label="Agora não"
        onClick={() => {
          localStorage.setItem('gastos.instalar-dispensado', 'sim');
          setDispensada(true);
        }}
        className="flex h-toque w-toque items-center justify-center rounded-full text-marca-800 hover:bg-marca-100"
      >
        <Icone nome="fechar" tamanho={20} />
      </button>
    </div>
  );
}
