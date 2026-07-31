import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    // Em desenvolvimento o front chama /api e o Vite repassa para o Fastify:
    // assim não existe CORS nem URL diferente entre dev e produção.
    // `VITE_API_PROXY` (num `.env.local`) serve para quando o backend deste
    // projeto precisa subir em outra porta.
    proxy: {
      '/api': {
        target: loadEnv(mode, process.cwd(), '').VITE_API_PROXY ?? 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}));
