// Integration tests: real Socket.IO server on a random port + real clients.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { loadContent } from '@jdlt/engine/load';
import type { ClientToServerEvents, ServerToClientEvents } from '@jdlt/shared';
import { createGameServer } from '../src/app.ts';
import { loadConfig, type ServerConfig } from '../src/config.ts';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const { content } = loadContent();

let server: ReturnType<typeof createGameServer>;
let url: string;
const clients: Client[] = [];

async function start(overrides: Partial<ServerConfig> = {}) {
  const config = { ...loadConfig({}), stateFile: null, ...overrides };
  server = createGameServer(config, content);
  await new Promise<void>((r) => server.http.listen(0, r));
  url = `http://localhost:${(server.http.address() as AddressInfo).port}`;
}

function client(): Promise<Client> {
  const c: Client = io(url, { transports: ['websocket'], forceNew: true });
  clients.push(c);
  return new Promise((r) => c.on('connect', () => r(c)));
}

const emit = (c: Client, event: string, ...args: unknown[]) =>
  new Promise<any>((r) => (c.emit as any)(event, ...args, r));

beforeEach(() => {
  clients.length = 0;
});
afterEach(async () => {
  for (const c of clients) c.disconnect();
  await server.close();
});

describe('server', () => {
  it('never crashes on malformed payloads', async () => {
    await start({ maxEventsPerSecond: 10_000 });
    const c = await client();
    const junk = [
      undefined,
      null,
      42,
      'x',
      [],
      {},
      { name: 5 },
      { name: 'a'.repeat(1000) },
      { instanceId: {} },
    ];
    for (const event of ['player:join', 'player:choose', 'player:vote', 'host:command']) {
      for (const j of junk) {
        (c.emit as any)(event, j); // without ack
        const res = await emit(c, event, j);
        expect(res.ok).toBe(false);
      }
    }
    expect(c.connected).toBe(true);
    const res = await emit(c, 'player:join', { name: 'ok' });
    expect(res.ok).toBe(true);
  });

  it('drops events beyond the rate limit', async () => {
    await start({ maxEventsPerSecond: 5 });
    const c = await client();
    let acks = 0;
    for (let i = 0; i < 20; i++)
      c.emit('player:vote', { voteId: 'x', optionId: 'y' }, () => acks++);
    await new Promise((r) => setTimeout(r, 300));
    expect(acks).toBe(5);
  });

  it('a phone that reconnects with its token keeps its identity and stays counted once', async () => {
    await start();
    const a = await client();
    const joined = await emit(a, 'player:join', { name: 'alice' });
    a.disconnect();
    const b = await client();
    const again = await emit(b, 'player:join', { name: 'alice', token: joined.data.token });
    expect(again.data.playerId).toBe(joined.data.playerId);
    await emit(b, 'player:join', { name: 'alice', token: joined.data.token }); // auto re-join twice
    expect(server.game.screenView().connectedCount).toBe(1);
    b.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    expect(server.game.screenView().connectedCount).toBe(0);
  });

  it('reset kicks players so phones go back to the join screen', async () => {
    await start();
    const p = await client();
    await emit(p, 'player:join', { name: 'a' });
    const kicked = new Promise<void>((r) => p.on('player:kicked', r));
    const host = await client();
    expect((await emit(host, 'host:command', { key: 'dev', action: 'reset' })).ok).toBe(true);
    await kicked;
    expect((await emit(p, 'player:vote', { voteId: 'x', optionId: 'y' })).error).toBe(
      'Pas encore inscrit',
    );
  });

  it('rejects host commands with a wrong key', async () => {
    await start();
    const c = await client();
    expect((await emit(c, 'host:command', { key: 'nope', action: 'start' })).ok).toBe(false);
    expect(server.game.phase).toBe('lobby');
  });

  it('restores the saved game after a restart', async () => {
    const stateFile = join(mkdtempSync(join(tmpdir(), 'jdlt-')), 'state.json');
    await start({ stateFile });
    const c = await client();
    const joined = await emit(c, 'player:join', { name: 'a' });
    await emit(c, 'host:command', { key: 'dev', action: 'start' });
    await new Promise((r) => setTimeout(r, 2500)); // save interval
    c.disconnect();
    await server.close();

    await start({ stateFile });
    expect(server.game.phase).toBe('choices');
    const d = await client();
    const again = await emit(d, 'player:join', { name: 'a', token: joined.data.token });
    expect(again.data.playerId).toBe(joined.data.playerId);
  });
});
