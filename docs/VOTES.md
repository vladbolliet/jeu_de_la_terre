# Les négociations mondiales (votes)

Le code est dans `apps/server/src/game.ts` (`closeVote`), les sujets dans `content/votes/negociations.yaml`.

## Le principe

Chaque ère se termine par une négociation mondiale (phase « Conflits », 90 s).

1. Le sujet s'affiche sur l'écran et les téléphones, avec 2 ou 3 options. La 1re est toujours le statu quo.
2. Chaque joueur vote et peut changer d'avis jusqu'à la fin. Le pays du joueur ne change rien au vote.
3. Le vote d'un·e politique compte triple.
4. À la fin du temps, **l'option qui a le plus de voix l'emporte**. En cas d'égalité, le statu quo l'emporte.
5. Les effets de l'option retenue s'appliquent au monde entier.

## Exemple

10 joueurs (dont 1 politique), vote « Sortir du charbon » : A = pas de traité, B = sortie 2040 pour les riches et 2050 pour les autres avec une aide, C = sortie 2035 pour tous.

- 3 joueurs votent A, la politique et 3 autres votent B, 2 votent C.
- Voix : A = 3, B = 3 + 3 = 6, C = 2 → **B est adopté**.

## Pourquoi la majorité simple

Une première version faisait voter chaque groupe de pays (riches, émergents, en développement) séparément, avec un accord seulement si les 3 groupes choisissaient la même option (consensus, comme dans les sommets climat). C'était trop compliqué à expliquer en classe et ralentissait le jeu : on est revenu à la majorité. Le blocage des pays riches dans les vraies négociations reste un sujet de débrief, il n'est plus simulé par la règle.

## Questions ouvertes

- 90 s suffisent-ils pour négocier dans un amphi ? (`CONFLICTS_S`)
- Faut-il garder le vote triple des politiques ? (`voteWeight` dans `content/roles.yaml`)
