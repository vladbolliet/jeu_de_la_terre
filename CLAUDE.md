# Jeu de la Terre

Real-time multiplayer classroom game (~100 phones + 1 projected screen), 1900→2100 in 10 eras of ~2 min.
pnpm monorepo, TypeScript everywhere. See docs/ARCHITECTURE.md for the why.

## Layout
- `packages/shared` — Socket.IO protocol (`protocol.ts`), world state types (`state.ts`), content zod schema (`content.ts`). Imported as TS source, no build step.
- `packages/engine` — pure world model `resolveEra()` + tuning `config.ts`; Node-only `load.ts` (YAML loader); CLIs `simulate`, `content:check`.
- `apps/server` — Express + Socket.IO. `game.ts` = authoritative `Game` class (phases, timers, dealing, votes, views). `index.ts` = transport, payload validation, throttled broadcast, static serving in prod.
- `apps/mobile` — React/Vite player UI (port 5173). `apps/screen` — React/Vite projected screen + host bar (port 5174, base `/screen/`).
- `content/` — game content in YAML (French). Written by non-developers; schema documented in docs/CONTENU.md.

## Tasks and git
- Each dev's task list: `docs/tasks/{vlad,seydina,papa-alioune}.md` (designers: `docs/tasks/designers.md`). Do one task at a time, in order, and tick its checkbox in that file when done.
- Branches: Vlad = `v`, Seydina = `s`, Papa Alioune = `p`. Work and commit only on the current person's branch. Never commit or push directly to `main`; `main` only receives merges. Don't merge into `main` unless the user asks.
- If a task needs data missing from `PlayerView`/`ScreenView`, do not edit the server from the `s`/`p` branches: stop and tell the user to ask Vlad, and say exactly which field is needed.

## Commands
`pnpm dev` · `pnpm typecheck` · `pnpm test` · `pnpm content:check` · `pnpm simulate` · `pnpm loadtest` · `pnpm build && pnpm start`

Run `pnpm typecheck && pnpm test && pnpm content:check` before declaring work done.

## Rules
- Server is authoritative. Clients send intents only; never compute game results client-side.
- Server pushes full view snapshots (`PlayerView`/`ScreenView`); no client-side diffing or optimistic state.
- Players must never receive numeric effects of options (`OptionView` has no `effects`).
- `packages/engine/src/climate.ts` stays pure (no I/O, no randomness, no Date).
- Changing `packages/shared` is a cross-team breaking change: update server and both apps in the same PR, and say so in the PR description.
- If the content schema changes, update `docs/CONTENU.md` and `content/` examples in the same PR.
- Code and comments in English; user-facing text and content in French.
- Ownership: server/engine = Vlad, screen = Seydina, mobile = Papa Alioune, content = designers. Stay in the area you were asked to work on.
- Mobile UI targets iOS Safari + Android Chrome, portrait, one-thumb use. Screen UI targets a 16:9 projector read from far away (large type, high contrast).
