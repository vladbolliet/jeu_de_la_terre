# Tâches — Papa Alioune (interface mobile) · branche `p`

Zone : `apps/mobile` uniquement. Si une donnée manque dans `PlayerView` (`packages/shared/src/protocol.ts`), demander à Vlad au lieu de modifier le serveur.
Lire d'abord : `CLAUDE.md`, `docs/ARCHITECTURE.md`, `packages/shared/src/protocol.ts` (type `PlayerView`).
Faire les tâches dans l'ordre. Cocher `[x]` ici une fois finie.
Tester : `pnpm dev`, ouvrir http://localhost:5173 (et sur téléphone : `http://<ip-du-pc>:5173`, même Wi-Fi), ouvrir l'écran hôte http://localhost:5174/screen/?key=dev pour lancer la partie, `pnpm loadtest --bots 30` pour avoir d'autres joueurs. Pour aller vite : `CHOICES_S=10 CONFLICTS_S=5 FEEDBACK_S=5 pnpm dev`.
Contraintes : iOS Safari + Android Chrome, portrait, une main, boutons ≥ 48 px de haut, lisible en plein jour, aucun chiffre d'effet écologique montré pendant la partie, tout en français.
Chaque tâche est finie quand : `pnpm typecheck` passe + le critère « Fini quand ».

## J1 — Parcours complet

- [ ] **P1. Inscription et rôle.** Écran d'accueil (titre, champ prénom, bouton). Après inscription, écran « Tu es <rôle> » plein écran avec l'objectif (`me.roleName`, `me.objective`), une couleur et une icône par rôle (elite, citoyen, politique, militant), bouton « Compris ». Le rôle reste visible en haut ensuite.
- [ ] **P2. Reconnexion.** Quand le serveur envoie l'événement `player:kicked` (l'hôte a fait « reset »), effacer le token sauvegardé, vider l'état et revenir à l'écran d'inscription. Si un ack répond « Pas encore inscrit », refaire `join` avec le token. Bandeau « Reconnexion… » pendant les coupures. Tester : passer le téléphone en mode avion 10 s pendant une phase, puis revenir.
  Fini quand : le joueur retrouve sa carte et son score sans rien faire.
- [ ] **P3. Cartes.** Une carte à la fois (si plusieurs dans `hand`, la carte reçue d'un autre joueur `fromPlayer` est mise en avant avec un style distinct). Après un choix : afficher le texte `outcome` renvoyé par l'ack de `player:choose` avec une animation, puis « En attente des autres ». Désactiver les boutons pendant l'envoi, afficher l'erreur de l'ack si `ok: false`.
- [ ] **P4. Vote et compte à rebours.** Vote : options en gros boutons, choix modifiable jusqu'à la fin (`myChoice` surligné). Compte à rebours visible en permanence (`phaseEndsAt`), qui vibre (`navigator.vibrate`) à 10 s si le joueur n'a pas encore joué.

## J2 — Engagement

- [ ] **P5. Transitions d'ère.** Animation « 1920 » plein écran au début de chaque ère ; en phase `feedback`, rappeler ses choix de l'ère (`outcomes`) et le résultat du vote (`lastVoteResult`), et inviter à regarder l'écran.
- [ ] **P6. Fin de partie.** Phase `ended` : score final, puis « Ton impact » : la liste `history` (année, carte, option choisie) avec, pour chaque choix, les effets (`effects`, révélés seulement à la fin) traduits en mots et pictos (ex. emissions +6 → « 🏭 beaucoup plus de CO₂ »). Résumé : « Tes choix ont plutôt augmenté / réduit les émissions ».
- [ ] **P7. Finitions.** Empêcher le zoom accidentel et la mise en veille si possible (Wake Lock API), icône et nom pour « Ajouter à l'écran d'accueil » (manifest), état vide propre pour chaque phase.

## J3

- [ ] **P8. Test réel.** Avec Rémi et Mo, tester sur au moins 5 téléphones différents (vieux Android inclus). Corriger les bugs d'affichage.
