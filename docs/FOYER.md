# Le Foyer : recherche, mécaniques et cahier des charges

> Objectif : **l'outil le plus fiable et le plus complet pour développer son Foyer**, en français, avec les images des Aniimo.
> Document de travail — dernière mise à jour : 27/09/2026.

Légende de fiabilité utilisée partout dans ce document et dans les données :

| Badge | Signification |
|---|---|
| ✅ **Officiel** | Lu sur le wiki officiel (wiki.aniimo.com) ou vu en jeu |
| 🟡 **Communauté** | Données extraites du jeu par la communauté (datamine), cohérentes entre plusieurs sources |
| ❓ **À vérifier** | Sources contradictoires ou déduction → à confirmer en jeu avant de s'en servir |

---

## 0. Vocabulaire du jeu en français ✅

Le jeu n'emploie pas « Foyer » pour le système : c'est le **Logis** (Entrepôt du Logis, Capacités de logis…), et le RV s'appelle le **Camping-car**. « Foyer » désigne le stock d'un objet rangé au logis (vs « Inventaire »). L'outil utilisera les termes du jeu, et la recherche acceptera aussi « Foyer » et « RV ». Glossaire complet : `data/i18n/fr.json` ; faits vérifiés : `data/verification.json`.

## 1. Ce que la recherche a donné

### 1.1 Sources de données

| Source | Contenu | Langues | Licence / usage |
|---|---|---|---|
| **wiki.aniimo.com** (officiel) | Toutes les fiches Aniimo + formes : nom, image, éléments, rôle, stats, habitats, évolutions, **compétences du Foyer avec niveau** | **FR**, EN, JA, KO, ZH, ES, PT, RU… | Contenu de l'éditeur. On lie les images depuis leur CDN, on ne les réhéberge pas |
| `ae-bii/aniimax` (GitHub) | Recettes de toutes les installations : durées, charge de travail, rendements, prix de vente, climat, modules, coûts de passage de RV, étapes des cultures | EN seulement | **MIT** → réutilisable avec attribution |
| `Eisenrot/aniimo-homeland-optimizer` (GitHub) | Installations (tailles, niveaux, coûts, RV requis, électricité), recettes, objets, zones climatiques, limites d'Aniimo | EN | **Pas de licence** → consultation seulement, pas de copie |
| wikily.gg, Hideout Guides, aniidex.com, metabot.gg | Mêmes données datamine, mises en forme | EN (FR partiel sans noms d'installations) | Consultation seulement |

**Constat clé : aucun site ne donne les noms français des installations, recettes et objets du Foyer.** Même les pages « FR » affichent les noms anglais. C'est notre première vraie valeur ajoutée, et c'est là que ta présence en jeu est indispensable (voir §6).

### 1.2 Outils Foyer existants et leurs limites

| Outil | Points forts | Ce qui manque |
|---|---|---|
| Aniimax (ae-bii) | Optimiseur exact (programmation linéaire HiGHS), stratégie « prochain RV », priorités | EN, pas de collection réelle, données incomplètes (volontairement) |
| Eisenrot Homeland Optimizer | Le plus complet : équipe réelle, personnalités, climat, plan de terrain automatique | EN, interface très dense, pas de licence, pas de guide |
| Hideout Layout Planner | Plan de terrain visuel 16 parcelles | Ne dit ni quoi produire ni qui affecter |
| wikily Team Planner | Équipe par RV 1→20 | Ignore personnalité et météo |

➡️ **Personne ne propose en français** : un état « Mon Foyer » unique, un tableau de bord « quoi faire maintenant », une feuille de route RV chiffrée, et des données **vérifiées** avec leur niveau de fiabilité affiché.

---

## 2. Mécaniques du Foyer (modèle de calcul)

### 2.1 Progression du RV (niveaux 1 → 20)

Le RV est le niveau du Foyer. Chaque niveau débloque des installations, des niveaux d'installation, des emplacements et des Aniimo ouvriers.

Coût de passage 🟡 (pièces du Foyer + matériaux) :

| RV | Pièces | Matériaux |
|---|---|---|
| 2 | 140 | 3 Blocs de bois |
| 3 | 800 | 25 Blocs de bois |
| 4 | 2 900 | 100 Blocs de bois, 120 Sable minéral |
| 5 | 7 300 | 550 Blocs de bois, 250 Sable minéral |
| 6 | 32 000 | 1 300 Blocs de bois, 700 Sable minéral |
| 7 | 69 000 | 290 Bois brut, 360 Minerai tamisé |
| 8 | 180 000 | 1 100 Bois brut, 640 Minerai tamisé |
| 9 | 260 000 | 1 520 Bois brut, 800 Minerai tamisé |
| 10 | 510 000 | 2 000 Bois brut, 2 400 Minerai tamisé |
| 11 | 680 000 | 320 Planches standard, 350 Briques de minerai frittées |
| 12 | 1 060 000 | 910 Planches, 480 Briques |
| 13 | 1 930 000 | 1 230 Planches, 760 Briques |
| 14 | 2 620 000 | 1 590 Planches, 1 060 Briques |
| 15 | 3 760 000 | 390 Poutres lamellées, 150 Minerai raffiné |
| 16 | 4 900 000 | 480 Poutres, 310 Minerai raffiné |
| 17 | 8 630 000 | 630 Poutres, 380 Minerai raffiné |
| 18 | 11 600 000 | 800 Poutres, 520 Minerai raffiné |
| 19 | 17 100 000 | 400 Composants en bois densifié, 220 Plaques de minerai microcristallin |
| 20 | 20 800 000 | 490 Composants, 270 Plaques |

*(Noms FR provisoires, traduits par nous → ❓ à remplacer par les noms du jeu.)*

Chaînes de matériaux de RV 🟡 :
- **Établi de menuiserie** : Bloc de bois ×8 → Bois brut ×8 → Planches ×8 → Poutres ×4 → Composant densifié
- **Four à cheminée** : Sable minéral ×8 → Minerai tamisé ×8 → Brique frittée ×8 → Minerai raffiné ×4 → Plaque microcristalline
- Les Blocs de bois et le Sable minéral sont des **sous-produits** des Bois et des Mines.

Nombre maximal d'Aniimo au logis : 5, 8, 11, 14, 17, 20, 22, **24, 26**, 28, 30, 32, 34, 36, 38, 40, 42, 43, 44, 45 (RV 1 → 20). ✅ RV 8 = 24 et RV 9 = 26 vus en jeu (le « 30 au RV 9 » d'un guide FR est faux) ; le reste 🟡.

