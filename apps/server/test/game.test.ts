import { describe, expect, it, vi } from 'vitest';
import { loadContent } from '@jdlt/engine/load';
import { createRng } from '@jdlt/engine';
import { Game } from '../src/game.ts';

const { content } = loadContent();
const durations = { choices: 60, conflicts: 40, feedback: 20 };

describe('Game', () => {
  it('balances roles and deals one card per player', () => {
    const g = new Game(content, durations, () => {}, createRng(1));
    const ids = Array.from({ length: 20 }, (_, i) => g.join(`p${i}`).id);
    g.start();
    const counts = g.screenView().roleCounts;
    expect(Object.values(counts).reduce((a, b) => a + b)).toBe(20);
    for (const id of ids) expect(g.playerView(id)!.hand).toHaveLength(1);
  });

  it('reconnects a player with the same token', () => {
    const g = new Game(content, durations, () => {});
    const p = g.join('alice');
    expect(g.join('ignored', p.token).id).toBe(p.id);
  });

  it('plays a full game to 2100 with the timer', () => {
    vi.useFakeTimers();
    const g = new Game(content, durations, () => {}, createRng(2));
    const id = g.join('solo').id;
    g.start();
    for (let i = 0; i < 10; i++) {
      const card = g.playerView(id)!.hand[0];
      if (card) g.choose(id, card.instanceId, card.options[0]!.id);
      vi.advanceTimersByTime(130_000);
    }
    expect(g.phase).toBe('ended');
    expect(g.screenView().world.year).toBe(2100);
    vi.useRealTimers();
  });
});
