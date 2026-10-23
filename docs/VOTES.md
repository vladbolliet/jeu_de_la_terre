# Les négociations mondiales (votes)

Document de discussion : le principe actuel, pourquoi, et ce qui reste à débattre.
Le code est dans `apps/server/src/game.ts` (`closeVote`), les sujets dans `content/votes/negociations.yaml`.

## Le principe

Chaque ère se termine par une négociation mondiale (phase « Conflits », 90 s).

1. Le sujet s'affiche sur l'écran et les téléphones, avec 2 ou 3 options. La 1re est toujours le statu quo.
2. Chaque joueur vote pour son pays et peut changer d'avis jusqu'à la fin.
3. Chaque groupe de pays (riches, émergents, en développement) prend la position qui a le plus de voix chez lui. Le vote d'un·e politique compte triple. En cas d'égalité, le statu quo l'emporte.
4. L'écran montre en direct la position de chaque groupe : la salle voit qui bloque et peut négocier à voix haute.
5. À la fin du temps, le serveur applique la règle automatiquement (personne n'arbitre, l'animateur ne gère que le rythme) :
   - **accord adopté** si tous les groupes qui ont voté choisissent la même option ;
   - sinon **statu quo**. Un groupe qui ne vote pas ne bloque pas.
6. Les effets de l'option retenue s'appliquent au monde entier.

## Exemple

10 joueurs : 2 riches (Léa, Tom), 3 émergents, 5 en développement. Vote « Sortir du charbon » :
A = pas de traité, B = sortie 2040 pour les riches et 2050 pour les autres avec une aide, C = sortie 2035 pour tous.

| Après 30 s | Votes | Position |
|---|---|---|
| Riches | Léa A, Tom B | A (égalité → statu quo) |
| Émergents | 2 A, 1 B | A |
| En développement | 3 B, 2 C | B |

→ Pas d'accord. La salle négocie : Léa passe à B, un joueur émergent passe à B.
→ B, B, B : **accord adopté**. Deux personnes qui changent d'avis ont fait basculer le monde.
Si Léa avait gardé A, rien n'était adopté, même avec 8 votes sur 10 pour B.

## Tous les votes n'ont pas le même poids (choix assumé)

- **Selon le groupe** : chaque groupe a le même pouvoir de blocage, quelle que soit sa taille. Sur 100 joueurs, un joueur « riche » est 1 voix sur ~16 pour décider de son groupe, un joueur « en développement » 1 sur ~49 : il pèse environ 3 fois moins. 16 joueurs peuvent bloquer un accord voulu par les 84 autres.
- **Selon le rôle** : les politiques comptent triple dans leur groupe.

Pourquoi : c'est ce qui se passe dans les sommets climat. Les décisions s'y prennent par consensus, chaque pays peut bloquer, et les Tuvalu (11 000 habitants) pèsent formellement autant que la Chine. Le jeu fait vivre cette injustice ; c'est un sujet de débrief (« était-ce juste que 16 personnes bloquent 84 autres ? »).

## Simplifications connues

- Les vraies coalitions ne suivent pas nos 3 groupes : l'Arabie saoudite ou la Russie (« riches » dans le jeu) ne négocient pas avec l'UE ; la Chine et l'Inde négocient souvent ensemble (G77 + Chine) ; les pays riches sont divisés entre eux.
- Les 3 groupes gardent l'essentiel (qui a émis, qui subit, qui paie) et des blocs assez grands pour 100 élèves. À expliquer en une phrase au débrief.

## Pistes écartées

- **Une personne = une voix, total mondial** : les pays en développement (~50 % des joueurs) décideraient presque seuls, plus de débat dans la salle, et aucune négociation réelle ne marche ainsi.
- **5–6 coalitions réalistes** (UE, Umbrella, BASIC, G77, petits États insulaires, OPEP) : blocs de 3–4 joueurs, accords quasi impossibles.

## Questions ouvertes

- 90 s suffisent-ils pour négocier dans un amphi ? (`CONFLICTS_S`)
- Trop d'échecs = frustration ? Si les tests le montrent : accord à 2 groupes sur 3, avec un effet réduit.
- Faut-il garder le vote triple des politiques, maintenant que les groupes de pays créent déjà l'inégalité ?
- Faut-il afficher au débrief qui a bloqué chaque négociation sur l'ensemble de la partie ?
