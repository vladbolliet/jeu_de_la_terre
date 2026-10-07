import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { z } from 'zod';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@jdlt/shared';
import { loadContent } from '@jdlt/engine/load';
import { config } from './config.ts';
import { Game, GameError } from './game.ts';

interface SocketData {
  playerId?: string;
}

const { content, warnings } = loadContent(config.contentDir);
for (const w of warnings) console.warn(`content: ${w}`);

const app = express();
const http = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(http, {
  cors: { origin: '*' },
});

// ---- throttled broadcast: many clicks in the same 200 ms => one state push ----
let dirty = false;
const game = new Game(
  content,
  config.durations,
  () => (dirty = true),
  Math.random,
  config.publicUrl,
);
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  io.to('screen').emit('screen:state', game.screenView());
  for (const socket of io.sockets.sockets.values()) {
    const id = socket.data.playerId;
    const view = id ? game.playerView(id) : null;
    if (view) socket.emit('player:state', view);
  }
}, 1000 / config.broadcastHz);

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
  socket.on(
    'player:join',
    handle(
      z.object({ name: z.string().max(64), token: z.string().optional() }),
      ({ name, token }) => {
        const p = game.join(name, token);
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
      z.object({ key: z.string(), action: z.enum(['start', 'next', 'pause', 'resume', 'reset']) }),
      (p) => {
        if (p.key !== config.hostKey) throw new GameError('Clé hôte invalide');
        game[p.action]();
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

http.listen(config.port, () => {
  console.log(
    `server on http://localhost:${config.port} (host key: ${config.hostKey === 'dev' ? 'dev' : '***'})`,
  );
});
