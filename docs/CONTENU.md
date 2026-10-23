# Écrire le contenu du jeu

Tout le contenu est dans `content/` en YAML. Pas besoin de coder : on peut éditer directement sur GitHub (bouton ✏️) puis ouvrir une Pull Request. La CI vérifie le fichier.

```
content/
  roles.yaml       les 6 rôles, leur objectif affiché, leur proportion, leur poids dans les votes
  cards/*.yaml     les cartes de microchoix (un fichier par thème ou par rôle, au choix)
  votes/*.yaml     les votes collectifs (phase « conflits »)
  events/*.yaml    les événements globaux automatiques (crises, catastrophes…)
```

Les cartes sont rangées par rôle (`cards/elite.yaml`, `cards/citoyen.yaml`…) ; les cartes reçues d'un autre joueur sont dans `cards/interactions.yaml`. Les négociations sont dans `votes/negociations.yaml` ; `events/exemples.yaml` contient des exemples à remplacer.

Ajouter un rôle demande aussi du code (liste `ROLES` dans `packages/shared/src/content.ts`, icône et couleur dans `apps/mobile/src/roles.ts`, `apps/screen/src/roles.ts` et `apps/screen/src/styles.css`) : demander à Vlad.

## Une carte

```yaml
- id: citoyen_transport          # unique, snake_case, ne plus le changer une fois utilisé
  roles: [citoyen]               # qui peut la recevoir : elite, citoyen, politique, militant, agriculteur, journaliste
  eras: [2026, 2030, 2035]       # optionnel : ères où elle peut sortir (défaut : toutes)
  regions: [riche, emergent]     # optionnel : groupes de pays où elle peut sortir (défaut : partout)
  title: Aller au travail
  text: Ton travail est loin…
  options:                       # 2 à 4 options
    - id: voiture
      label: Voiture             # texte du bouton
      outcome: Tu arrives à l'heure.   # optionnel : affiché après le choix
      effects: { emissions: 3, wellbeing: 1 }
      score: 3                   # points pour le joueur (son objectif de rôle)
    - id: velo
      label: Vélo
      effects: { emissions: -2 }
      score: 1
```

Ères possibles : 2026, 2030, 2035, 2040, 2045, 2050, 2060, 2070, 2080, 2090 (la partie finit en 2100). Le jeu commence aujourd'hui : le passé depuis 1900 est raconté par le film d'introduction, pas par les cartes.

## Les groupes de pays (`regions`)

Chaque joueur vit dans un pays tiré au sort selon la population mondiale, et le garde toute la partie. Les pays sont rangés en 3 groupes :

| groupe | exemples | part de la population (2026) | émissions par habitant |
|---|---|---|---|
| `riche` | États-Unis, UE, Japon, Russie | ~15 % | ~2 × la moyenne mondiale |
| `emergent` | Chine, Brésil, Indonésie, Mexique | ~35 % | ~1,5 × la moyenne |
| `developpement` | Inde, Nigeria, Bangladesh, Éthiopie | ~50 % | ~0,3 × la moyenne |

