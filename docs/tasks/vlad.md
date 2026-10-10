# Tâches — Vlad (serveur, moteur, déploiement) · branche `v`

Zone : `apps/server`, `packages/engine`, `packages/shared` (avec accord des autres), `Dockerfile`, `.github/`.
Lire d'abord : `CLAUDE.md`, `docs/ARCHITECTURE.md`.
Faire les tâches dans l'ordre. Cocher `[x]` ici une fois finie (dans ce même fichier, sur la branche `v`).
Chaque tâche est finie quand : `pnpm typecheck && pnpm test && pnpm content:check` passe + le critère « Fini quand ».

## J1 — Partie jouable en ligne

- [x] **V1. Déploiement en ligne.** Déployer le `Dockerfile` sur Render (Web Service, plan gratuit accepté) ou Fly.io. Variables d'env : `HOST_KEY` (secret, ≠ `dev`), `PUBLIC_URL` (l'URL publique). Ajouter dans `docs/ARCHITECTURE.md` une section « Déploiement » avec les étapes exactes et l'URL.
  Fini quand : l'URL publique sert le mobile sur `/`, l'écran sur `/screen/`, `/health` répond, et `pnpm loadtest --url <URL> --bots 150` tient sans déconnexion ni erreur.
- [x] **V2. Robustesse reconnexion.** Écrire des tests vitest dans `apps/server/test/` qui couvrent : un joueur se déconnecte pendant `choices` puis revient avec son token → il retrouve sa carte non jouée, son score, son rôle ; un joueur qui rejoint pendant `conflicts` peut voter ; un `reset` invalide les anciens tokens (le client doit alors revenir à l'écran d'inscription — vérifier que `player:join` avec un token inconnu crée bien un nouveau joueur). Corriger ce qui casse.
  Fini quand : tests verts.
- [x] **V3. Sécurité minimale.** Limiter à 1 vote/choix par carte (déjà le cas, ajouter un test), limiter le nombre de joueurs (env `MAX_PLAYERS`, défaut 200, erreur claire), limiter la fréquence des événements par socket (ex. max 10/s, ignorer au-delà). Ne jamais crasher sur un payload invalide (test avec payloads aléatoires).
- [x] **V4. Sauvegarde de l'état.** Écrire l'état complet du `Game` dans un fichier JSON (`STATE_FILE`, défaut `./game-state.json`) dès qu'il change (au plus toutes les 2 s), et le recharger au démarrage s'il existe et date de moins de 2 h. Ajouter l'action hôte `reset` qui supprime le fichier. But : un crash serveur le jour J ne perd pas la partie.
  Fini quand : test qui sérialise un `Game` en pleine partie, le recharge, et obtient les mêmes `screenView()`/`playerView()` (hors `phaseEndsAt`).

## J2 — Mécaniques demandées par les designers

- [x] **V5. Événements globaux.** Ajouter au schéma de contenu (`packages/shared/src/content.ts`) un type `events` (fichiers `content/events/*.yaml`) : `{ id, eras?, when?, title, text, effects }` appliqués automatiquement au début de la phase `feedback` (ex. « Crise pétrolière 1973 », « Canicule »). Les exposer dans `ScreenView.events` (liste des titres/textes de l'ère). Mettre à jour `docs/CONTENU.md` et un exemple dans `content/events/exemples.yaml`. Prévenir Seydina (affichage).
- [x] **V6. Réponses croisées.** Permettre à une carte reçue via `sends` de renvoyer une conséquence à l'expéditeur : option avec `reply: "texte"` → ajouté aux `outcomes` de l'expéditeur. Schéma + `docs/CONTENU.md` + exemple.
- [ ] **V7. Calibrage du modèle.** Avec les designers, ajuster `packages/engine/src/config.ts` pour que, avec le vrai contenu : `pnpm simulate --strategy greedy` → 3,5–4,5 °C en 2100, `green` → < 2 °C, `random` entre les deux. Ajouter un test vitest qui vérifie ces bornes avec le vrai contenu.

## J3 / Jour J

- [x] **V8. Plan B local.** Documenter dans `docs/ARCHITECTURE.md` comment lancer tout sur un portable (`pnpm build && PUBLIC_URL=http://<ip>:3000 pnpm start`) avec partage de connexion, si le Wi-Fi ou l'hébergeur lâche.
- [ ] **V9. Répétition.** `pnpm loadtest --bots 120` pendant une partie complète sur l'URL de prod pendant que l'écran et 2 vrais téléphones sont connectés. Noter les problèmes en issues GitHub.
