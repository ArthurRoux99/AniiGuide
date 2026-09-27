import { defineConfig } from '@playwright/test';

// Tests dans un vrai navigateur sur le site construit (npm run build), servi par `vite preview`.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4280/', viewport: { width: 390, height: 844 } },
  webServer: { command: 'npx vite preview --port 4280 --strictPort', url: 'http://localhost:4280/', reuseExistingServer: false },
});
