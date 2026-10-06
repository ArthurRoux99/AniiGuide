# Données

| Fichier | Contenu | Source | Mise à jour |
|---|---|---|---|
| `official/aniimo.json` | Toutes les fiches Aniimo et leurs formes : noms FR/EN, image, éléments, rôles, stats, habitats, évolutions, **compétences du Foyer** | [wiki.aniimo.com](https://wiki.aniimo.com/fr/) (officiel) | `node scripts/fetch-official-wiki.mjs` |
| `homeland/aniimax.json` | Installations, 208 recettes, objets, coûts de niveau du Camping-car | [Aniimax](https://github.com/ae-bii/aniimax) (licence MIT), version figée | `node scripts/import-aniimax.mjs [sha]` |
| `tierlists/*.json` | Rangs de 5 tier lists de combat publiées, rattachés aux fiches officielles | Game8, Mobi.gg, Aniidex, Hideout Guides, OSLink (liens dans chaque fichier) | `node scripts/fetch-tierlists.mjs` (chaque jour) |
| `codes.json` | Codes cadeaux actifs (récompenses, date d'ajout, restriction de région) et expirés | [AniimoTools](https://aniimotools.dev/codes/), [Beebom](https://beebom.com/aniimo-codes/) (codes seulement, textes réécrits) | `node scripts/fetch-codes.mjs` (chaque jour) |
| `i18n/wikily-fr.json` | Noms français officiels de 209 objets et des 29 installations du Logis | [Wikily](https://wikily.gg/fr/aniimo/homeland-crafting) (noms seulement) | `node scripts/fetch-fr-names.mjs` (chaque jour) |
| `combos.json` | Codes combo partagés par les joueurs (serveur, niveau, contenu) | Formulaire d'issue « Proposer un code combo » | à la main |

Règles :
- Les images restent hébergées sur le CDN officiel ; on ne les copie pas dans le dépôt.
- Chaque donnée du Foyer indique sa source et son niveau de fiabilité (voir `docs/FOYER.md`).
- Aniimo est un jeu de Pawprint Studio / FunPlus. AniiGuide est un projet de fans non officiel.
