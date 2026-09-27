import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base relative : le site fonctionne depuis n'importe quel dossier.
// `vite build --mode single` produit un seul fichier HTML (dist-single/index.html) à ouvrir
// directement dans le navigateur, sans serveur.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'single' ? { outDir: 'dist-single', copyPublicDir: false } : {},
}));