Chaque passage de niveau a aussi des **conditions de placement** (ex. RV 9 : 18 fermes, 9 pépinières, 2 puits) ✅ et une **durée** (RV 9 : 3 h) ✅.

### 2.2 Terrain

- 🟡 16 parcelles de 20 × 15 cases. Les parcelles 9 à 16 se débloquent progressivement à partir du RV 9.
- 🟡 Tailles des installations : de 1 × 1 (Radiateur, Lampe solaire) à 5,5 × 5,5 (Moulin-carrousel, Four à cheminée). Certaines peuvent pivoter.
- 🟡 Nombre d'exemplaires plafonné par RV (ex. Champs : 4 au RV 1 → 40 au RV 19 ; Bois : 0 → 20 ; Mines : 0 → 10 ; Puits : 0 → 2).
- Obstacles (arbres, rochers) à dégager.

### 2.3 Installations (26) 🟡

| Catégorie | Installations (nom EN — nom FR à relever) | Niveau max |
|---|---|---|
| **Production de matériaux** | Farmland (Champs) 7 · Woodland (Bois) 6 · Mine 6 · Well (Puits) 5 · Tidewhisper Sandcastle 3 · Dewy House 2 · Nimbus Bed 3 · Starfall Hammock 1 · Floral Windmill 1 | |
| **Transformation** | Carousel Mill 6 · Crafting Table 8 · Claw Game Cooker 7 · Jukebox Dryer 7 · Simmering Pot 6 · Phonolfactory Table 6 · Bouncy Brew Keg 5 · Blazing Stove 5 · Pickling Jar 5 · Joy Wheel Loom 4 · Woodworking Bench 4 · Chimney Kiln 4 | |
| **Objets** | Aniipod Maker 3 (Aniipods pour capturer) · Dance Pad Polisher 3 | |
| **Auxiliaires (climat)** | Heat Furnace (RV 7) · Cooling Unit (RV 7) · Sunlamp (RV 9) | 1 |

