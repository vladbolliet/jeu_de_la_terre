# Jeu de la Terre (1900–2100)

Simulation web multijoueur pour un amphi de ~100 joueurs : chacun joue un rôle (élite industrielle, citoyen·ne, politique, militant·e) sur son téléphone, et ses microchoix font évoluer le climat de 1900 à 2100 sur l'écran projeté.

**Le squelette fonctionne déjà de bout en bout** (inscription, rôles, cartes, votes, climat jusqu'en 2100, 100 bots). Chacun améliore maintenant sa partie.

## Qui fait quoi

| Qui | Rôle | Branche | Dossier | Tes tâches |
|---|---|---|---|---|
| **Vlad** | Serveur, moteur, déploiement | `v` | `apps/server`, `packages/engine` | [docs/tasks/vlad.md](docs/tasks/vlad.md) |
| **Seydina** | Écran central projeté | `s` | `apps/screen` | [docs/tasks/seydina.md](docs/tasks/seydina.md) |
| **Papa Alioune** | Interface mobile | `p` | `apps/mobile` | [docs/tasks/papa-alioune.md](docs/tasks/papa-alioune.md) |
| **Matteo, Ilyes, Rémi, Mo** | Contenu, game design, tests, coordination | — | `content/` | [docs/tasks/designers.md](docs/tasks/designers.md) + **[docs/CONTENU.md](docs/CONTENU.md)** |

`packages/shared` (le protocole entre serveur et apps) appartient aux 3 devs : on ne le modifie qu'après en avoir parlé aux deux autres.
On ne modifie pas le dossier de quelqu'un d'autre sans le prévenir.

## Règle Git

- Chacun travaille **uniquement sur sa branche** (`v`, `s` ou `p`). On ne fait **jamais** de commit ni de push directement sur `main`.
- `main` ne change que par des **merges** des branches `v`, `s`, `p`.
- Quand quelqu'un a mergé sur `main`, les autres récupèrent `main` dans leur branche (merge de `main` dans sa branche).
- Quand ta tâche est finie (et que `pnpm typecheck && pnpm test` passe), tu merges ta branche dans `main`.

```bash
# une seule fois
git fetch && git checkout v                     # (ou s, ou p)

# récupérer le travail des autres
git pull origin main                            # merge main dans ta branche

# envoyer ton travail sur ta branche
git push origin v

# tâche finie : merger dans main
git checkout main && git pull && git merge v && git push origin main && git checkout v
```

## Devs : démarrer

Prérequis : Node 24 (`.nvmrc`), pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev            # serveur :3000, mobile :5173, écran :5174
```

- Joueur : http://localhost:5173 (sur téléphone : `http://<ip-du-pc>:5173`, même Wi-Fi)
- Écran central + contrôles hôte : http://localhost:5174/screen/?key=dev (bouton « Lancer »)
- Faux joueurs : `pnpm loadtest --bots 100` dans un 2ᵉ terminal
- Phases courtes pour tester vite : `CHOICES_S=10 CONFLICTS_S=5 FEEDBACK_S=5 pnpm dev`

### Avec Claude Code

Tout le nécessaire est dans `CLAUDE.md` (lu automatiquement) et dans ton fichier de tâches. Sur ta branche, donne simplement à Claude :

> Lis docs/tasks/<ton-fichier>.md et fais la tâche S1. Coche-la quand c'est fini.

Une tâche à la fois, vérifie le résultat dans le navigateur, commit, puis la suivante.

## Designers : proposer du contenu

Lire **[docs/CONTENU.md](docs/CONTENU.md)** (format des cartes, effets, votes, équilibrage) et [docs/tasks/designers.md](docs/tasks/designers.md).
Pas besoin d'installer le projet : sur GitHub, ouvrir un fichier de `content/`, cliquer ✏️, modifier, puis « Commit changes » → **« Create a new branch and start a pull request »**. La vérification automatique (CI) dit si le fichier est valide ; un dev merge ensuite dans `main`. Ne jamais commiter directement sur `main`.

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | Lance tout en mode dev (rechargement auto) |
| `pnpm typecheck` / `pnpm test` | Vérifications (lancées aussi par la CI) |
| `pnpm content:check` | Valide les fichiers YAML de `content/` |
| `pnpm simulate --strategy greedy\|random\|green` | Joue une partie complète avec des bots et affiche le climat par ère |
| `pnpm loadtest --bots 100` | 100 bots se connectent au serveur et jouent |
| `pnpm build && pnpm start` | Production : un seul serveur sur :3000 sert tout |

## Structure

```
apps/
  server/    Node + Socket.IO — état de jeu, minuteurs, votes        (Vlad)
  mobile/    React + Vite — interface joueur sur smartphone          (Papa Alioune)
  screen/    React + Vite — écran projeté : carte, indicateurs, hôte (Seydina)
packages/
  shared/    Types partagés : protocole Socket.IO, état, schéma du contenu (3 devs)
  engine/    Modèle climat/société + outils simulate / content:check      (Vlad)
content/     Cartes, votes et rôles en YAML                               (designers)
docs/
  tasks/         Tâches de chacun, dans l'ordre
  CONTENU.md     Guide d'écriture du contenu
  ARCHITECTURE.md  Choix techniques et fonctionnement
```
