# État des lieux d'AniiGuide (mis à jour le 9 octobre 2026)

Comparaison avec les outils existants, ce qu'il faut corriger, et la feuille de route : Foyer
d'abord, puis la nouvelle partie Opération Œufs (Egg Heist).

## 1. Ce que font les autres

| Outil | Points forts | Limites | Réutilisable ? |
| --- | --- | --- | --- |
| **Aniimax** (ae-bii, GitHub, MIT) | Moteur le plus rigoureux. Plans prouvés optimaux en nombres entiers (HiGHS) : parcelles entières, une recette par machine. Montée de niveau, priorités (pièces, EXP, Aniipods…). Saison « Harvest Moon ». Plan avec ses propres Aniimo (4 lettres de personnalité, appareils climatiques occupés à plein temps). « Opportunités » (amélioration la plus rentable). **Plan complet du logis** autour de l'entrepôt. Paires d'appareils dont les zones se chevauchent (3ᵉ climat). | Anglais seulement, interface dense, pas de mobile, pas de profil sauvegardé, pas de reconnaissance de capture. | **Oui** (MIT) : données et règles. Notre version date du 26/09 ; 67 commits depuis. |
| **AniimoTools** (aniimotools.dev) | Site le plus complet (100+ pages). Simulateur de production : électricité, gamelle de nourriture (travail ×0,2 quand elle est vide), commandes du jour, modules, mutations des cultures, stock des installations, projection sur 24 h. Pages Egg Heist, cartes, codes, collection. | Textes et données protégés (copie interdite, même avec crédit). Anglais. | **Non** : on peut seulement le consulter pour vérifier un fait. |
| **Wikily** (wikily.gg/fr) | **En français**, avec les noms officiels FR des recettes et installations (201 recettes, 29 installations, 1 192 objets du marché). Tables de l'électricité et des débris. | Catalogue sans calcul ni optimisation. Pas de licence affichée. | Noms officiels du jeu (des faits) : utilisables avec mention de la source, sans recopier leurs textes. |
| **Egg Heist** : AniimoVerse, aniimoeggs.com, Game8, aniimogames.wiki | Guides, prix de la boutique, rangs, sacs, puces. | Chiffres contradictoires d'un site à l'autre (prix des sacs, durée d'une partie) ; aucun calculateur. | Faits seulement, recoupés et datés. |

## 2. AniiGuide aujourd'hui

**Points forts propres** : tout en français ; mobile et hors ligne ; profil sauvegardé et
synchronisé iPhone ↔ PC par QR code ; ajout d'ouvriers par capture d'écran ; équipe optimale à
recruter ; page Aujourd'hui ; placement exact autour des appareils climatiques ; codes cadeaux
relevés chaque jour ; Aniidex, tier list de consensus, équipes de combat.

**Erreurs ou manques dans le Foyer** (du plus important au moins important) :

1. **Appareils climatiques non occupés.** En jeu, chaque Fournaise thermique, Climatisation ou Lampe d'incubation
   utilisé occupe un Aniimo à plein temps (Feu, Glace, Lumière). Notre plan l'ignore et compte
   donc un ouvrier de trop par appareil.
2. **Données datées.** Aniimax a corrigé et vérifié des recettes depuis le 26/09 (second Trempo-
   barils au niveau 13, Plateau des moissons, etc.), et ajouté le niveau minimum d'Aniimo par recette
   et la saison.
3. ~~**Personnalité.**~~ Vérifié : un Aniimo a 4 lettres, une par paire (I/E, N/S, F/T, P/J). Comme
   il ne fait qu'un travail à la fois, un ouvrier « idéal » peut toujours avoir la bonne lettre pour
   son poste : pas d'erreur de ce côté.
4. **Plans fractionnaires.** On calcule en continu puis on arrondit. Aniimax résout en entiers :
   parcelles entières, une recette par machine.
5. **Placement des autres bâtiments.** Il compte : les transporteurs font l'aller-retour vers
   l'Entrepôt. On ne le planifie pas encore. Aniimax donne les tailles des 27 installations et le
   terrain (4×4 parcelles de 20×15 cases, la parcelle n s'ouvre au niveau n).
6. **Paires d'appareils.** Un Fournaise thermique et un Climatisation dont les zones se chevauchent créent un
   3ᵉ climat. C'est plus de parcelles couvertes avec peu d'appareils.
7. **Absents du modèle** : électricité (niveau 12 et plus : générateurs de 600 à 1 500 W, travail
   ×1,2), nourriture (gamelle, travail ×0,2 quand elle est vide), commandes du jour, stock maximal
   des installations (l'heure à laquelle revenir avant que tout s'arrête), mutations, débris,
   coûts d'amélioration des installations.
8. **Noms français** : une partie des objets s'affiche encore en anglais.

## 3. Feuille de route

### Foyer (priorité)

| # | Chantier | Effet pour le joueur |
| --- | --- | --- |
| F1 ✅ | Appareils climatiques occupés + données Aniimax à jour (2ᵉ Climatisation, Lampe d'incubation, Établi phonolfactif et Trempo-barils au niveau 13) | Plans justes (aujourd'hui trop optimistes) |
| F2 ✅ | **Plan complet du logis** : toutes les installations sur le vrai terrain, autour de l'Entrepôt, zones climatiques comprises, parcelles verrouillées selon le niveau | Ta demande de placement de tous les bâtiments |
| F3 ✅ | Paires d'appareils (3ᵉ climat) — gain mesuré : +1 à 4 % de pièces/h, temps de montée inchangé | Plus de cultures couvertes avec moins d'appareils |
| F4 ✅ | Plans en nombres entiers (une recette par machine, parcelles entières) | Plan applicable tel quel, sans arrondi |
| F5 ✅ | Noms français officiels de toutes les recettes et de tous les objets | Plus d'anglais dans l'interface |
| F6 ✅ | « Quand revenir ? » : stock maximal de chaque installation → heure où la production s'arrête faute de transporteur | Planifier ses connexions dans la journée |
| F7 ✅ | Opportunités : quelle amélioration (installation, module, Aniimo) fait gagner le plus | Savoir quoi faire en premier |
| F8 | Nourriture, électricité, commandes du jour : voir la suite ci-dessous (§ 5) | Modèle complet |

### Opération Œufs (nouvelle partie)

| # | Contenu |
| --- | --- |
| E1 ✅ | **Guide en français** : déroulé d'une partie, conditions de sortie par difficulté, règle de l'évanouissement et protection du débutant, rangs et barèmes de score, chaque chiffre sourcé et daté |
| E2 ✅ | **Calculateur d'économie** : coût d'une sortie (clé, sac, équipement), revenu moyen saisi par le joueur → nombre de parties pour un Œuf prismana mystérieux (80 000 à 400 000 pièces de coquille + éclats) |
| E3 ✅ | **Équipe Egg Heist** : 4 Aniimo, éléments variés (les piliers élémentaires du Sanctuaire n'ouvrent qu'à leur élément), soin et survie en priorité, à partir de la collection du joueur |
| E4 ✅ | **Suivi** : rang, éclats de coquille prismana, œufs obtenus, objectif d'achat |

## 4. Sources

- Aniimax : https://github.com/ae-bii/aniimax (MIT)
- AniimoTools : https://aniimotools.dev/ (consultation seulement)
- Wikily : https://wikily.gg/fr/aniimo/homeland-crafting
- Egg Heist : https://www.aniimoverse.com/guides/egg-heist, https://aniimogames.wiki/events/operation-egg-heist/,
  https://game8.co/games/Aniimo/archives/618276, https://aniimoeggs.com/guides/egg-heist-ranks-shops-and-rewards/
- Wikily (nourriture) : https://wikily.gg/fr/aniimo/homeland-food
- aniimofrance : https://aniimofrance.com/homeland.html, https://aniimofrance.com/guide-metiers.html
- Mode électrique : https://aniimo.guide/en/guides/homeland-production-power, https://steamcommunity.com/sharedfiles/filedetails/?id=3806795108
- Nourriture : https://aniimoeggs.com/guides/feeding-homeland-workers-food-energy-and-petting/

## 5. Recherche du 9 octobre et suite

### Ce qui a été récupéré

| Source | Ce qu'on en tire | Où |
| --- | --- | --- |
| **Wikily** (API publique `homeland-food`) | Valeur nourrissante des 63 plats (ex. Blé 140, Pudding chococo à la fraise premium 142 560) ; un Aniimo au travail mange **10 par minute** | `data/homeland/food.json`, relevé chaque jour (`scripts/fetch-food.mjs`) |
| **aniimofrance.com** (textes du jeu en français) | Nom officiel du mode : « Opération : Chasse aux œufs en équipe » ; les 7 rangs officiels (Chasseur d'œufs néophyte → Monarque des œufs) et leurs avantages ; les 2 arbres de talents (13 talents chacun, 5,59 M et 9,31 M pièces coquille d'œuf + essences), remis à zéro à chaque saison | `data/eggheist-official.json` (relevé à la main : pas de licence, site protégé) |
| **aniimofrance.com** | Modules du camping-car : électrique (RV 12 à 20, 8 700 → 30 000 pièces), recherche végétale (mutations Coloré, Brillant, Géant, Cristallin ; RV 6 à 15), incubation (RV 9), Émetteur (Envoi d'Aniimo à la Mer florale, 1 à 3 Aniimo, 6 h ; RV 6, 11, 16) ; Générateur crépitant 600 à 1 500 de puissance, portée 11 ; Poteau électrique portée 7 | Faits à reprendre dans l'interface |
| **aniimofrance.com** | Mesure en jeu : Roche niv. 3 sur le Coquillage (charge 2 250) → 105/min, 126/min avec la personnalité | **Confirme notre modèle de vitesse** (même résultat au chiffre près) |
| Guides (aniimo.guide, Steam, aniimoeggs) | Mode électrique : l'installation travaille **sans Aniimo**, à la vitesse du réseau (production ÷ demande, jusqu'à 120 %) ; la puissance est partagée entre les installations ; déconseillé pour Puits et Mines | À vérifier par une mesure en jeu (vitesse de base à 100 %) |
| **Aniimax** | À jour : depuis notre import (5/10), seulement des traductions | — |

**Désaccords à trancher en jeu** :
- Gamelle vide : travail ×0,2 (AniimoTools) ou arrêt complet (aniimoeggs).
- Taille de la Fournaise thermique et de la Lampe d'incubation : 1×1 (Aniimax, « mesuré en jeu ») ou 2×2 (aniimofrance) ; Grande roue à tisser : 4×4 ou 3×3.

### Plan

| Ordre | # | Chantier | Ce que ça apporte | Prêt ? |
| --- | --- | --- | --- | --- |
| 1 | E5 | **Noms officiels** de la Chasse aux œufs : nom du mode, 7 rangs, avantages par rang (emplacements de Coffre Vénard, qualité max du butin) | Plus d'anglais dans la partie Œufs | Données prêtes |
| 2 | E6 | **Planificateur de talents** : les 2 arbres, coût total restant, ordre conseillé (coffre du bateau et « objets à moitié prix » d'abord), relié au calculateur de parties | Savoir combien de parties pour finir un arbre avant la fin de saison | Données prêtes |
| 3 | F8a ✅ | **Nourriture** : le plan compte ce que mangent les Aniimo (10/min chacun) et choisit le plat le moins coûteux (vente perdue) ; carte « Remplir la gamelle » : combien de plats pour tenir X heures hors ligne | Plans justes sur la durée ; ne plus jamais trouver ses Aniimo à l'arrêt | Données prêtes |
| 4 | F8b ✅ | **Mode électrique** : Générateur crépitant (Aniimo Foudre), consommation de chaque installation par niveau (déjà relevée), installations qui tournent sans Aniimo ; le plan choisit lesquelles passer en électrique ; Générateur et Poteaux posés sur le plan du logis (portées 11 et 7) | Des Aniimo libérés pour d'autres postes dès le niveau 12 | Il manque **une mesure en jeu** : durée d'un lot en mode électrique |
| 5 | F9 ✅ | **Lune des moissons** (événement de saison, données Aniimax) : objectif « points de l'événement » | Optimiser l'événement en cours | Données prêtes ; à faire seulement si l'événement dure encore |
| 6 | F10 | **Modules du camping-car** : coût de chaque niveau dans la feuille de route ; mutations et Envoi d'Aniimo expliqués ; rappel d'excursion (6 h) sur la page Aujourd'hui | Rien d'oublié à chaque niveau | Données prêtes |
| 7 | F11 ✅ | **Tailles à confirmer** (Fournaise, Lampe, Grande roue) | Plan du logis exact | Il manque une capture en mode Construire |

Captures ou mesures utiles :
1. Une installation en mode électrique : la durée d'un lot et la puissance du réseau.
2. La gamelle vide : est-ce que les Aniimo s'arrêtent ou ralentissent ?
3. Une Fournaise thermique et une Grande roue à tisser en mode Construire, avec la grille.

### Recherche du 9 octobre (suite) : mode électrique, gamelle, tailles

- **Mode électrique** : Wikily publie, pour chacune des 168 recettes qui le permettent, la durée d'un
  lot sur le réseau (données du client du jeu, `scripts/fetch-emode.mjs`). C'est la durée d'un Aniimo
  du niveau requis à 100 % (charge ÷ 1, 1,25 ou 1,5), sans Aniimo. Consommation : 15 par niveau
  d'installation (30 pour Mine, Puits, Machine à Aniipods, Polisseuse). Générateur crépitant : 600,
  800, 1 000, 1 200, 1 500 de puissance (Foudre niv. 1, 2, 3, 3, 3), niveaux débloqués aux RV 12 à 20.
  Gain mesuré : nul avec des Aniimo idéaux (les machines limitent), mais −25 à −44 % de temps de montée
  et +33 à +48 % de pièces/h avec une équipe de niveau 1 ou 2.
- **Gamelle vide** : toujours contradictoire (×0,2 pour Hideout et AniimoTools, arrêt complet pour
  aniimoeggs) ; le plan ne laisse jamais la gamelle vide, donc la question n'influe pas sur le calcul.
- **Tailles** : Fournaise thermique 1×1 (Wikily, Aniimax), Grande roue à tisser 4×4 (Hideout, Aniimax) :
  nos données sont justes, aniimofrance se trompe.
- **Captures en jeu** (9 octobre) : Générateur niv. 1, 600 W pour 210 W consommés → taux
  d'alimentation 120 % (production ÷ consommation, plafonné) ; Établi de menuiserie en électrique à
  120 %, sans Aniimo ; Séchoir jukebox, Aniimo niv. 3 avec la bonne lettre sur une recette niv. 1 →
  480 % ; Cuisinière flamboyante, Aniimo niv. 3 sans la lettre sur une recette niv. 3 → 100 %. Tout
  correspond au modèle de vitesse (figé dans `speed.test.ts`).
