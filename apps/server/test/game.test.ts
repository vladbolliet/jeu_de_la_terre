import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadContent } from '@jdlt/engine/load';
import { createRng } from '@jdlt/engine';
import { Game, type GameOptions } from '../src/game.ts';

const { content } = loadContent();
const opts = (o: Partial<GameOptions> = {}): GameOptions => ({
  durations: { choices: 60, conflicts: 40, feedback: 20 },
  rng: createRng(1),
  ...o,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Game', () => {
  it('balances roles and deals one card per player', () => {
    const g = new Game(content, opts());
    const ids = Array.from({ length: 20 }, (_, i) => g.join(`p${i}`).id);
    g.start();
    const counts = g.screenView().roleCounts;
    expect(Object.values(counts).reduce((a, b) => a + b)).toBe(20);
    for (const id of ids) expect(g.playerView(id)!.hand).toHaveLength(1);
    g.stop();
  });

  it('plays a full game to 2100 with the timer', () => {
    vi.useFakeTimers();
    const g = new Game(content, opts({ rng: createRng(2) }));
    const id = g.join('solo').id;
    g.start();
    for (let i = 0; i < 10; i++) {
      const card = g.playerView(id)!.hand[0];
      if (card) g.choose(id, card.instanceId, card.options[0]!.id);
      vi.advanceTimersByTime(130_000);
    }
    expect(g.phase).toBe('ended');
    expect(g.screenView().world.year).toBe(2100);
    expect(g.playerView(id)!.history[0]!.effects).toBeDefined();
  });

  it('hides choice effects until the game ends', () => {
    const g = new Game(content, opts());
    const id = g.join('a').id;
    g.start();
    const card = g.playerView(id)!.hand[0]!;
    g.choose(id, card.instanceId, card.options[0]!.id);
    expect(g.playerView(id)!.history).toHaveLength(1);
    expect(g.playerView(id)!.history[0]!.effects).toBeUndefined();
    g.stop();
  });

  it('refuses a second choice on the same card', () => {
    const g = new Game(content, opts());
    const id = g.join('a').id;
    g.start();
    const card = g.playerView(id)!.hand[0]!;
    g.choose(id, card.instanceId, card.options[0]!.id);
    expect(() => g.choose(id, card.instanceId, card.options[0]!.id)).toThrow('Carte inconnue');
    expect(g.screenView().choicesMade).toBe(1);
    g.stop();
  });

  it('refuses players beyond maxPlayers but lets known players back in', () => {
    const g = new Game(content, opts({ maxPlayers: 2 }));
    const a = g.join('a');
    g.join('b');
    expect(() => g.join('c')).toThrow('complète');
    expect(g.join('a', a.token).id).toBe(a.id);
  });
});

describe('reconnection', () => {
  it('a player who drops during choices gets back their card, score and role', () => {
    const g = new Game(content, opts());
    const p = g.join('alice');
    g.join('bob');
    g.start();
    const before = g.playerView(p.id)!;
    g.disconnect(p.id);
    expect(g.screenView().connectedCount).toBe(1);

    const back = g.join('ignored', p.token);
    expect(back.id).toBe(p.id);
    const after = g.playerView(p.id)!;
    expect(after.hand).toEqual(before.hand);
    expect(after.me).toEqual(before.me);
    expect(g.screenView().connectedCount).toBe(2);
    g.stop();
  });

  it('counts a player connected while any of their sockets is open', () => {
    const g = new Game(content, opts());
    const p = g.join('a');
    g.join('a', p.token); // second socket (reconnect before the old one timed out)
    g.disconnect(p.id); // old socket closes
    expect(g.screenView().connectedCount).toBe(1);
    g.disconnect(p.id);
    expect(g.screenView().connectedCount).toBe(0);
  });

  it('a player joining during conflicts can vote', () => {
    vi.useFakeTimers();
    const g = new Game(content, opts());
    g.join('a');
    g.start(); // 1900: the work-conditions vote has no condition
    g.next();
    expect(g.phase).toBe('conflicts');
    const late = g.join('late');
    const vote = g.playerView(late.id)!.vote!;
    expect(vote).not.toBeNull();
    g.castVote(late.id, vote.id, vote.options[1]!.id);
    expect(g.playerView(late.id)!.vote!.myChoice).toBe(vote.options[1]!.id);
  });

  it('reset invalidates old tokens: joining with one creates a new player', () => {
    const g = new Game(content, opts());
    const p = g.join('a');
    g.reset();
    const again = g.join('a', p.token);
    expect(again.id).not.toBe(p.id);
    expect(again.token).not.toBe(p.token);
    expect(g.screenView().playerCount).toBe(1);
  });
});

