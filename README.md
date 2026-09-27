# AniiGuide

Outil d'aide en français pour **Aniimo**, centré sur le **Logis** (le « Foyer ») : tes ouvriers, leurs capacités, et bientôt l'optimisation de la production et du Camping-car.

Site en ligne : https://arthurroux99.github.io/AniiGuide/ (publié automatiquement à chaque modification de `main`).

## Lancer le site

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests des calculs
npm run build    # site statique dans dist/
npm run build:single  # site en un seul fichier : dist-single/index.html
```

**Tester sans rien installer** : ouvre `dist-single/index.html` dans Chrome, Edge ou Safari (double-clic). Chaque exécution de GitHub Actions fournit aussi ce fichier dans l'artefact `aniiguide-html`.

## Ce qui existe

- **Mon logis** : niveau du Camping-car, places d'Aniimo, distribution des capacités (identique à l'écran du jeu), ouvriers avec personnalité, capacités à renforcer et Aniimo conseillés, export/import du profil.
- **Optimiser** : pour ton niveau de Camping-car, quoi produire dans chaque installation pour monter au niveau suivant au plus vite (ou gagner un maximum de pièces), avec tes ouvriers ou des ouvriers idéaux ; conseils de personnalité ; feuille de route jusqu'au niveau 20.
- **Recruter** : les Aniimo (et leurs formes) qui feraient gagner le plus de temps à ton logis, au niveau actuel et au suivant, calculés avec l'optimiseur ; qui retirer si le logis est plein.
- **Ouvriers** : les 207 fiches Aniimo et formes du wiki officiel, filtrables par capacité de logis et niveau.

## Données

- `data/official/aniimo.json` : wiki officiel (FR + EN), via `npm run data:official`.
- `data/homeland/aniimax.json` : installations, recettes, coûts de niveau, importés du projet [Aniimax](https://github.com/ae-bii/aniimax) (MIT) via `node scripts/import-aniimax.mjs`.
- `data/i18n/fr.json` : noms français relevés en jeu. Quand un nom FR manque, le site affiche le nom anglais.
- `data/verification.json` : faits vérifiés en jeu.
- `data/profils/` : profils réels servant de cas de test.

Documentation : [`docs/PLAN.md`](docs/PLAN.md) (projet) et [`docs/FOYER.md`](docs/FOYER.md) (mécaniques du Logis).

Projet de fans non officiel. Aniimo © Pawprint Studio / FunPlus.
