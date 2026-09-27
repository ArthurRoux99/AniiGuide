# AniiGuide — Plan du projet

> Outil d'aide tout-en-un pour **Aniimo** : Aniidex, tier list, carte interactive, et surtout un **guide + planificateur complet du Foyer (Homeland)**.
> **En français**, avec les noms et images officiels des Aniimo.
>
> 👉 Le détail du Foyer (recherche, mécaniques, cahier des charges) est dans [`FOYER.md`](FOYER.md).

Dernière mise à jour : 27/09/2026

---

## 1. État des lieux : ce qui existe déjà

Le jeu est récent mais l'écosystème communautaire est déjà dense. Chaque site fait **une partie** du travail ; aucun ne relie tout.

| Besoin | Outils existants | Ce qui manque |
|---|---|---|
| **Tier list** | Game8, Hideout Guides, Mobi.gg, aniimoguide.com, aniidex.com, aniimofrance.com (FR), Alex-mant/aniimo-tierlist (FR, open source) | Rarement justifiée point par point ; pas liée à *ta* collection ; peu de versions par patch |
| **Carte interactive** | Game8, questlog.gg, aniimo.th.gl, 100pGuides, interactivemap.app, aniimotools.dev, aniidex.com | Déjà très bien couvert (spawns, Alpha/Omega, sanctuaires, Lumin Amber, jour/nuit). Peu en FR |
| **Base de données** | wiki.aniimo.com (officiel), aniimotools.dev/db, Hideout database, aniidex.com | Pas de lien vers « où le capturer » + « à quoi il sert au Foyer » + « en combat » sur une même fiche |
| **Foyer – placement** | Hideout *Homeland Layout Planner* (16 parcelles de 20×15, zones météo) | Ne dit pas **quel Aniimo** mettre ni **quoi produire** |
| **Foyer – production** | Hideout *Homeland Production Optimizer* (Home Coins/h, goulots) | Ne gère pas le placement ni les zones climatiques visuellement |
| **Foyer – équipe d'ouvriers** | wikily.gg *Homeland Team Planner* (RV 1→20, compétences de travail) | N'intègre pas les bonus de personnalité ni la météo (dit explicitement) |
| **Guides FR** | aniimowiki.net/fr, aniimo.guide, gameblog, jeuxvideo.com | Textes statiques, pas d'outils |

### Sources de données exploitables
- **wiki.aniimo.com** (wiki officiel) — source de référence.
- `dluzgames/aniimo-wiki` (GitHub) — miroir du wiki officiel : 94 espèces / 376 fiches (stades Lumin/Gamma/Nova), éléments, rôles, capacités, ~600 icônes. **Pas de licence déclarée** → à utiliser comme référence, pas à copier tel quel.
- `wanghuan072/aniimo` (GitHub) — scripts qui récupèrent kits/compétences.
- `Alex-mant/aniimo-tierlist` (GitHub, FR) — notation des kits sur 6 axes.

➡️ **Notre angle : l'outil qui relie tout, centré sur le joueur.** On importe « mes Aniimo », et chaque outil (Foyer, équipes, tier list) répond avec *ce que j'ai*, en français.

---

## 2. Mécaniques du Foyer à modéliser (à vérifier en jeu)

Relevé dans les outils existants — **chaque point doit être confirmé en jeu** avant d'être codé.

