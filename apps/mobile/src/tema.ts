/**
 * Mesmas decisões visuais da web, escritas para o React Native:
 * corpo a partir de 16, valores em 18, alvo de toque de 48.
 */
export const cores = {
  marca: '#0F3A5F',
  marcaEscura: '#0A2A46',
  marcaClara: '#EFF6FC',
  marcaBorda: '#B4D2EC',

  /** Verde menta: dinheiro, crescimento, confirmação. */
  menta: '#2DD4A7',
  mentaEscura: '#0E8F6D',
  mentaClara: '#ECFDF7',

  fundo: '#F8FAFC',
  cartao: '#FFFFFF',
  borda: '#E2E8F0',
  bordaForte: '#CBD5E1',

  texto: '#0F172A',
  textoSuave: '#475569',
  textoFraco: '#64748B',
  textoInvertido: '#FFFFFF',

  perigo: '#DC2626',
  perigoClaro: '#FEF2F2',
  aviso: '#B45309',
  avisoClaro: '#FFFBEB',
} as const;

export const espaco = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fonte = {
  corpo: 16,
  valor: 18,
  titulo: 20,
  destaque: 40,
  pequeno: 14,
} as const;

export const raio = {
  sm: 8,
  md: 12,
  lg: 16,
  cheio: 999,
} as const;

/** Mínimo confortável para o dedo, conforme as diretrizes das duas lojas. */
export const ALVO_DE_TOQUE = 48;
