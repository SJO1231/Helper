import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['shared/**/*.test.ts', 'extension/**/*.test.ts', 'viewer/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
