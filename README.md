# AniiGuide

Outil d'aide en français pour **Aniimo** : optimisation du **Logis** (production, Camping-car, recrues), fiches Aniimo, tier list et équipes de combat, codes cadeaux. Installable sur iPhone et PC, fonctionne hors ligne.

Site en ligne : https://arthurroux99.github.io/AniiGuide/ (publié automatiquement à chaque modification de `main`).

## Lancer le site

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests des calculs (solveur HiGHS)
npm run e2e      # tests dans un vrai navigateur (après npm run build)
npm run build    # site statique dans dist/
npm run build:single  # site en un seul fichier : dist-single/index.html
```

**Tester sans rien installer** : ouvre `dist-single/index.html` dans Chrome, Edge ou Safari (double-clic). Chaque exécution de GitHub Actions fournit aussi ce fichier dans l'artefact `aniiguide-html`.

## Ce qui existe

- **Aujourd'hui** (accueil) : codes cadeaux à utiliser, progression vers le prochain niveau du Camping-car et temps restant, routine du jour.
- **Mon logis** : niveau du Camping-car, places d'Aniimo, distribution des capacités (identique à l'écran du jeu), ouvriers avec personnalité, capacités à renforcer et Aniimo conseillés. Ajout d'ouvriers **depuis une capture d'écran** (reconnaissance des portraits), synchro **iPhone ↔ PC par QR code** (sans compte), export/import.
- **Optimiser** : pour ton niveau de Camping-car, quoi produire dans chaque installation pour monter au niveau suivant au plus vite (ou gagner un maximum de pièces), avec tes ouvriers ou des ouvriers idéaux ; conseils de personnalité ; plan des zones climatiques ; feuille de route jusqu'au niveau 20.
- **Recruter** : l'**équipe optimale** pour chaque niveau (quels Aniimo, combien), ce qu'il faut recruter depuis ton équipe en changeant le moins possible, la comparaison niveau par niveau ; et la meilleure recrue individuelle.
- **Tier list** : consensus de 5 tier lists de combat publiées (Game8, Mobi.gg, Aniidex, Hideout, OSLink), sur une même échelle, avec le détail de chaque source, filtres par rôle, élément et forme.
- **Combos** : pourquoi les codes combo ne se génèrent pas, bibliothèque de codes partagés par les joueurs.
- **Ouvriers** : les 207 fiches Aniimo et formes du wiki officiel, filtrables par capacité de logis et niveau.
- **Aniidex** : fiches complètes (stats, talents, exploration, évolutions, faiblesses, habitats).
- **Où trouver** : zones de chaque Aniimo, zones à visiter pour compléter ton logis, liens vers les cartes interactives.
- **Équipes** : équipes de combat de 4 selon les rôles et l'élément ennemi.
- **Opération Œufs** : guide en français (règles, difficultés, rangs, boutique, conseils, sources), suivi des pièces et éclats, calcul du nombre de parties pour un Œuf prismana mystérieux, équipe aux éléments variés.
- **Codes** : codes cadeaux relevés chaque jour, copie en un geste.
- **Vérifier en jeu** : compare une durée chronométrée au calcul et signale les écarts.

## Données

Le wiki officiel, les tier lists et les codes cadeaux sont relus chaque jour par GitHub Actions (`data-refresh.yml`) : si quelque chose a changé, les données sont mises à jour et le site republié.


- `data/official/aniimo.json` : wiki officiel (FR + EN), via `npm run data:official`.
- `data/homeland/aniimax.json` : installations, recettes, coûts de niveau, importés du projet [Aniimax](https://github.com/ae-bii/aniimax) (MIT) via `node scripts/import-aniimax.mjs`.
- `data/tierlists/*.json` : tier lists de combat publiées (rang seulement, source et date), via `node scripts/fetch-tierlists.mjs`.
- `data/codes.json` : codes cadeaux actifs et expirés (AniimoTools + Beebom recoupés), via `node scripts/fetch-codes.mjs`.
- `data/combos.json` : bibliothèque de codes combo proposés par les joueurs.
- `data/portraits.bin` : portraits officiels réduits, pour l'import par capture, via `node scripts/build-portraits.mjs`.
- `data/i18n/fr.json` : noms français relevés en jeu. Quand un nom FR manque, le site affiche le nom anglais.
- `data/verification.json` : faits vérifiés en jeu.
- `data/profils/` : profils réels servant de cas de test.

Documentation : [`docs/PLAN.md`](docs/PLAN.md) (projet) et [`docs/FOYER.md`](docs/FOYER.md) (mécaniques du Logis).

Projet de fans non officiel. Aniimo © Pawprint Studio / FunPlus.
