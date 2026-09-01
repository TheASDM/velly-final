import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    pool: 'threads',
    maxWorkers: 1,
    clearMocks: true,
    restoreMocks: true,
  },
});
