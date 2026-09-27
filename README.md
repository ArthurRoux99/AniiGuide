# AniiGuide

Outil d'aide en français pour **Aniimo**, centré sur le **Logis** (le « Foyer ») : tes ouvriers, leurs capacités, et bientôt l'optimisation de la production et du Camping-car.

## Lancer le site

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests des calculs
npm run build    # site statique dans dist/
```

## Ce qui existe

- **Mon logis** : niveau du Camping-car, places d'Aniimo, distribution des capacités (identique à l'écran du jeu), ouvriers avec personnalité, capacités à renforcer et Aniimo conseillés, export/import du profil.
- **Ouvriers** : les 207 fiches Aniimo et formes du wiki officiel, filtrables par capacité de logis et niveau.

## Données

- `data/official/aniimo.json` : wiki officiel (FR + EN), via `npm run data:official`.
- `data/i18n/fr.json` : noms français relevés en jeu. Quand un nom FR manque, le site affiche le nom anglais.
- `data/verification.json` : faits vérifiés en jeu.
- `data/profils/` : profils réels servant de cas de test.

Documentation : [`docs/PLAN.md`](docs/PLAN.md) (projet) et [`docs/FOYER.md`](docs/FOYER.md) (mécaniques du Logis).

Projet de fans non officiel. Aniimo © Pawprint Studio / FunPlus.
