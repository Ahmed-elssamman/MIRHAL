import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  resolve: {
    alias: {
      '@mirhal/domain': resolve('libs/domain/src/index.ts'),
      '@mirhal/contracts': resolve('libs/contracts/src/index.ts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage/domain',
      include: ['libs/domain/src/**/*.ts', 'libs/contracts/src/**/*.ts'],
      exclude: ['libs/domain/src/index.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
