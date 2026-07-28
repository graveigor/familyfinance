import type { ReactElement, ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Os mesmos ícones da web, redesenhados com `react-native-svg`. Os nomes das
 * categorias (`carrinho`, `garfo`, ...) são os que vêm do banco.
 */
const DESENHOS: Record<string, (cor: ColorValue) => ReactNode> = {
  carrinho: (c) => (
    <>
      <Circle cx="9" cy="20" r="1.6" stroke={c} />
      <Circle cx="18" cy="20" r="1.6" stroke={c} />
      <Path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21.5 7H6" stroke={c} />
    </>
  ),
  garfo: (c) => (
    <>
      <Path d="M5 3v6a2.5 2.5 0 0 0 5 0V3" stroke={c} />
      <Path d="M7.5 11v10" stroke={c} />
      <Path d="M17 3c-1.6 1.2-2.5 3-2.5 5.5 0 2 .9 3.4 2.5 4V21" stroke={c} />
    </>
  ),
  carro: (c) => (
    <>
      <Path d="M4 13l1.8-4.8A2 2 0 0 1 7.7 7h8.6a2 2 0 0 1 1.9 1.2L20 13" stroke={c} />
      <Path d="M3 13h18v4h-2M5 17H3v-4" stroke={c} />
      <Path d="M9 17h6" stroke={c} />
      <Circle cx="7" cy="17.5" r="1.8" stroke={c} />
      <Circle cx="17" cy="17.5" r="1.8" stroke={c} />
    </>
  ),
  coracao: (c) => (
    <Path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7c0 4.9-7 9.3-7 9.3z" stroke={c} />
  ),
  casa: (c) => (
    <>
      <Path d="M3 11l9-7 9 7" stroke={c} />
      <Path d="M5 10v10h14V10" stroke={c} />
      <Path d="M10 20v-6h4v6" stroke={c} />
    </>
  ),
  sorriso: (c) => (
    <>
      <Circle cx="12" cy="12" r="9" stroke={c} />
      <Path d="M8 14c1 1.4 2.4 2 4 2s3-.6 4-2" stroke={c} />
      <Path d="M9 9.5h.01M15 9.5h.01" stroke={c} />
    </>
  ),
  livro: (c) => (
    <>
      <Path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z" stroke={c} />
      <Path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 20.5z" stroke={c} />
    </>
  ),
  camisa: (c) => <Path d="M9 3l3 2 3-2 5 3-2 3-1.5-1V21h-9V8L6 9 4 6z" stroke={c} />,
  etiqueta: (c) => (
    <>
      <Path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" stroke={c} />
      <Circle cx="7.5" cy="7.5" r="1.3" stroke={c} />
    </>
  ),
  pata: (c) => (
    <>
      <Circle cx="7" cy="8" r="2" stroke={c} />
      <Circle cx="12" cy="6" r="2" stroke={c} />
      <Circle cx="17" cy="8" r="2" stroke={c} />
      <Path d="M12 11c-3 0-5 2.2-5 4.6C7 18 8.7 19 12 19s5-1 5-3.4C17 13.2 15 11 12 11z" stroke={c} />
    </>
  ),

  inicio: (c) => (
    <>
      <Path d="M3 11l9-7 9 7" stroke={c} />
      <Path d="M5 10v10h14V10" stroke={c} />
    </>
  ),
  lista: (c) => (
    <>
      <Path d="M8 6h13M8 12h13M8 18h13" stroke={c} />
      <Path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke={c} />
    </>
  ),
  grafico: (c) => (
    <>
      <Path d="M12 3a9 9 0 1 0 9 9h-9z" stroke={c} />
      <Path d="M15 3.6A9 9 0 0 1 20.4 9H15z" stroke={c} />
    </>
  ),
  ajustes: (c) => (
    <>
      <Circle cx="12" cy="12" r="3" stroke={c} />
      <Circle cx="12" cy="12" r="8.5" stroke={c} />
      <Path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" stroke={c} />
    </>
  ),
  mais: (c) => <Path d="M12 5v14M5 12h14" stroke={c} />,
  lupa: (c) => (
    <>
      <Circle cx="11" cy="11" r="7" stroke={c} />
      <Path d="M20 20l-3.5-3.5" stroke={c} />
    </>
  ),
  filtro: (c) => <Path d="M3 5h18l-7 8v6l-4 2v-8z" stroke={c} />,
  calendario: (c) => (
    <>
      <Path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" stroke={c} />
      <Path d="M3 10h18M8 3v4M16 3v4" stroke={c} />
    </>
  ),
  lixeira: (c) => (
    <>
      <Path d="M4 7h16" stroke={c} />
      <Path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke={c} />
      <Path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke={c} />
      <Path d="M10 11v6M14 11v6" stroke={c} />
    </>
  ),
  lapis: (c) => (
    <>
      <Path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z" stroke={c} />
      <Path d="M14.5 5.5l4 4" stroke={c} />
    </>
  ),
  esquerda: (c) => <Path d="M15 5l-7 7 7 7" stroke={c} />,
  direita: (c) => <Path d="M9 5l7 7-7 7" stroke={c} />,
  cima: (c) => <Path d="M5 15l7-7 7 7" stroke={c} />,
  baixo: (c) => <Path d="M5 9l7 7 7-7" stroke={c} />,
  fechar: (c) => <Path d="M6 6l12 12M18 6L6 18" stroke={c} />,
  confirmado: (c) => <Path d="M4 12.5l5.5 5.5L20 7" stroke={c} />,
  pessoa: (c) => (
    <>
      <Circle cx="12" cy="8" r="4" stroke={c} />
      <Path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" stroke={c} />
    </>
  ),
  pessoas: (c) => (
    <>
      <Circle cx="9" cy="8" r="3.5" stroke={c} />
      <Path d="M2 21c0-3.6 3.1-5.8 7-5.8s7 2.2 7 5.8" stroke={c} />
      <Path d="M16.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6c2.4.7 4 2.4 4 5.4" stroke={c} />
    </>
  ),
  sair: (c) => (
    <>
      <Path d="M10 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" stroke={c} />
      <Path d="M16 16l4-4-4-4M20 12H10" stroke={c} />
    </>
  ),
  aviso: (c) => (
    <>
      <Path d="M12 4l9 16H3z" stroke={c} />
      <Path d="M12 10v4M12 17h.01" stroke={c} />
    </>
  ),
  planilha: (c) => (
    <>
      <Path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={c} />
      <Path d="M3 9h18M9 9v11M15 9v11" stroke={c} />
    </>
  ),
};

export function Icone({
  nome,
  tamanho = 24,
  cor = '#0F172A',
}: {
  nome: string;
  tamanho?: number;
  // `ColorValue` porque a barra de abas entrega a cor já resolvida pelo sistema.
  cor?: ColorValue;
}): ReactElement {
  const desenhar = DESENHOS[nome] ?? DESENHOS.etiqueta!;

  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {desenhar(cor)}
    </Svg>
  );
}
