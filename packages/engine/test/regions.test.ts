import { describe, expect, it } from 'vitest';
import { ERAS, REGIONS, type Region } from '@jdlt/shared';
import {
  COUNTRIES,
  emissionsFactors,
  nextRegion,
  pickCountry,
  populationShare,
  regionWeights,
} from '../src/regions.ts';
import { createRng } from '../src/rng.ts';

const fill = (n: number, eraIndex = 0) => {
  const counts: Record<Region, number> = { riche: 0, emergent: 0, developpement: 0 };
  for (let i = 0; i < n; i++) counts[nextRegion(eraIndex, counts)]++;
  return counts;
};

describe('regions', () => {
  it('population shares sum to 1 in every era', () => {
    ERAS.forEach((_, i) => {
      expect(REGIONS.reduce((s, r) => s + populationShare(r, i), 0)).toBeCloseTo(1, 5);
    });
  });

  it('emission factors average to 1 over the world population', () => {
    ERAS.forEach((_, i) => {
      const f = emissionsFactors(i);
      expect(REGIONS.reduce((s, r) => s + populationShare(r, i) * f[r], 0)).toBeCloseTo(1, 5);
      expect(f.riche).toBeGreaterThan(f.developpement);
    });
  });

  it('fills groups by population, even in small games', () => {
    expect(fill(8)).toEqual({ riche: 1, emergent: 3, developpement: 4 });
    expect(fill(100)).toEqual({ riche: 16, emergent: 35, developpement: 49 });
  });

  it('weights keep the world average when every player makes the same choice', () => {
    for (const n of [5, 8, 30, 100]) {
      const counts = fill(n);
      const w = regionWeights(0, counts);
      const sum = REGIONS.reduce((s, r) => s + counts[r] * (w[r].emissions ?? 0), 0);
      expect(sum / n).toBeCloseTo(1, 5);
    }
  });

  it('a rich player weighs more on emissions than a developing one', () => {
    const w = regionWeights(0, fill(100));
    expect(w.riche.emissions!).toBeGreaterThan(4 * w.developpement.emissions!);
  });

  it('picks countries of the requested group', () => {
    const rng = createRng(1);
    for (const r of REGIONS) {
      const c = pickCountry(r, rng);
      expect(COUNTRIES).toContain(c);
      expect(c.region).toBe(r);
    }
  });
});
