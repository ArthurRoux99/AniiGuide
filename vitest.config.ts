import { defineConfig } from 'vitest/config';

export default defineConfig({
  assetsInclude: ['**/*.bin'],
  test: { include: ['src/**/*.test.ts'], setupFiles: ['./tests/setup.ts'], testTimeout: 30000 },
});
