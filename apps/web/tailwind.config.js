/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde da marca; tons escolhidos com contraste AA sobre branco.
        marca: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
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
      minHeight: { toque: '48px' },
      minWidth: { toque: '48px' },
    },
  },
  plugins: [],
};