- **Progression RV** : niveaux 1 → 20, qui débloquent bâtiments, quotas de placement (champs, bois, mines) et parcelles (9 à 16 à partir de RV 9).
- **Terrain** : 16 parcelles de 20×15 cases ; bâtiments de 2×2 à 5,5×5,5 cases ; obstacles (arbres, rochers).
- **Bâtiments** (~26) : production de matériaux (Puits, Mine, Champs, Bois…), transformation (Établi, Moulin, Four…), production d'objets, bâtiments climatiques.
- **Climat** : Radiateur (chaud/brûlant), Refroidisseur (frais/gel) dès RV 7, Lampe solaire (lumière) dès RV 9. Rendement d'une recette selon l'écart météo : **100 % / 80 % / 50 % / 20 %** (0 / 1 / 2 / 3+ crans). Les zones se combinent (chaud + gel = frais ; brûlant + gel s'annulent).
- **Ouvriers Aniimo** : compétences de travail (Plante, Terre, Ténèbres, Transport, Artisanat…) avec niveaux, énergie/faim, bonus de **personnalité** selon le bâtiment, efficacité (%) affichée en jeu.
- **Production** : recettes (dont ~358 verrouillées par niveau de bâtiment), minuteries fixes pour certaines cultures, mode électrique (générateur « Crackle »), Home Coins, commandes, expéditions RV (chance d'œuf Prismana).

---

## 3. Fonctionnalités cibles

### A. Aniidex (base de données)
- Fiche par Aniimo : stats, élément, rôle (DPS / Soin / Soutien / Rupture / Régén), capacités, évolutions, **zones de capture** (lien carte), **compétences de travail au Foyer**, personnalité.
- Filtres et recherche (élément, rôle, compétence de travail, jour/nuit, région).
- **Ma collection** : cocher ses Aniimo (stockage local, export/import par lien ou fichier).

### B. Tier list
- Par rôle et globale, **justification écrite** pour chaque rang, historique par patch.
- Filtre « seulement ceux que je possède ».
- Mode **tier list perso** en glisser-déposer, partageable par lien / image.
- Tier list **Foyer** : meilleurs ouvriers par compétence.

### C. Foyer (priorité — le cœur du projet)
1. **Guide complet** : déblocage, premiers pas, feuille de route RV 1 → 20 (quoi construire, quoi farmer, coûts d'amélioration), erreurs courantes, F2P.
2. **Planificateur de placement** : grille 16 parcelles, bâtiments à taille réelle, visualisation des **zones climatiques** et du rendement de chaque bâtiment en direct, limites par RV, obstacles, partage par lien.
3. **Assistant d'équipe** : quel Aniimo dans quel bâtiment, à partir de *ma collection*, en tenant compte des compétences, de la personnalité et de la météo.
4. **Optimiseur de production** : que produire pour maximiser Home Coins/h ou atteindre un objectif (ex. matériaux du prochain RV), goulots d'étranglement, fréquence de récolte.
5. **Tout est relié** : le placement alimente l'optimiseur, qui alimente l'assistant d'équipe → un seul « plan de Foyer » sauvegardé.

### D. Carte interactive
- Régions (Plaines Venteuses, Îles Whisperwake, événements…), spawns jour/nuit, Alpha/Omega, sanctuaires, coffres, Lumin Amber, téléporteurs.
- Suivi « trouvé / pas trouvé » par joueur.
- Lien bidirectionnel avec l'Aniidex.
- ⚠️ Le plus coûteux (relever des centaines de coordonnées) et le mieux couvert par la concurrence → **en dernier**, ou version allégée au début.

### E. Extras (plus tard)
- Constructeur d'équipes de combat (synergies, énergie, élements).
- Codes cadeaux, actus/patch notes, calendrier d'événements.
- PWA (installable sur mobile, fonctionne hors ligne).

---

## 4. Choix techniques proposés

| Sujet | Choix | Pourquoi |
|---|---|---|
| Framework | **Astro + îlots React + TypeScript** | Guides en Markdown rapides et bien référencés (SEO), outils interactifs en React |
| Style | Tailwind CSS | Rapide, cohérent, mode sombre facile |
| État local | Zustand + localStorage | Collection et plans de Foyer sans compte ni serveur |
| Carte | Leaflet (tuiles maison) | Standard, léger |
| Planificateur | Canvas / SVG (Konva ou SVG pur) | Grille + glisser-déposer + zones |
| Optimiseur | Solveur LP en JS (ex. `javascript-lp-solver`) | Le problème « que produire » est un programme linéaire |
| Données | JSON versionnés dans `data/` + schémas **Zod** | Relectures faciles, contributions par PR, validation en CI |
| i18n | FR par défaut, EN ensuite | Public cible francophone |
| Hébergement | GitHub Pages ou Vercel/Netlify (statique) | Gratuit, zéro serveur |
| Qualité | Vitest (calculs du Foyer), Playwright (parcours clés), CI GitHub Actions | Les formules doivent être testées |

---

## 5. Feuille de route

| Phase | Contenu | Livrable |
|---|---|---|
| **0 — Fondations** | Init projet, schémas de données, i18n, charte graphique, CI, déploiement | Site vide en ligne |
| **1 — Données + Aniidex** | Import/normalisation des ~94 espèces, fiches, filtres, « Ma collection » | Aniidex utilisable |
| **2 — Guide du Foyer** | Guide rédigé FR + feuille de route RV 1→20 | Premier contenu à forte valeur |
| **3 — Planificateur du Foyer** | Grille, bâtiments, zones climatiques, partage | Outil phare n° 1 |
| **4 — Équipe + Optimiseur** | Assistant d'ouvriers, optimiseur de production, plan unifié | Outil phare n° 2 |
| **5 — Tier list** | Tier lists justifiées, perso, filtre collection | |
| **6 — Carte** | Carte interactive + suivi | |
| **7 — Extras** | Équipes de combat, codes, actus, PWA, EN | |

---

## 6. Risques et points d'attention
- **Mises à jour du jeu** : les chiffres changent à chaque patch → données versionnées, date « vérifié le » sur chaque valeur sensible.
- **Droits** : les images et textes appartiennent à l'éditeur ; ne pas recopier le contenu d'autres sites fans. Ajouter une mention « site fan non officiel ».
- **Exactitude du Foyer** : plusieurs formules sont déduites par la communauté → les confirmer en jeu et les couvrir par des tests.
- **Charge de maintenance** : prévoir un format de données simple pour que d'autres joueurs puissent contribuer.

---

## 7. Décisions prises (27/09/2026)

| Question | Décision |
|---|---|
| Priorité | **Le Foyer d'abord**, avec l'objectif de l'outil le plus détaillé et fiable possible |
| Vérification en jeu | Tu joues tous les jours (iOS + PC) → relevés par captures d'écran |
| Langue | **Français uniquement** pour l'instant (noms officiels FR + images) |
| Sauvegarde | **Locale** (navigateur + export/lien), comptes plus tard |
| Vision du jeu | Captures d'écran d'abord, import par OCR ensuite ; jamais de lecture mémoire/fichiers du jeu |

La feuille de route §5 est donc réordonnée : **Données → Foyer (F0 à F7, voir FOYER.md) → Aniidex complet → Tier list → Carte.**
