import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./src/testes/preparar-banco.ts'],
    // Um banco de teste só: arquivos em paralelo brigariam pelo TRUNCATE.
    fileParallelism: false,
    env: { NODE_ENV: 'test' },
  },
});
