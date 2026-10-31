# Plan : régions du monde et négociations mondiales

Objectif : les joueurs représentent l'humanité. Chacun vit dans un pays tiré au sort selon la
population mondiale, son choix pèse selon les émissions de sa région, et les votes deviennent des
négociations internationales décidées à la majorité.

## Décisions

- **3 groupes de pays, pas des continents.** Le niveau de développement explique les émissions ;
  le continent non (Chine et Inde sont en Asie, avec un rapport 1 à 4 par habitant).
  - `riche` : pays à revenu élevé (UE, États-Unis, Japon…) ≈ 15 % de la population.
  - `emergent` : revenu intermédiaire supérieur (Chine, Brésil, Indonésie, Mexique…) ≈ 35 %.
  - `developpement` : revenu intermédiaire inférieur et faible (Inde, Nigeria, Pakistan,
    Bangladesh, Éthiopie…) ≈ 50 %.
- **Identité fixe** : chaque joueur reçoit un groupe puis un vrai pays (tiré selon sa population),
  et le garde toute la partie.
- **Attribution** : le groupe le plus en dessous de sa part de population, puis le rôle le plus en
  dessous de sa part *dans ce groupe* (`share` par groupe dans `roles.yaml`). Juste même à 8 joueurs.
- **Poids des choix** : la moyenne des effets devient une moyenne pondérée.
  - Tous les effets : poids de représentation = part de population du groupe ÷ part des joueurs
    dans ce groupe (corrige les petits effectifs).
  - `emissions` et `deforestation` : multipliés en plus par le facteur du groupe (émissions par
    habitant ÷ moyenne mondiale). Normalisé : la moyenne mondiale vaut 1, l'équilibrage tient.
  - Les parts de population et les facteurs changent à chaque ère (la population des pays en
    développement augmente, les émissions par habitant se rapprochent). Les joueurs, eux, ne
    changent pas.
- **« 1 joueur = X personnes »** : affichage seulement (X = population du groupe ÷ joueurs du
  groupe). On ne multiplie jamais les effets par la population : la croissance démographique est
  déjà dans `BASELINE_EMISSIONS`.
- **Votes = négociations mondiales, à la majorité** : tous les joueurs votent ensemble (politiques
  ×3), l'option qui a le plus de voix l'emporte, égalité = statu quo (1re option). Le consensus par
  groupe de pays a été essayé puis retiré : trop compliqué à expliquer en classe.
- **Contenu** : champ optionnel `regions` sur les cartes (comme `eras`). Les cartes trop
  « françaises » sont réservées aux pays riches ; on ajoute des cartes propres aux pays en
  développement. Les votes sont réécrits en négociations mondiales avec des options de compromis.

Chiffres (ordres de grandeur, à sourcer avant la version finale) : population et projections ONU
(World Population Prospects 2024), émissions par habitant Global Carbon Project 2024, groupes de
revenu Banque mondiale.

Fonctionnement des votes et points à discuter : [VOTES.md](VOTES.md).

## Étapes

### 1. Shared
- [x] `REGIONS`, `Region`, `RegionSchema` dans `content.ts`.
- [x] `RoleDef.share` : nombre ou une part par groupe.
- [x] `Card.regions` optionnel.
- [x] Vues : `PlayerView.me.{region, regionName, country, represents}`, `PlayerView.vote.myBloc`,
  `ScreenView.regions`, `ScreenView.vote.blocs`, `VoteResult.{agreement, blocs}`.

### 2. Moteur (`packages/engine`)
- [x] `regions.ts` (pur) : population mondiale, parts de population, facteurs, pays, fonction de
  poids par groupe.
- [x] `resolveEra` : moyenne pondérée (`decisions: { effects, weight? }[]`).
- [x] Tests du moteur (poids, normalisation).
- [x] `simulate` : joueurs répartis par groupe, poids appliqués.
- [x] `content:check` : alerte si un couple rôle × groupe n'a pas de carte à une ère.
- [x] Rééquilibrage (`greedy` 3,5–4,5 °C, `green` < 2 °C).

### 3. Serveur (`apps/server/src/game.ts`)
- [x] Attribution groupe → rôle → pays.
- [x] Cartes filtrées par groupe.
- [x] Poids des décisions à la fin de l'ère.
- [x] Vote à la majorité (le consensus par bloc a été retiré).
- [x] Vues et sauvegarde (anciens fichiers de sauvegarde sans groupe : groupe attribué au
  chargement).
- [x] Tests : répartition à 8 / 30 / 100 joueurs, vote à la majorité, poids.

### 4. Contenu
- [x] `roles.yaml` : parts par groupe (plus d'agriculteur·rices dans les pays en développement…).
- [x] Cartes : `regions` sur les cartes trop locales, nouvelles cartes pays en développement.
- [x] Votes réécrits en négociations mondiales (1 par ère à terme, tâche D4).
- [x] `docs/CONTENU.md` à jour.

### 5. Mobile
- [x] Identité : « Tu vis au Nigeria · Agriculteur·rice », « Tu représentes 120 millions de
  personnes ».
- [x] Vote : règle de la majorité rappelée.

### 6. Écran
- [x] Lobby : répartition par groupe.
- [x] Vote : hémicycle des votants et règle de la majorité.
- [x] Résultat : « Accord adopté » / « Rien ne change », voix par option.
- [ ] Bilan : part de population vs part des émissions par groupe (données déjà dans `ScreenView.regions`).
- [ ] Carte : points des joueurs dans leur pays (données déjà dans `ScreenView.countries`).

### 7. Vérifications
- [x] `pnpm typecheck && pnpm test && pnpm content:check`.
- [x] Captures écran + mobile avec bots.
- [ ] PR : changement de `packages/shared`, toutes les équipes concernées.
