import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['App.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    clearMocks: true,
    restoreMocks: true,
  },
});
