import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/games/**/*.js', 'src/game/**/*.js'],
      exclude: ['**/*.test.js']
    }
  }
});