describe('persistence', () => {
  it('restores a game mid-era with identical views', () => {
    const g = new Game(content, opts());
    const ids = Array.from({ length: 12 }, (_, i) => g.join(`p${i}`).id);
    g.start();
    // play a full first era, then half of the second
    for (const id of ids) {
      const c = g.playerView(id)!.hand[0];
      if (c) g.choose(id, c.instanceId, c.options[0]!.id);
    }
    g.next();
    const vote = g.playerView(ids[0]!)!.vote!;
    g.castVote(ids[0]!, vote.id, vote.options[1]!.id);
    g.next();
    g.next();
    for (const id of ids.slice(0, 5)) {
      const c = g.playerView(id)!.hand[0];
      if (c) g.choose(id, c.instanceId, c.options[1]!.id);
    }

    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    const r = Game.restore(snap, content, opts());
    const strip = <T extends { phaseEndsAt: number | null }>(v: T) => ({ ...v, phaseEndsAt: 0 });
    expect(strip(r.screenView())).toEqual({ ...strip(g.screenView()), connectedCount: 0 });
    for (const id of ids) expect(strip(r.playerView(id)!)).toEqual(strip(g.playerView(id)!));
    g.stop();
    r.stop();
  });

  it('keeps the remaining time of a paused phase', () => {
    const g = new Game(content, opts());
    g.join('a');
    g.start();
    g.pause();
    const r = Game.restore(JSON.parse(JSON.stringify(g.snapshot())), content, opts());
    expect(r.screenView().phaseEndsAt).toBeNull();
    r.resume();
    expect(r.screenView().phaseEndsAt).toBeGreaterThan(Date.now() + 50_000);
    g.stop();
    r.stop();
  });
});

describe('content mechanics', () => {
  const base = loadContent().content;

  it('fires a matching global event once, shows it, and applies its effects', () => {
    const event = { id: 'e', title: 'Crise', text: 't', effects: { awareness: 10 } };
    const withEvent = new Game({ ...base, events: [event] }, opts());
    const without = new Game({ ...base, events: [] }, opts());
    for (const g of [withEvent, without]) {
      g.join('a');
      g.start();
      g.next(); // conflicts
      g.next(); // feedback: era resolved
    }
    expect(withEvent.screenView().events.map((e) => e.id)).toEqual(['e']);
    expect(withEvent.screenView().world.society.awareness).toBeGreaterThan(
      without.screenView().world.society.awareness,
    );
    withEvent.next(); // next era
    withEvent.next();
    withEvent.next();
    expect(withEvent.screenView().events).toEqual([]); // once per game
    withEvent.stop();
    without.stop();
  });

  it('sends a reply to the player who sent a cross-impact card', () => {
    const content = {
      ...base,
      cards: [
        {
          id: 'offer',
          roles: ['elite' as const],
          title: 'Offre',
          text: '',
          interactionOnly: false,
          options: [
            {
              id: 'bribe',
              label: 'Soudoyer',
              effects: {},
              score: 1,
              sends: { card: 'answer', toRole: 'politique' as const },
            },
            { id: 'no', label: 'Non', effects: {}, score: 0 },
          ],
        },
        {
          id: 'answer',
          roles: ['politique' as const],
          title: 'Enveloppe',
          text: '',
          interactionOnly: true,
          options: [
            { id: 'yes', label: 'Oui', effects: {}, score: 1, reply: 'Accepté !' },
            { id: 'no', label: 'Non', effects: {}, score: 0 },
          ],
        },
        ...base.cards.filter((c) => !c.roles.includes('elite')),
      ],
      roles: base.roles.map((r) => ({
        ...r,
        share: r.id === 'elite' || r.id === 'politique' ? 1 : 0.0001,
      })),
    };
    const g = new Game(content, opts());
    const a = g.join('a');
    const b = g.join('b');
    const [elite, pol] = g.playerView(a.id)!.me.role === 'elite' ? [a, b] : [b, a];
    g.start();
    const offer = g.playerView(elite.id)!.hand[0]!;
    g.choose(elite.id, offer.instanceId, 'bribe');
    const received = g.playerView(pol.id)!.hand.find((c) => c.cardId === 'answer')!;
    expect(received.fromPlayer).toBe(elite.name);
    g.choose(pol.id, received.instanceId, 'yes');
    expect(g.playerView(elite.id)!.outcomes).toContain('Accepté !');
    g.stop();
  });
});
