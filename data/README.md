# Données

| Fichier | Contenu | Source | Mise à jour |
|---|---|---|---|
| `official/aniimo.json` | Toutes les fiches Aniimo et leurs formes : noms FR/EN, image, éléments, rôles, stats, habitats, évolutions, **compétences du Foyer** | [wiki.aniimo.com](https://wiki.aniimo.com/fr/) (officiel) | `node scripts/fetch-official-wiki.mjs` |
| `homeland/aniimax.json` | Installations, 208 recettes, objets, coûts de niveau du Camping-car | [Aniimax](https://github.com/ae-bii/aniimax) (licence MIT), version figée | `node scripts/import-aniimax.mjs [sha]` |

Règles :
- Les images restent hébergées sur le CDN officiel ; on ne les copie pas dans le dépôt.
- Chaque donnée du Foyer indique sa source et son niveau de fiabilité (voir `docs/FOYER.md`).
- Aniimo est un jeu de Pawprint Studio / FunPlus. AniiGuide est un projet de fans non officiel.
