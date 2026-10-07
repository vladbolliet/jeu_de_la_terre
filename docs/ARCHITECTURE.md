# Architecture

## Choix techniques

| Besoin | Choix | Pourquoi |
|---|---|---|
| Langage | **TypeScript partout** | Un seul langage pour 3 devs ; les types du protocole sont partagés entre serveur et clients, donc un changement casse la compilation au lieu de casser le jour J. |
| Temps réel | **Socket.IO** sur Node | Reconnexion automatique (téléphones qui se mettent en veille), repli en long-polling si le Wi-Fi de l'amphi bloque les WebSockets, accusés de réception (`ack`). 100 connexions = charge triviale pour un seul process. |
| Frontends | **React + Vite** | Standard, rapide, bien connu de Claude Code. Deux apps séparées car usages très différents (téléphone vs projecteur 16:9). |
| Carte | **SVG + d3-geo + world-atlas** | Pas de serveur de tuiles ni de clé API ; on colore librement les pays / zones. |
| Contenu | **YAML validé par zod** | Les game designers éditent du texte, pas du code. `pnpm content:check` donne des erreurs lisibles. |
| Hébergement | **Un seul conteneur Node** (Render / Fly.io / Railway) | Le serveur sert aussi les deux frontends. Pas Vercel : il ne garde pas de WebSocket ouverts. Pas de base de données : une partie dure 20 min, l'état vit en mémoire. |

## Flux

```
téléphones (mobile) ──intentions──▶ server (Game) ──état──▶ téléphones + écran
                         player:choose / player:vote        player:state / screen:state
```

- **Le serveur est la seule source de vérité.** Les clients envoient des intentions (`player:choose`), jamais des résultats. Toute règle va dans `apps/server/src/game.ts` ou `packages/engine`.
- **Le serveur envoie des instantanés complets** (`PlayerView`, `ScreenView`), max 5 fois/s. Pas de diffs → pas de désynchronisation possible ; un client qui se reconnecte reçoit tout.
- **Identité** : à l'inscription le serveur renvoie un `token` stocké dans `localStorage`. À la reconnexion le téléphone renvoie le token et retrouve son rôle et son score.
- **Les joueurs ne voient jamais les effets chiffrés** de leurs options (`OptionView` n'a que `label`).

## Déroulé d'une ère (≈ 2 min, réglable par variables d'env)

1. `choices` (60 s) : chaque joueur reçoit une carte de son rôle. Une option peut **envoyer** une carte à un joueur d'un autre rôle (impact croisé, ex. pot-de-vin → politique).
2. `conflicts` (40 s) : premier vote de `content/votes` dont l'ère et la condition `when` correspondent ; votes pondérés par rôle. Sautée en 3 s s'il n'y a pas de vote.
3. `feedback` (20 s) : `resolveEra()` calcule le nouveau monde (moyenne des effets de tous les joueurs + vote), les points de bascule, et l'écran affiche le bilan.

10 ères : 1900 → 2080, fin en 2100. L'hôte peut lancer, sauter, mettre en pause, réinitialiser.

## Modèle (packages/engine)

`resolveEra(world, { decisions, playerCount, collective })` est **pure** (testable, rejouable).
Les effets des choix (−10…+10) sont **moyennés sur tous les joueurs** : l'équilibrage ne dépend pas du nombre de joueurs.
Émissions de base par ère (industrialisation) × facteur persistant modifié par les choix → CO2 → température (sensibilité 3 °C/doublement, inertie) → mer, forêts, biodiversité, points de bascule (qui ajoutent du CO2 : rétroactions).
Tous les réglages sont dans `packages/engine/src/config.ts`.

## Protocole

Défini dans `packages/shared/src/protocol.ts`. **Le modifier = PR relue par les 3 devs.**
