/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Azul escuro é a cor de ação (confiança); os tons têm contraste AA
        // sobre branco. O verde menta entra como destaque de dinheiro.
        marca: {
          50: '#EFF6FC',
          100: '#D8E9F6',
          200: '#B4D2EC',
          500: '#2C6FA8',
          600: '#1B5183',
          700: '#0F3A5F',
          800: '#0A2A46',
        },
        menta: {
          50: '#ECFDF7',
          100: '#D2FAEC',
          200: '#A7F3D9',
          500: '#2DD4A7',
          600: '#14B88C',
          700: '#0E8F6D',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        // Nada abaixo de 16px no corpo do app.
        base: ['1rem', { lineHeight: '1.5rem' }],
        valor: ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
      },
      // 48px é o alvo de toque mínimo. `minHeight`/`minWidth` servem ao botão
      // que cresce com o texto; `height`/`width` ao botão só de ícone.
      //
      // Faltavam os dois últimos, e `h-toque w-toque` — usado em 17 botões de
      // ícone (fechar painel, excluir, remover do grupo) — não gerava CSS
      // nenhum: eles ficavam do tamanho do desenho, 24px, num app feito para
      // celular. Classe que não existe some calada; por isso o comentário.
      minHeight: { toque: '48px' },
      minWidth: { toque: '48px' },
      height: { toque: '48px' },
      width: { toque: '48px' },
    },
  },
  plugins: [],
};
