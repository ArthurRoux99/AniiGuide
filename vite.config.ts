import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, readdirSync } from 'node:fs';
import type { Plugin } from 'vite';

/** Écrit sw.js avec la liste des fichiers du build, pour le mode hors ligne. */
function serviceWorker(): Plugin {
  return {
    name: 'aniiguide-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = [...Object.keys(bundle), ...readdirSync('public')].filter((f) => f !== 'sw.js' && !f.endsWith('.map')).map((f) => `./${f}`);
      const version = Date.now().toString(36);
      const source = readFileSync('build/sw-template.js', 'utf8').replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// base relative : le site fonctionne depuis n'importe quel dossier.
// `vite build --mode single` produit un seul fichier HTML (dist-single/index.html) à ouvrir
// directement dans le navigateur, sans serveur.
export default defineConfig(({ mode }) => ({
  base: './',
  assetsInclude: ['**/*.bin'],
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react(), serviceWorker()],
  build: mode === 'single' ? { outDir: 'dist-single', copyPublicDir: false } : {},
}));
