import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'mocks/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      include: ['src/lib/**', 'src/api/**'],
      exclude: ['src/api/schema.d.ts'],
    },
  },
});
