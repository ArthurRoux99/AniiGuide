# État des lieux d'AniiGuide (6 octobre 2026)

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
| F4 | Plans en nombres entiers (une recette par machine, parcelles entières) | Plan applicable tel quel, sans arrondi |
| F5 ✅ | Noms français officiels de toutes les recettes et de tous les objets | Plus d'anglais dans l'interface |
| F6 | « Quand revenir ? » : stock maximal de chaque installation → heure où la production s'arrête | Planifier ses connexions dans la journée |
| F7 ✅ | Opportunités : quelle amélioration (installation, module, Aniimo) fait gagner le plus | Savoir quoi faire en premier |
| F8 | Nourriture, électricité, commandes du jour (dès que des données fiables et réutilisables existent) | Modèle complet |

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