Pour chaque installation on connaît 🟡 : RV requis par niveau, coût d'amélioration, taille, capacité de stockage, puissance électrique, personnalité favorisée.

### 2.4 Compétences de travail des Aniimo ✅

Relevées sur le wiki officiel (section « Homeland Ability » de chaque fiche) : 13 compétences, **niveau 1 à 4**.

| Code | Compétence | Rôle au Foyer |
|---|---|---|
| home-1000 | 🔥 Feu | Cuisine, fonte, chaleur |
| home-1001 | 🌿 Plante | Semer, cueillir |
| home-1002 | 💧 Eau | Brasser, puiser, arroser |
| home-1003 | 🪨 Terre | Défricher, miner |
| home-1004 | ⚡ Foudre | Électricité (Aniipods, mode électrique) |
| home-1005 | ❄️ Glace | Refroidir |
| home-1006 | 🌬️ Vent | Moudre / transformer par le vent |
| home-1007 | 🌑 Ténèbres | Récolter, couper, saumurer, sécher |
| home-1008 | ✨ Lumière | Éclairer |
| home-1100 | 🛒 Transport | Porter la production jusqu'à l'entrepôt |
| home-1101 | ✂️ Artisanat | Objets artisanaux |
| home-1102 | 🎡 Loisir | Produire en jouant |
| home-1103 | 🧴 Parfumerie | Table à parfums |

