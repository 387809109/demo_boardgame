import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const vercelAnalyticsMock = fileURLToPath(
  new URL('./test-mocks/vercel-analytics.js', import.meta.url)
);

export default defineConfig({
  test: {
    alias: {
      '@vercel/analytics': vercelAnalyticsMock
    },
    environment: 'node',
    include: ['src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/games/**/*.js', 'src/game/**/*.js'],
      exclude: ['**/*.test.js']
    }
  }
});
