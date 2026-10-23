// Groups of countries: population, emissions per person and the weight of each player's choices.
// Pure data and functions. Figures are orders of magnitude, see docs/PLAN-REGIONS.md for sources.
// Index of every per-era array = era index (see ERAS).
import { REGIONS, type EffectKey, type Region } from '@jdlt/shared';

/** World population (billions) during each era. UN World Population Prospects 2024, medium. */
export const WORLD_POPULATION = [8.3, 8.55, 8.85, 9.1, 9.35, 9.65, 10.0, 10.2, 10.3, 10.3];

/** Share of the world population living in each group, per era (developing countries grow). */
export const POPULATION_SHARE: Record<Region, number[]> = {
  riche: [0.155, 0.15, 0.147, 0.143, 0.14, 0.137, 0.132, 0.128, 0.125, 0.122],
  emergent: [0.35, 0.345, 0.337, 0.33, 0.322, 0.314, 0.3, 0.287, 0.275, 0.265],
  developpement: [0.495, 0.505, 0.516, 0.527, 0.538, 0.549, 0.568, 0.585, 0.6, 0.613],
};

/**
 * CO2 emissions per person relative to the world average, per era (Global Carbon Project 2024:
 * ~10 t in rich countries, ~7.5 t in emerging ones, ~1.6 t in developing ones, world ~5 t).
 * They converge over time. The developing group is derived so that the world average stays 1.
 */
const EMISSIONS_FACTOR: Record<'riche' | 'emergent', number[]> = {
  riche: [2.0, 1.95, 1.85, 1.75, 1.65, 1.55, 1.45, 1.35, 1.3, 1.25],
  emergent: [1.5, 1.5, 1.45, 1.4, 1.35, 1.3, 1.25, 1.2, 1.15, 1.1],
};

/** Forest loss per person relative to the world average: tropical forests are in emerging and developing countries. */
const DEFORESTATION_FACTOR: Record<'riche' | 'emergent', number> = { riche: 0.3, emergent: 1.3 };

const eraValue = (values: number[], eraIndex: number) =>
  values[Math.min(Math.max(0, eraIndex), values.length - 1)]!;

export function populationShare(region: Region, eraIndex: number): number {
  return eraValue(POPULATION_SHARE[region], eraIndex);
}

/** Factor of the developing group so that the population-weighted world average is 1. */
function withDevelopingFactor(rich: number, emerging: number, eraIndex: number) {
  const r = populationShare('riche', eraIndex);
  const e = populationShare('emergent', eraIndex);
  const d = populationShare('developpement', eraIndex);
  return { riche: rich, emergent: emerging, developpement: (1 - r * rich - e * emerging) / d };
}

/** Emissions per person relative to the world average, per group. */
export function emissionsFactors(eraIndex: number): Record<Region, number> {
  return withDevelopingFactor(
    eraValue(EMISSIONS_FACTOR.riche, eraIndex),
    eraValue(EMISSIONS_FACTOR.emergent, eraIndex),
    eraIndex,
  );
}

export function deforestationFactors(eraIndex: number): Record<Region, number> {
  return withDevelopingFactor(DEFORESTATION_FACTOR.riche, DEFORESTATION_FACTOR.emergent, eraIndex);
}

/** Share of world CO2 emissions of each group (population share × emissions per person). */
export function emissionsShare(region: Region, eraIndex: number): number {
  return populationShare(region, eraIndex) * emissionsFactors(eraIndex)[region];
}

/** Multiplier applied to each effect of a choice (missing keys = 1). */
export type DecisionWeight = Partial<Record<EffectKey, number>>;

/**
 * Weight of one choice made by a player of each group, given how many players each group has.
 * - Every effect is scaled by population share ÷ player share, so a group with too few players
 *   for its population (small games) still counts for its real population.
 * - Emissions and deforestation are also scaled by the group's factor per person.
 * A group without players counts as neutral (its effects are 0).
 */
export function regionWeights(
  eraIndex: number,
  playersByRegion: Record<Region, number>,
): Record<Region, DecisionWeight> {
  const total = REGIONS.reduce((s, r) => s + playersByRegion[r], 0);
  const emissions = emissionsFactors(eraIndex);
  const deforestation = deforestationFactors(eraIndex);
  const out = {} as Record<Region, DecisionWeight>;
  for (const r of REGIONS) {
    const players = playersByRegion[r];
    const representation = players > 0 ? populationShare(r, eraIndex) / (players / total) : 0;
    out[r] = {
      emissions: representation * emissions[r],
      deforestation: representation * deforestation[r],
      gdp: representation,
      employment: representation,
      wellbeing: representation,
      approval: representation,
      awareness: representation,
    };
  }
  return out;
}

/** Number of people one player of this group stands for this era (display only). */
export function peoplePerPlayer(region: Region, eraIndex: number, players: number): number {
  if (players <= 0) return 0;
  return (eraValue(WORLD_POPULATION, eraIndex) * 1e9 * populationShare(region, eraIndex)) / players;
}

export interface Country {
  name: string;
  region: Region;
  /** Millions of inhabitants (~2024), used to draw a player's country. */
  population: number;
  lon: number;
  lat: number;
}

