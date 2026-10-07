# Tâches — Seydina (écran central projeté) · branche `s`

Zone : `apps/screen` uniquement. Si une donnée manque dans `ScreenView` (`packages/shared/src/protocol.ts`), demander à Vlad au lieu de modifier le serveur.
Lire d'abord : `CLAUDE.md`, `docs/ARCHITECTURE.md`, `packages/shared/src/protocol.ts` (type `ScreenView`), `packages/shared/src/state.ts` (type `World`).
Faire les tâches dans l'ordre. Cocher `[x]` ici une fois finie.
Tester : `pnpm dev`, ouvrir http://localhost:5174/screen/?key=dev, lancer `pnpm loadtest` dans un autre terminal, cliquer « Lancer ». Pour aller vite : `CHOICES_S=10 CONFLICTS_S=5 FEEDBACK_S=5 pnpm dev`.
Contraintes : projecteur 16:9 lu à 10–20 m → texte ≥ 28 px pour l'essentiel, fort contraste, pas d'info en petit. Aucune interaction souris sauf la barre hôte. Pas de scroll.
Chaque tâche est finie quand : `pnpm typecheck` passe + le critère « Fini quand ».

## J1 — Écran lisible

- [x] **S1. Lobby.** Phase `lobby` : grand titre, QR code vers `view.joinUrl` (lib `qrcode` ou `qrcode.react`), l'URL en clair à côté (si `joinUrl` est null, utiliser `location.origin`), nombre de joueurs connectés qui s'actualise, répartition par rôle (`roleCounts`).
  Fini quand : un téléphone peut scanner le QR projeté et rejoindre.
- [x] **S2. Bandeau de phase.** En-tête : année en très grand, nom de la phase, compte à rebours (`phaseEndsAt`) qui devient rouge sous 10 s, barre de progression de la phase.
- [x] **S3. Indicateurs.** Refaire `Indicators.tsx` : 5 indicateurs climat (CO₂, température, mer, forêts, biodiversité) en grandes tuiles avec valeur, variation depuis l'ère précédente (`world.history`) et couleur selon la gravité ; 3 indicateurs société plus petits. Températures : vert < 1 °C, orange < 2 °C, rouge au-delà.
- [ ] **S4. Phase choix et vote.** `choices` : jauge `choicesMade / cardsDealt` et, par rôle (`roleStats`), une barre « plus/moins polluant » (`meanEmissions`, −10…+10) sans chiffres. `conflicts` : titre + texte du vote en grand, nombre de votes (`vote.ballots`).

## J2 — Carte vivante et bilans

- [ ] **S5. Carte dynamique.** Dans `WorldMap.tsx` : (a) teinte de chaleur par latitude (les pôles et tropiques chauffent plus vite) selon `climate.temperature` ; (b) forêts : points/hachures verts sur les zones forestières (Amazonie, Congo, Bornéo, Sibérie) qui disparaissent avec `climate.forest` ; (c) montée des eaux : contour côtier bleu qui s'épaissit avec `climate.seaLevel` (0 → 100 cm) ; (d) icônes sur la carte pour chaque point de bascule franchi (`world.tippingPoints` : arctic_ice → Arctique, permafrost → Sibérie, amazon → Amazonie, coral_reefs → Grande Barrière). Transitions animées (2 s) entre ères.
- [ ] **S6. Bilan d'ère (`feedback`).** Plein écran pendant la phase : « 1920 → 1940 », variations des indicateurs, résultat du vote (`lastVoteResult`, avec le décompte), alerte animée et texte explicatif pour chaque nouveau point de bascule (`newTippingPoints`), et les événements de l'ère s'ils existent (`events`, ajouté par Vlad en V5).
- [ ] **S7. Écran de fin (`ended`).** Courbes 1900→2100 (température, CO₂, biodiversité) depuis `world.history`, classement (`leaderboard`) et un message de conclusion pédagogique (texte à demander aux designers, en attendant un placeholder).

## J3

- [ ] **S8. Test au projecteur.** Tester dans une vraie salle (avec Rémi/Mo) : lisibilité depuis le fond, couleurs sur projecteur délavé. Corriger.
- [ ] **S9. Barre hôte.** La masquer automatiquement après 5 s sans mouvement de souris ; raccourcis clavier : Espace = phase suivante, P = pause/reprise.
