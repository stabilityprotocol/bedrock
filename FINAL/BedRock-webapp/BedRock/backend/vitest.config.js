import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    include: ['tests/**/*.test.js'],
    exclude: ['tests/integration/**'],
    testTimeout: 30000,
  },
});