/** Countries a player can live in, about 80 % of the world population. */
export const COUNTRIES: Country[] = [
  { name: 'États-Unis', region: 'riche', population: 340, lon: -98, lat: 39 },
  { name: 'Russie', region: 'riche', population: 144, lon: 60, lat: 57 },
  { name: 'Japon', region: 'riche', population: 124, lon: 138, lat: 36 },
  { name: 'Allemagne', region: 'riche', population: 84, lon: 10, lat: 51 },
  { name: 'Royaume-Uni', region: 'riche', population: 69, lon: -2, lat: 53 },
  { name: 'France', region: 'riche', population: 68, lon: 2, lat: 47 },
  { name: 'Italie', region: 'riche', population: 59, lon: 12, lat: 43 },
  { name: 'Corée du Sud', region: 'riche', population: 52, lon: 128, lat: 36 },
  { name: 'Espagne', region: 'riche', population: 48, lon: -4, lat: 40 },
  { name: 'Canada', region: 'riche', population: 40, lon: -106, lat: 56 },
  { name: 'Pologne', region: 'riche', population: 37, lon: 19, lat: 52 },
  { name: 'Arabie saoudite', region: 'riche', population: 33, lon: 45, lat: 24 },
  { name: 'Australie', region: 'riche', population: 27, lon: 134, lat: -25 },
  { name: 'Chili', region: 'riche', population: 20, lon: -71, lat: -35 },
  { name: 'Chine', region: 'emergent', population: 1410, lon: 104, lat: 35 },
  { name: 'Indonésie', region: 'emergent', population: 278, lon: 113, lat: -1 },
  { name: 'Brésil', region: 'emergent', population: 216, lon: -52, lat: -10 },
  { name: 'Mexique', region: 'emergent', population: 129, lon: -102, lat: 23 },
  { name: 'Iran', region: 'emergent', population: 89, lon: 53, lat: 32 },
  { name: 'Turquie', region: 'emergent', population: 85, lon: 35, lat: 39 },
  { name: 'Thaïlande', region: 'emergent', population: 72, lon: 101, lat: 15 },
  { name: 'Afrique du Sud', region: 'emergent', population: 62, lon: 24, lat: -29 },
  { name: 'Colombie', region: 'emergent', population: 52, lon: -74, lat: 4 },
  { name: 'Argentine', region: 'emergent', population: 46, lon: -64, lat: -34 },
  { name: 'Pérou', region: 'emergent', population: 34, lon: -75, lat: -10 },
  { name: 'Malaisie', region: 'emergent', population: 34, lon: 102, lat: 4 },
  { name: 'Inde', region: 'developpement', population: 1430, lon: 79, lat: 22 },
  { name: 'Pakistan', region: 'developpement', population: 240, lon: 69, lat: 30 },
  { name: 'Nigeria', region: 'developpement', population: 224, lon: 8, lat: 9 },
  { name: 'Bangladesh', region: 'developpement', population: 173, lon: 90, lat: 24 },
  { name: 'Éthiopie', region: 'developpement', population: 126, lon: 39, lat: 9 },
  { name: 'Philippines', region: 'developpement', population: 117, lon: 122, lat: 12 },
  { name: 'Égypte', region: 'developpement', population: 113, lon: 30, lat: 27 },
  { name: 'RD Congo', region: 'developpement', population: 102, lon: 23, lat: -3 },
  { name: 'Viêt Nam', region: 'developpement', population: 99, lon: 106, lat: 16 },
  { name: 'Tanzanie', region: 'developpement', population: 67, lon: 35, lat: -6 },
  { name: 'Kenya', region: 'developpement', population: 55, lon: 38, lat: 0 },
  { name: 'Myanmar', region: 'developpement', population: 54, lon: 96, lat: 21 },
  { name: 'Ouganda', region: 'developpement', population: 48, lon: 32, lat: 1 },
  { name: 'Soudan', region: 'developpement', population: 48, lon: 30, lat: 15 },
  { name: 'Maroc', region: 'developpement', population: 38, lon: -6, lat: 32 },
  { name: 'Mozambique', region: 'developpement', population: 34, lon: 35, lat: -18 },
  { name: 'Népal', region: 'developpement', population: 30, lon: 84, lat: 28 },
  { name: 'Madagascar', region: 'developpement', population: 30, lon: 47, lat: -19 },
  { name: 'Niger', region: 'developpement', population: 27, lon: 8, lat: 17 },
  { name: 'Haïti', region: 'developpement', population: 12, lon: -72, lat: 19 },
];

/** Picks a country of the group, with a probability proportional to its population. */
export function pickCountry(region: Region, rng: () => number): Country {
  const pool = COUNTRIES.filter((c) => c.region === region);
  const total = pool.reduce((s, c) => s + c.population, 0);
  let x = rng() * total;
  for (const c of pool) {
    x -= c.population;
    if (x < 0) return c;
  }
  return pool[pool.length - 1]!;
}

/** The group whose player count is furthest below its population share (fills groups fairly). */
export function nextRegion(eraIndex: number, playersByRegion: Record<Region, number>): Region {
  const n = REGIONS.reduce((s, r) => s + playersByRegion[r], 0) + 1;
  let best: Region = REGIONS[0];
  let bestDeficit = -Infinity;
  for (const r of REGIONS) {
    const deficit = populationShare(r, eraIndex) * n - playersByRegion[r];
    if (deficit > bestDeficit) [best, bestDeficit] = [r, deficit];
  }
  return best;
}