- Une carte sans `regions` peut sortir partout : écrire des situations qui ont du sens dans les trois groupes, ou réserver la carte (`regions: [riche]` pour une ZFE ou une chaudière au fioul).
- `content:check` signale un rôle qui n'a aucune carte dans un groupe à une ère.
- Le moteur pondère les choix : un choix pollueur fait aux États-Unis pèse beaucoup plus qu'au Niger. Rien à faire côté contenu, les `effects` s'écrivent toujours à l'échelle d'une personne.
- Dans `roles.yaml`, `share` peut être un nombre (même part partout) ou une part par groupe : `share: { riche: 4, emergent: 15, developpement: 26 }` (beaucoup plus d'agriculteur·rices dans les pays en développement).
- Les chiffres (population, émissions par habitant, pays) sont dans `packages/engine/src/regions.ts`.

## Les effets (`effects`)

Échelle **−10 à +10** par joueur. Le moteur fait la **moyenne sur tous les joueurs**, donc une carte à `emissions: 10` jouée par un seul joueur sur 100 compte peu ; si 60 citoyens choisissent la voiture, ça compte beaucoup.

| clé | sens |
|---|---|
| `emissions` | + = plus de CO2 (accumule : un choix pollueur rend toutes les ères suivantes plus polluantes) |
| `deforestation` | + = plus de forêts détruites |
| `gdp` | + = croissance économique |
| `employment` | + = plus d'emplois |
| `wellbeing` | + = bien-être de la population |
| `approval` | + = approbation des politiques |
| `awareness` | + = sensibilisation du public (débloque des votes, ex. taxe carbone si > 30) |

**Règle d'or** : le joueur ne voit jamais les effets, seulement le `label`. L'option la plus rentable pour son `score` (son objectif de rôle) doit souvent être la plus polluante. C'est le cœur pédagogique.

## Impact croisé entre joueurs (`sends`)

Une option peut envoyer une carte à un joueur au hasard d'un autre rôle :

```yaml
    - id: soudoyer
      label: Payer un·e élu·e pour fermer les yeux
      sends: { card: politique_pot_de_vin, toRole: politique }
```

La carte reçue doit exister et avoir `interactionOnly: true` si elle ne doit sortir que par ce biais. Le joueur qui la reçoit voit « De la part de <prénom> ».

### Réponse à l'expéditeur (`reply`)

Sur une carte reçue via `sends`, une option peut renvoyer un message au joueur qui l'a envoyée. Il le voit avec ses retours de l'ère.

```yaml
- id: politique_pot_de_vin
  roles: [politique]
  interactionOnly: true
  ...
  options:
    - id: accepter
      label: Accepter discrètement
      reply: L'élu·e a accepté ton enveloppe.        # message pour l'élite qui a envoyé la carte
    - id: denoncer
      label: Dénoncer publiquement
      reply: L'élu·e a dénoncé ta tentative de corruption.
```

## Un vote (négociation mondiale)

Les votes sont des **négociations internationales**. Chaque groupe de pays vote de son côté (le vote des politiques compte triple) ; la position du groupe est l'option qui a le plus de voix chez lui. **Un accord n'est adopté que si tous les groupes qui ont voté choisissent la même option** (consensus, comme dans les sommets climat). Sinon, rien n'est adopté : c'est la 1re option (statu quo) qui s'applique.

Principe détaillé, exemple et questions ouvertes : [docs/VOTES.md](VOTES.md).

Donc : mettre le statu quo en premier, et écrire au moins une option de **compromis** que chaque groupe peut accepter (ex. « sortie du charbon en 2040 pour les pays riches, 2050 pour les autres, avec une aide »). Une option qui ne profite qu'à un groupe sera bloquée.

```yaml
- id: prix_carbone
  eras: [2035, 2040]
  when: { indicator: awareness, gt: 30 }   # optionnel ; indicateurs : co2, temperature, seaLevel,
                                           # biodiversity, forest, gdp, employment, wellbeing, approval, awareness
  title: Un prix mondial du carbone
  text: Faire payer chaque tonne de CO2 émise, partout dans le monde…
  options:
    - id: rien            # statu quo en premier : il s'applique s'il n'y a pas d'accord
      label: Pas de prix mondial
      effects: { gdp: 1 }
    - id: national
      label: Un prix du carbone, chaque pays garde ses recettes
      effects: { emissions: -4, gdp: -1, wellbeing: -1 }
    - id: redistribue     # le compromis
      label: Un prix du carbone, recettes reversées aux pays pauvres
      effects: { emissions: -4, gdp: -1, wellbeing: 1 }
```

À chaque ère, **le premier vote** (dans l'ordre des fichiers) dont `eras` et `when` correspondent est joué. Les effets d'un vote s'appliquent **en entier** (pas moyennés) : un vote pèse autant que tous les joueurs choisissant la même chose.

## Un événement global

Fichiers `content/events/*.yaml`. Un événement (crise, catastrophe, découverte) s'applique **automatiquement** à la fin d'une ère si `eras` et `when` correspondent, et s'affiche sur l'écran pendant le bilan. Chaque événement ne se produit **qu'une seule fois** par partie (la première ère où la condition est vraie). Ses effets s'appliquent en entier, comme un vote.

```yaml
- id: canicule
  when: { indicator: temperature, gt: 1.4 }   # optionnel ; mêmes indicateurs que pour les votes
  eras: [2050, 2060, 2070]                    # optionnel
  title: Canicule historique
  text: Une vague de chaleur record…
  effects: { wellbeing: -4, awareness: 5 }
```

## Tester ce qu'on écrit

```bash
pnpm content:check                     # erreurs de syntaxe / ids / cartes manquantes
pnpm simulate --strategy greedy        # tout le monde maximise son score
pnpm simulate --strategy green         # tout le monde choisit l'option la moins polluante
pnpm simulate --strategy random
```

Objectif d'équilibrage suggéré : `greedy` → ~3,5–4,5 °C en 2100, `green` → < 2 °C. Si `green` dépasse 2 °C, les cartes n'offrent pas assez de vraies alternatives ; si `greedy` reste sous 2 °C, les incitations ne sont pas assez fortes.
Les constantes du modèle (émissions de base par ère, seuils des points de bascule…) sont dans `packages/engine/src/config.ts` : à modifier avec Vlad.
