// Spawns N bot players that join and play randomly. Use it to:
//  - check the server holds 100+ simultaneous connections,
//  - fill the room when testing the screen/mobile UI alone.
// Usage: pnpm loadtest [--url http://localhost:3000] [--bots 100] [--think 5000]
import { parseArgs } from 'node:util';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, PlayerView, ServerToClientEvents } from '@jdlt/shared';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    bots: { type: 'string', default: '100' },
    think: { type: 'string', default: '5000' },
  },
});
const N = Number(values.bots);
const THINK_MS = Number(values.think);

const stats = {
  connected: 0,
  disconnects: 0,
  states: 0,
  choices: 0,
  votes: 0,
  errors: 0,
  ackMs: [] as number[],
};

function timedEmit<T>(fn: (ack: (r: { ok: boolean; error?: string; data?: T }) => void) => void) {
  const t0 = performance.now();
  fn((r) => {
    stats.ackMs.push(performance.now() - t0);
    if (!r.ok) {
      stats.errors++;
      console.warn(`ack error: ${r.error}`);
    }
  });
}

function bot(i: number) {
  const s: Socket<ServerToClientEvents, ClientToServerEvents> = io(values.url, {
    transports: ['websocket'],
  });
  const pending = new Set<string>();
  let voted: string | null = null;

  s.on('connect', () => {
    stats.connected++;
    s.emit('player:join', { name: `bot-${i}` }, () => {});
  });
  s.on('disconnect', () => {
    stats.connected--;
    stats.disconnects++;
  });
  s.on('player:state', (v: PlayerView) => {
    stats.states++;
    for (const card of v.hand) {
      if (pending.has(card.instanceId)) continue;
      pending.add(card.instanceId);
      const option = card.options[Math.floor(Math.random() * card.options.length)]!;
      setTimeout(() => {
        stats.choices++;
        timedEmit((ack) =>
          s.emit('player:choose', { instanceId: card.instanceId, optionId: option.id }, ack),
        );
      }, Math.random() * THINK_MS);
    }
    if (v.vote && !v.vote.myChoice && voted !== v.vote.id) {
      voted = v.vote.id;
      const voteId = v.vote.id;
      const option = v.vote.options[Math.floor(Math.random() * v.vote.options.length)]!;
      setTimeout(() => {
        stats.votes++;
        timedEmit((ack) => s.emit('player:vote', { voteId, optionId: option.id }, ack));
      }, Math.random() * THINK_MS);
    }
  });
}

for (let i = 0; i < N; i++) setTimeout(() => bot(i), i * 20);

setInterval(() => {
  const sorted = [...stats.ackMs].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  console.log(
    `connected=${stats.connected}/${N} disconnects=${stats.disconnects} states=${stats.states} ` +
      `choices=${stats.choices} votes=${stats.votes} errors=${stats.errors} ack_p95=${p95.toFixed(0)}ms`,
  );
  stats.ackMs = [];
}, 2000);