*(Noms FR des compétences ❓ : à confirmer sur l'écran du jeu.)*

**Premières trouvailles dans les données officielles** (207 fiches, 87 espèces, 18 types de formes) ✅ :
- **Le niveau 4 n'existe que sur les formes Prismana** (26 fiches). Les formes de base plafonnent au niveau 3.
- **Les formes régionales changent les compétences** : ex. les formes « des neiges » donnent de la Glace (Casquillon, Pomœuf, Boulabée…), Trombec forme des plages gagne Eau 2. La forme compte autant que l'espèce.
- **Lumière est très rare** : seule **Lunara** (forme de base) l'a hors Prismana → probablement nécessaire pour faire fonctionner la Lampe solaire ❓.
- **Parfumerie** : seulement **Plumiel** (1) et **Fragrancier** (3).
- **Transport** est la compétence la plus répandue (37 formes de base, dont 20 au niveau 3).

### 2.5 Personnalités ✅/❓

Chaque Aniimo a **4 lettres** (type MBTI), une par paire opposée : **I/E, N/S, F/T, P/J**. Chaque lettre donne **+20 % d'efficacité** dans certaines installations 🟡 :

| Lettre | Personnalité (EN → FR ❓) | Installations favorisées |
|---|---|---|
| E | Energetic → Énergique | Bouncy Brew Keg, Woodworking Bench |
| I | Instinctive → Instinctive | Phonolfactory Table, Dewy House |
| S | Practical → Pratique | Claw Game Cooker, Chimney Kiln |
| N | Nimble → Insaisissable ? | Jukebox Dryer, Blazing Stove, Floral Windmill |
| T | Tenacious → ? | Carousel Mill, Simmering Pot |
| F | Faithful → Fidèle | Joy Wheel Loom, Well, Starfall Hammock |
| J | Judicious → ? | Crafting Table, Tidewhisper Sandcastle, Nimbus Bed |
| P | Playful → Spontané ? | Mine, Pickling Jar |

La personnalité est **propre à chaque individu** (tirée à l'éclosion), pas à l'espèce → elle doit être saisie par le joueur pour ses Aniimo.

### 2.6 Efficacité et vitesse 🟡

- Chaque recette demande une compétence à un **niveau minimum**. Au niveau exact : **100 %**.
- **Transformation** : 1 unité de charge de travail par seconde à 100 %. Un niveau au-dessus : **300 %**, puis **+100 %** par niveau.
- **Collecte** (Mine, Puits, Château de sable…) : chaque niveau au-dessus ajoute 0,5 unité/s (soit +50 % sur une recette niv. 1, +40 % niv. 2, +33 % niv. 3).
- **Personnalité adaptée** : +20 %.
- **Aniimo affamé** : vitesse ×0,2 (!) → la nourriture des ouvriers est critique.
- Charge de travail par niveau de compétence : 60 / 75 / 90 / 105 (❓ signification exacte à vérifier : endurance ?).

### 2.7 Cultures (Champs et Bois) 🟡

- Minuterie **fixe** (non accélérée par l'Aniimo) : ex. Blé 4 min, Pomme de terre ~11 min, la plupart 40 min.
- Étapes : **Semer** (Plante) → **Récolter** (Ténèbres), + **arrosage** (Eau) : 2 arrosages par pousse, chacun retire 1/8 du temps.
- Graines achetées en pièces (coût) → vente du produit (valeur). Sous-produits : Blocs de bois (Bois), Sable minéral (Mines).

### 2.8 Climat 🟡

- **Radiateur** : zone Chaud ou Brûlant. **Refroidisseur** : Frais ou Gel. **Lampe solaire** : lumière Adéquate.
- Zone d'effet ≈ **9 × 9 cases** autour de l'appareil (❓ à confirmer).
- Superposition : Chaud + Gel → Frais ; Frais + Brûlant → Chaud ; Brûlant + Gel s'annulent.
- Rendement d'une recette climatique selon l'écart : **100 % / 80 % / 50 % / 20 %** (0 / 1 / 2 / 3+ crans d'écart).
- Échelle : Gel ← Frais ← (neutre) → Chaud → Brûlant ; lumière séparée.

### 2.9 Autres systèmes

- **Mode électrique** (RV 12+) : l'installation tourne sans ouvrier, alimentée par un générateur (« Crackle ») ; puissance par niveau (15 à 90).
- **Modules d'amélioration** : Écologique, Cuisine, Détecteur de ressources, Artisanat — débloquent des recettes « rapides » ou premium par palier de RV.
- **Notes de recettes** : certaines recettes se débloquent par objet.
- **Commandes** (robot BINI), **Coopérative** (revente de meubles), **expéditions RV** (chance d'œuf Prismana), **labour chez un ami**.
- **Confort / décoration** : valeur de confort par installation (effet exact ❓).

---

## 3. Ce que l'outil doit faire

### 3.1 « Mon Foyer » : un seul état, sauvegardé en local

Tout part d'un profil unique, saisi une fois puis mis à jour :
- RV actuel, pièces et matériaux en stock ;
- installations possédées (nombre + niveau), modules, notes de recettes ;
- **mes Aniimo ouvriers** : espèce (choisie par image), compétences (préremplies depuis le wiki officiel), **personnalité (4 lettres)**, nombre d'exemplaires ;
- habitudes : fréquence de passage en jeu (ex. « toutes les 4 h », « matin et soir ») → influe sur le plan (stockage plein = production perdue).

Sauvegarde : navigateur (localStorage/IndexedDB) + export/import d'un fichier ou d'un lien. Synchronisation iOS ↔ PC via ce lien en attendant les comptes.

### 3.2 Tableau de bord « Quoi faire maintenant »

La page d'accueil du Foyer. En une vue :
- **Prochain RV** : ce qui manque (pièces, matériaux), temps estimé avec le plan actuel ;
- **Les 3 actions les plus rentables maintenant** (ex. « Améliore le Moulin-carrousel au niv. 3 : +18 % de pièces/h, rentabilisé en 6 h ») ;
- **Alertes** : ouvrier mal placé, compétence manquante, recette hors climat, installation inactive.

### 3.3 Optimiseur de production

- Objectifs : max pièces/h, **atteindre le prochain RV au plus vite** (par défaut), max d'un objet, contraintes « au moins X/h de … ».
- Modèle : programmation linéaire en nombres entiers (solveur **HiGHS** compilé en WebAssembly, dans le navigateur).
- Prend en compte : chaînes complètes (entrées → sorties), capacité des installations, minuteries fixes, climat, modules, électricité, **fréquence de récolte**, nombre d'ouvriers.
- Sortie : pour chaque installation, **quoi produire** ; bilan pièces/h ; goulots d'étranglement expliqués en français.

### 3.4 Affectation des ouvriers

- À partir de **mes** Aniimo : qui va où, en maximisant l'efficacité réelle (niveau de compétence + personnalité + transport).
- Signale les manques : « il te manque un Aniimo Vent niv. 3 → voici où capturer [Turbulaine] » (lien vers habitat officiel).
- Suggestions de capture/élevage : « les 5 Aniimo qui amélioreraient le plus ton Foyer ».

### 3.5 Plan de terrain

- Grille 16 parcelles à l'échelle, glisser-déposer, rotation, obstacles.
- Zones climatiques visibles, rendement de chaque installation affiché en direct.
- Placement automatique proposé à partir du plan de production.
- Partage par lien / image.

### 3.6 Feuille de route RV 1 → 20

- Pour chaque RV : ce qui se débloque, quoi construire/améliorer en priorité, coût total, durée estimée **avec ton Foyer**.
- Simulation « si je fais ça, j'atteins le RV 12 le … ».

### 3.7 Encyclopédie du Foyer (FR, avec images)

- Installations, recettes, objets, cultures : fiches en français, valeur de vente, utilité, où c'est utilisé.
- **Aniimo ouvriers** : filtre par compétence et niveau (« tous les Aniimo Ténèbres ≥ 3 »), avec image officielle et habitats.
- Chaque donnée affiche son badge de fiabilité et la date de vérification.

### 3.8 Guide rédigé

- Débuter le Foyer (déblocage, premières heures), erreurs classiques, astuces F2P, rythme conseillé selon le temps de jeu (mobile vs PC).

---

## 4. Architecture technique

```
data/
  official/aniimo.json      ← wiki officiel (script scripts/fetch-official-wiki.mjs)
  homeland/                 ← installations, recettes, objets, RV (base MIT aniimax + vérifs)
  i18n/fr.json              ← noms FR relevés en jeu
  verification.json         ← qui a vérifié quoi, quand, sur quelle version du jeu
src/
  engine/                   ← calculs purs TypeScript, testés (efficacité, climat, LP, affectation)
  app/                      ← interface (Astro + React)
```

- **Moteur séparé et testé** (Vitest) : chaque formule a des tests basés sur des valeurs **relevées en jeu** (captures).
- Solveur : `highs` (WebAssembly, MIT) pour la production ; affectation des ouvriers en programmation linéaire aussi.
- Calculs lourds dans un Web Worker (interface fluide sur iPhone).
- **PWA** installable sur iOS : fonctionne hors ligne, utilisable à côté du jeu.
- Chaque valeur de données porte `source` + `confidence` (officiel / communauté / à vérifier) + `verifiedAt` + `gameVersion`.

---

## 5. « Vision directe » du jeu : ce qui est réaliste

| Option | Utilité | Effort | Risque |
|---|---|---|---|
| **A. Captures d'écran envoyées ici** (iOS ou PC) | Je lis les écrans (noms FR, chiffres, niveaux) et je mets les données à jour | Nul | Aucun |
| **B. Import par capture dans l'outil** (OCR dans le navigateur) | Tu importes tes Aniimo/installations depuis une capture au lieu de tout saisir | Moyen | Aucun |
| **C. Compagnon PC** (lecture de l'écran en direct, OCR) | Mise à jour automatique de « Mon Foyer » pendant que tu joues | Élevé | Faible (lecture de l'écran uniquement) |
| ~~D. Lecture de la mémoire / des fichiers du jeu~~ | — | — | **Exclu** : contraire aux conditions d'utilisation, risque de bannissement |

**Recommandation** : A tout de suite (c'est ce qui rend l'outil fiable), B dans l'outil, C seulement si B ne suffit pas.

---

## 6. Ce dont j'ai besoin de ta part (vérifications en jeu)

Par ordre de priorité. Une capture d'écran par point suffit (iOS ou PC, **jeu en français**).

1. **Noms FR** : le menu de construction du Foyer (chaque onglet) → noms de toutes les installations.
2. **Une fiche d'installation** ouverte (ex. Moulin) : niveau, recettes, efficacité affichée, ouvrier affecté.
3. **La fiche d'un de tes Aniimo** : compétences du Foyer et les 4 lettres de personnalité → confirme les noms FR des compétences et personnalités.
4. **L'écran d'amélioration du RV** (coût du prochain niveau) → valide le tableau §2.1.
5. **Nombre max d'Aniimo** au Foyer à ton RV actuel → tranche la contradiction §2.1.
6. **Une zone climatique** (Radiateur/Refroidisseur) posée, vue du dessus → taille réelle de la zone.
7. L'inventaire / entrepôt (noms FR des matériaux et produits).

Et deux infos : **ton RV actuel** et tes **Aniimo ouvriers** actuels (on s'en servira comme premier jeu de test).

---

## 7. Étapes de réalisation (Foyer)

| Étape | Contenu | Résultat |
|---|---|---|
| F0 | Données : wiki officiel FR ✅ (fait : `data/official/aniimo.json`), import des données MIT, schéma avec fiabilité, noms FR relevés | Base de données du Foyer |
| F1 | Squelette de l'app (Astro + React + TS + PWA), « Mon Foyer » (saisie + sauvegarde), encyclopédie | Premier site utilisable |
| F2 | Moteur : efficacité, climat, cultures, chaînes — **tests sur tes relevés** | Calculs fiables |
| F3 | Optimiseur de production + feuille de route RV | « Quoi produire » + « quand j'atteins le RV X » |
| F4 | Affectation des ouvriers + suggestions de capture | « Qui va où » |
| F5 | Plan de terrain + climat | Plan visuel |
| F6 | Tableau de bord « Quoi faire maintenant » + guide rédigé | Outil complet |
| F7 | Import par capture (OCR) | Saisie quasi automatique |

---

## 8. Codes « Combo » (partage de placements)

- Un combo regroupe de 2 à 500 éléments sélectionnés en mode Construire ; son **code de 8 caractères** se copie depuis sa fiche et s'importe via « Importer ».
- Le code **ne fonctionne que sur le serveur où il a été créé**, et un code inconnu répond « Ce code de combo n'existe pas ».
- Conclusion : c'est un **identifiant stocké sur les serveurs du jeu**, pas une description du placement (8 caractères ne peuvent pas décrire 500 éléments). **AniiGuide ne peut donc pas générer de code** hors du jeu.
- Ce qu'AniiGuide fait à la place ✅ :
  - **Plan des zones climatiques** (onglet Optimiser) : chaque appareil est réglé sur un seul mode (un Radiateur fait Chaud *ou* Brûlant, contrainte entière dans l'optimiseur) ; les cultures couvertes sont rangées par quarts de 4×4 (1 Pépinière ou 4 Fermes par quart, 4 quarts par zone).
  - **Bibliothèque de codes combo** (onglet Combos, `data/combos.json`) : les joueurs proposent leurs codes (serveur, niveau, contenu) via le formulaire d'issue GitHub « Proposer un code combo ».

Sources : [aniimo.guide (outils de construction)](https://aniimo.guide/en/guides/homeland-building-tools), [aniimo.pro](https://aniimo.pro/homeland-and-housing). ❓ À confirmer avec un vrai code (longueur, caractères).

## 9. Équipe optimale (onglet Recruter)

L'optimiseur choisit en même temps la production **et** les Aniimo : programme linéaire HiGHS où chaque profil de capacités peut être recruté (relaxation continue arrondie, puis vérification exacte Aniimo par Aniimo ; l'écart mesuré est nul sur tous les niveaux testés). Contraintes : places du logis (éclatants déduits), un poste par Aniimo à la fois, au moins un Aniimo Plante, Ténèbres, Terre, Eau et Transport. À rythme égal : le moins d'Aniimo possible, et l'option « garder mon équipe » minimise le nombre de recrues.

### Aniimo mobiles ✅

Les Aniimo ne sont **pas attitrés** à une installation : ils se déplacent selon les besoins (confirmé en jeu par un joueur, 27/09/2026). L'optimiseur compte donc le temps de travail réel de chaque atelier (une cuisine utilisée 5 % du temps occupe 5 % d'un Aniimo). L'option « un Aniimo attitré par installation » reste dans le moteur (`dedicated`) mais n'est plus proposée.
