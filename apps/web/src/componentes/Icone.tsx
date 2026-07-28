import type { JSX } from 'react';

/**
 * Ícones em SVG inline: nenhuma biblioteca externa, nenhum download extra e
 * funcionam offline. Os nomes de categoria (`carrinho`, `garfo`, ...) são os
 * mesmos gravados no banco, definidos em `CATEGORIAS_PADRAO`.
 */

const DESENHOS: Record<string, JSX.Element> = {
  // --- categorias ---
  carrinho: (
    <>
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="18" cy="20" r="1.6" />
      <path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21.5 7H6" />
    </>
  ),
  garfo: (
    <>
      <path d="M5 3v6a2.5 2.5 0 0 0 5 0V3" />
      <path d="M7.5 11v10" />
      <path d="M17 3c-1.6 1.2-2.5 3-2.5 5.5 0 2 .9 3.4 2.5 4V21" />
    </>
  ),
  carro: (
    <>
      <path d="M4 13l1.8-4.8A2 2 0 0 1 7.7 7h8.6a2 2 0 0 1 1.9 1.2L20 13" />
      <path d="M3 13h18v4h-2M5 17H3v-4" />
      <path d="M9 17h6" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  coracao: <path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7c0 4.9-7 9.3-7 9.3z" />,
  casa: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  sorriso: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14c1 1.4 2.4 2 4 2s3-.6 4-2" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </>
  ),
  livro: (
    <>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 20.5z" />
    </>
  ),
  camisa: (
    <>
      <path d="M9 3l3 2 3-2 5 3-2 3-1.5-1V21h-9V8L6 9 4 6z" />
    </>
  ),
  etiqueta: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
  pata: (
    <>
      <circle cx="7" cy="8" r="2" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="17" cy="8" r="2" />
      <path d="M12 11c-3 0-5 2.2-5 4.6C7 18 8.7 19 12 19s5-1 5-3.4C17 13.2 15 11 12 11z" />
    </>
  ),

  // --- navegação e ações ---
  inicio: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  lista: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
  grafico: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M15 3.6A9 9 0 0 1 20.4 9H15z" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15H3.3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.8h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.4 1z" />
    </>
  ),
  mais: <path d="M12 5v14M5 12h14" />,
  lupa: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  filtro: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  lixeira: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  lapis: (
    <>
      <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="M14.5 5.5l4 4" />
    </>
  ),
  esquerda: <path d="M15 5l-7 7 7 7" />,
  direita: <path d="M9 5l7 7-7 7" />,
  cima: <path d="M5 15l7-7 7 7" />,
  baixo: <path d="M5 9l7 7 7-7" />,
  fechar: <path d="M6 6l12 12M18 6L6 18" />,
  confirmado: <path d="M4 12.5l5.5 5.5L20 7" />,
  pessoa: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 21c0-3.6 3.1-5.8 7-5.8s7 2.2 7 5.8" />
      <path d="M16.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6c2.4.7 4 2.4 4 5.4" />
    </>
  ),
  sair: (
    <>
      <path d="M10 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
      <path d="M16 16l4-4-4-4M20 12H10" />
    </>
  ),
  baixar: (
    <>
      <path d="M12 3v12" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4 19h16" />
    </>
  ),
  aviso: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  planilha: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11M15 9v11" />
    </>
  ),
};

export type NomeDeIcone = keyof typeof DESENHOS;

interface Props {
  nome: string;
  /** Tamanho em pixels. Padrão 24. */
  tamanho?: number;
  className?: string;
  /** Preenchido em vez de contornado (usado no item ativo da navegação). */
  preenchido?: boolean;
}

export function Icone({ nome, tamanho = 24, className, preenchido = false }: Props): JSX.Element {
  const desenho = DESENHOS[nome] ?? DESENHOS.etiqueta;

  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill={preenchido ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={preenchido ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {desenho}
    </svg>
  );
}
