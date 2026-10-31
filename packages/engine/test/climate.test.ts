import { describe, expect, it } from 'vitest';
import { ERAS } from '@jdlt/shared';
import { initialWorld, meanEffects, resolveEra } from '../src/climate.ts';

const run = (emissions: number) => {
  let w = initialWorld();
  for (const _ of ERAS)
    w = resolveEra(w, {
      decisions: [{ effects: { emissions } }],
      playerCount: 1,
      collective: [],
    }).world;
  return w;
};

describe('resolveEra', () => {
  it('reaches 2100 after 10 eras', () => {
    expect(run(0).year).toBe(2100);
    expect(run(0).history).toHaveLength(10);
  });

  it('neutral play warms the planet (the baseline is not sustainable)', () => {
    expect(run(0).climate.temperature).toBeGreaterThan(1.5);
  });

  it('a very green game makes the temperature go back down before 2100', () => {
    let w = initialWorld();
    let peak = w.climate.temperature;
    for (const _ of ERAS) {
      w = resolveEra(w, {
        decisions: [{ effects: { emissions: -5, capture: 3 } }],
        playerCount: 1,
        collective: [],
      }).world;
      peak = Math.max(peak, w.climate.temperature);
    }
    expect(w.climate.temperature).toBeLessThan(peak - 0.2);
  });

  it('polluting choices warm more than green ones', () => {
    expect(run(8).climate.temperature).toBeGreaterThan(run(-8).climate.temperature);
  });
});

describe('meanEffects', () => {
  it('applies decision weights per effect', () => {
    const avg = meanEffects(
      [
        { effects: { emissions: 4, gdp: 2 }, weight: { emissions: 2 } },
        { effects: { emissions: 4, gdp: 2 } },
      ],
      2,
    );
    expect(avg.emissions).toBe(6);
    expect(avg.gdp).toBe(2);
  });
});
