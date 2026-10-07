// Builds the HTTP + Socket.IO server around a Game. Used by index.ts and by integration tests.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { z } from 'zod';
import type { Ack, ClientToServerEvents, Content, ServerToClientEvents } from '@jdlt/shared';
import type { ServerConfig } from './config.ts';
import { Game, GameError } from './game.ts';
import { deleteSnapshot, loadSnapshot, saveSnapshot } from './persist.ts';

interface SocketData {
  playerId?: string;
}

/** How often the state file is rewritten when the game changed. */
const SAVE_INTERVAL_MS = 2000;

export function createGameServer(config: ServerConfig, content: Content) {
  const app = express();
  const http = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(http, {
    cors: { origin: '*' },
  });

  let dirty = false;
  let unsaved = false;
  const gameOptions = {
    durations: config.durations,
    onChange: () => {
      dirty = true;
      unsaved = true;
    },
    publicUrl: config.publicUrl,
    maxPlayers: config.maxPlayers,
  };
  const saved = config.stateFile ? loadSnapshot(config.stateFile, config.stateMaxAgeMs) : null;
  const game = saved ? Game.restore(saved, content, gameOptions) : new Game(content, gameOptions);
  if (saved) console.log(`state: restored game (phase ${saved.phase}, year ${saved.world.year})`);

  // ---- throttled broadcast: many clicks in the same 200 ms => one state push ----
  const broadcastTimer = setInterval(() => {
    if (!dirty) return;
    dirty = false;
    io.to('screen').emit('screen:state', game.screenView());
    for (const socket of io.sockets.sockets.values()) {
      const id = socket.data.playerId;
      const view = id ? game.playerView(id) : null;
      if (view) socket.emit('player:state', view);
    }
  }, 1000 / config.broadcastHz);

  const saveTimer = setInterval(() => {
    if (!unsaved || !config.stateFile) return;
    unsaved = false;
    try {
      saveSnapshot(config.stateFile, game.snapshot());
    } catch (e) {
      console.error('state: save failed', e);
    }
  }, SAVE_INTERVAL_MS);

  /** Validates the payload, runs the handler, and turns errors into an ack. */
  function handle<S extends z.ZodType, R>(schema: S, fn: (p: z.infer<S>) => R) {
    return (payload: unknown, ack: Ack<R>) => {
      if (typeof ack !== 'function') return;
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: 'Requête invalide' });
      try {
        ack({ ok: true, data: fn(parsed.data) });
      } catch (e) {
        if (!(e instanceof GameError)) console.error(e);
        ack({ ok: false, error: e instanceof GameError ? e.message : 'Erreur serveur' });
      }
    };
  }

  io.on('connection', (socket) => {
    // Rate limit: drop events beyond maxEventsPerSecond (sliding 1 s window).
    let windowStart = Date.now();
    let count = 0;
    socket.use((_packet, next) => {
      const now = Date.now();
      if (now - windowStart >= 1000) [windowStart, count] = [now, 0];
      if (++count > config.maxEventsPerSecond) return;
      next();
    });

    socket.on(
      'player:join',
      handle(
        z.object({ name: z.string().max(64), token: z.string().max(64).optional() }),
        ({ name, token }) => {
          const p = game.join(name, token);
          // A socket re-joining (e.g. auto re-join on reconnect) must not count twice.
          if (socket.data.playerId) game.disconnect(socket.data.playerId);
          socket.data.playerId = p.id;
          return { token: p.token, playerId: p.id };
        },
      ),
    );

    const playerId = () => {
      if (!socket.data.playerId) throw new GameError('Pas encore inscrit');
      return socket.data.playerId;
    };

    socket.on(
      'player:choose',
      handle(z.object({ instanceId: z.string(), optionId: z.string() }), (p) => ({
        outcome: game.choose(playerId(), p.instanceId, p.optionId),
      })),
    );

    socket.on(
      'player:vote',
      handle(z.object({ voteId: z.string(), optionId: z.string() }), (p) => {
        game.castVote(playerId(), p.voteId, p.optionId);
        return null;
      }),
    );

    socket.on('screen:join', () => {
      socket.join('screen');
      socket.emit('screen:state', game.screenView());
    });

    socket.on(
      'host:command',
      handle(
        z.object({
          key: z.string(),
          action: z.enum(['start', 'next', 'pause', 'resume', 'reset']),
        }),
        (p) => {
          if (p.key !== config.hostKey) throw new GameError('Clé hôte invalide');
          game[p.action]();
          if (p.action === 'reset') {
            if (config.stateFile) deleteSnapshot(config.stateFile);
            for (const s of io.sockets.sockets.values()) {
              if (!s.data.playerId) continue;
              s.data.playerId = undefined;
              s.emit('player:kicked');
            }
          }
          return null;
        },
      ),
    );

    socket.on('disconnect', () => {
      if (socket.data.playerId) game.disconnect(socket.data.playerId);
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, phase: game.phase, sockets: io.engine.clientsCount });
  });

  // ---- production: serve the built frontends (mobile at /, screen at /screen) ----
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const mobileDist = resolve(root, 'apps/mobile/dist');
  const screenDist = resolve(root, 'apps/screen/dist');
  if (existsSync(screenDist)) {
    app.use('/screen', express.static(screenDist));
    app.get('/screen/*splat', (_req, res) => res.sendFile(resolve(screenDist, 'index.html')));
  }
  if (existsSync(mobileDist)) {
    app.use(express.static(mobileDist));
    app.get('/*splat', (_req, res) => res.sendFile(resolve(mobileDist, 'index.html')));
  }

  return {
    http,
    io,
    game,
    async close() {
      clearInterval(broadcastTimer);
      clearInterval(saveTimer);
      game.stop();
      await io.close();
    },
  };
}
