import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relative : le site fonctionne aussi bien sur GitHub Pages que servi depuis un sous-dossier.
export default defineConfig({
  base: './',
  plugins: [react()],
});
