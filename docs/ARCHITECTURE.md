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

## Variables d'environnement du serveur

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | 3000 | Port HTTP |
| `HOST_KEY` | `dev` | Clé des contrôles hôte (`/screen/?key=…`) — **à changer en prod** |
| `PUBLIC_URL` | — | URL publique, affichée en QR code dans le lobby |
| `CHOICES_S` / `CONFLICTS_S` / `FEEDBACK_S` | 60 / 40 / 20 | Durée des phases (s) |
| `MAX_PLAYERS` | 200 | Au-delà, « La partie est complète » (les joueurs connus peuvent toujours revenir) |
| `STATE_FILE` | `./game-state.json` | Fichier de sauvegarde ; vide = désactivé |
| `CONTENT_DIR` | `content/` | Dossier du contenu YAML |

Chaque socket est limité à 10 événements/s (au-delà ils sont ignorés). Un payload invalide renvoie `{ ok: false, error }` sans jamais faire planter le serveur.

## Sauvegarde de l'état

Le serveur écrit l'état complet de la partie dans `STATE_FILE` (défaut `./game-state.json`) toutes les 2 s si quelque chose a changé (écriture atomique). Au démarrage, il recharge ce fichier s'il a moins de 2 h ; la phase en cours reprend avec au moins 10 s restantes, et les téléphones se reconnectent avec leur token. `reset` (hôte) supprime le fichier. `STATE_FILE=` (vide) désactive la sauvegarde.
Attention : sur Render, le disque est effacé quand le conteneur redémarre (sauf avec un disque persistant, payant). La sauvegarde protège donc surtout le plan B local.

## Déploiement

URL de production : **https://jeu-de-la-terre.onrender.com** (écran : `/screen/?key=<HOST_KEY>`, clé visible dans Render → Environment). Testé avec 150 bots sur une ère complète : 0 déconnexion, 0 erreur, réponses < 220 ms (p95).

Render (fichier `render.yaml` à la racine) :
1. https://dashboard.render.com → **New → Blueprint** → choisir le repo GitHub `jeu_de_la_terre`. Render lit `render.yaml`, construit le `Dockerfile` et déploie la branche `main` à chaque merge.
2. Une fois l'URL connue (ex. `https://jeu-de-la-terre.onrender.com`), la mettre dans la variable d'environnement `PUBLIC_URL` du service (Environment) → redéploiement automatique.
3. `HOST_KEY` est générée par Render (Environment → afficher). Écran hôte : `<URL>/screen/?key=<HOST_KEY>`.
4. Vérifier : `<URL>/health` répond `{"ok":true,...}` ; puis `pnpm loadtest --url <URL> --bots 150`.

Plan gratuit : le service s'endort après 15 min sans trafic (premier chargement ~1 min). **Le jour J**, passer en plan Starter (pas de mise en veille) ou ouvrir `<URL>/health` 5 min avant.
Le serveur garde tout en mémoire : **une seule instance**, ne jamais activer l'autoscaling.

## Plan B : tout sur un portable

Si le Wi-Fi de l'amphi ou l'hébergeur lâche :
1. Avant le jour J, sur le portable : `git pull`, `pnpm install`, `pnpm build`.
2. Activer le partage de connexion d'un téléphone (ou un routeur de poche), y connecter le portable, noter son IP (`ipconfig` sous Windows, `ip addr` sous Linux/WSL, `ipconfig getifaddr en0` sous macOS).
3. `HOST_KEY=<secret> PUBLIC_URL=http://<ip>:3000 pnpm start`
4. Les joueurs rejoignent le même réseau et ouvrent `http://<ip>:3000` (QR code à l'écran) ; l'écran projeté ouvre `http://localhost:3000/screen/?key=<secret>`.
5. Sous WSL, le port n'est pas exposé au réseau par défaut : lancer plutôt depuis Windows/macOS/Linux natif, ou activer le mode réseau « mirrored » de WSL.
Limite : un partage de connexion de téléphone accepte souvent ~10–15 appareils seulement ; pour 100 joueurs il faut un vrai point d'accès (routeur Wi-Fi).
