// Pure world model: no I/O, no randomness. (world, decisions) -> new world.
import {
  ERAS,
  nextEraYear,
  type Climate,
  type Effects,
  type EffectKey,
  type TippingPointId,
  type World,
} from '@jdlt/shared';
import {
  BASELINE_DEFORESTATION,
  BASELINE_EMISSIONS,
  BASELINE_GDP_GROWTH,
  CAPTURE_SENSITIVITY,
  CLIMATE_SENSITIVITY,
  DEFORESTATION_SENSITIVITY,
  EMISSIONS_SENSITIVITY,
  MAX_CAPTURE_RATE,
  PREINDUSTRIAL_CO2,
  SOCIETY_SENSITIVITY,
  TEMPERATURE_INERTIA,
  TIPPING_POINTS,
} from './config.ts';
import type { DecisionWeight } from './regions.ts';

/** Rates in config.ts that are not yearly are calibrated on this era length. */
const REFERENCE_ERA_YEARS = 20;
/** GtCO2 per ppm of atmospheric CO2. */
const GT_PER_PPM = 7.8;
/** Share of emitted CO2 staying in the atmosphere at first (the rest goes to oceans and plants). */
const AIRBORNE_FRACTION = 0.75;
/** Share of the CO2 excess over pre-industrial absorbed back by natural sinks each year. */
const CO2_SINK = 0.014;

/** Today's world (2026). `climate` overrides it with real measurements (see the server). */
export function initialWorld(climate: Partial<Climate> = {}): World {
  return {
    year: ERAS[0],
    climate: {
      co2: 427,
      temperature: 1.45,
      seaLevel: 23,
      biodiversity: 90,
      forest: 84,
      ...climate,
    },
    society: { gdp: 100, employment: 60, wellbeing: 55, approval: 50, awareness: 35 },
    emissionsFactor: 1,
    captureRate: 0,
    tippingPoints: [],
    history: [],
  };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** One individual choice. `weight` scales each effect (see regionWeights); missing = 1. */
export interface Decision {
  effects: Effects;
  weight?: DecisionWeight;
}

/** Weighted mean of each effect key over a list of decisions (missing keys count as 0). */
export function meanEffects(decisions: Decision[], playerCount: number): Required<Effects> {
  const keys: EffectKey[] = [
    'emissions',
    'deforestation',
    'capture',
    'gdp',
    'employment',
    'wellbeing',
    'approval',
    'awareness',
  ];
  const n = Math.max(1, playerCount);
  const out = {} as Required<Effects>;
  for (const k of keys)
    out[k] = decisions.reduce((s, d) => s + (d.effects[k] ?? 0) * (d.weight?.[k] ?? 1), 0) / n;
  return out;
}

export interface EraInput {
  /** One entry per individual choice made this era. */
  decisions: Decision[];
  /** Number of players (inactive players dilute the average). */
  playerCount: number;
  /** Effects of collective votes, applied at full strength. */
  collective: Effects[];
}

export interface EraResult {
  world: World;
  emissions: number;
  newTippingPoints: TippingPointId[];
}

/** Resolves the current era and returns the world at the start of the next one. */
export function resolveEra(world: World, input: EraInput): EraResult {
  const eraIndex = ERAS.indexOf(world.year as (typeof ERAS)[number]);
  if (eraIndex < 0) throw new Error(`resolveEra: ${world.year} is not an era start`);

  const years = nextEraYear(world.year) - world.year;
  const k = years / REFERENCE_ERA_YEARS;

  const avg = meanEffects(input.decisions, input.playerCount);
  for (const c of input.collective) {
    for (const [k, v] of Object.entries(c) as [EffectKey, number][]) avg[k] += v;
  }

  const emissionsFactor = Math.max(
    0.05,
    world.emissionsFactor * (1 + avg.emissions * EMISSIONS_SENSITIVITY),
  );
  // Removal capacity lasts, like planted forests or capture plants (missing in old saves).
  const captureRate = Math.min(
    MAX_CAPTURE_RATE,
    Math.max(0, (world.captureRate ?? 0) + avg.capture * CAPTURE_SENSITIVITY),
  );
  // Net emissions (Gt/yr): negative once removals exceed what is still emitted.
  const emissions = (BASELINE_EMISSIONS[eraIndex] ?? 0) * emissionsFactor - captureRate;

  const c = { ...world.climate };
  const crossedBefore = new Set(world.tippingPoints);
  const feedbackCo2 = TIPPING_POINTS.filter((t) => crossedBefore.has(t.id)).reduce(
    (s, t) => s + t.extraCo2,
    0,
  );
  const feedbackBio = TIPPING_POINTS.filter((t) => crossedBefore.has(t.id)).reduce(
    (s, t) => s + t.extraBiodiversityLoss,
    0,
  );

  c.co2 += years * ((emissions * AIRBORNE_FRACTION) / GT_PER_PPM + feedbackCo2);
  c.co2 -= years * CO2_SINK * (world.climate.co2 - PREINDUSTRIAL_CO2);
  const equilibrium = CLIMATE_SENSITIVITY * Math.log2(c.co2 / PREINDUSTRIAL_CO2);
  c.temperature += (equilibrium - c.temperature) * (1 - (1 - TEMPERATURE_INERTIA) ** k);
  c.seaLevel += years * (0.1 + 0.2 * Math.max(0, c.temperature));
  c.forest = clamp(
    c.forest -
      years * (BASELINE_DEFORESTATION[eraIndex] ?? 0) -
      avg.deforestation * DEFORESTATION_SENSITIVITY,
  );
  c.biodiversity = clamp(
    c.biodiversity -
      k * (1 + Math.max(0, c.temperature - 1) * 3 + (100 - c.forest) * 0.03) -
      years * feedbackBio,
  );

  const s = { ...world.society };
  // Share of GDP lost to climate damage per 20 years.
  const damage = Math.max(0, c.temperature - 1.5) * 0.08;
  s.gdp *=
    (1 + (BASELINE_GDP_GROWTH[eraIndex] ?? 0)) ** years * (1 + avg.gdp * 0.02) * (1 - damage) ** k;
  s.employment = clamp(s.employment + avg.employment * SOCIETY_SENSITIVITY);
  s.wellbeing = clamp(s.wellbeing + 3 + avg.wellbeing * SOCIETY_SENSITIVITY - k * damage * 40);
  s.approval = clamp(s.approval + avg.approval * SOCIETY_SENSITIVITY);
  s.awareness = clamp(s.awareness + 2 + avg.awareness * SOCIETY_SENSITIVITY);

  const newTippingPoints = TIPPING_POINTS.filter(
    (t) => !crossedBefore.has(t.id) && t.crossed(c),
  ).map((t) => t.id);

  return {
    emissions,
    newTippingPoints,
    world: {
      year: nextEraYear(world.year),
      climate: c,
      society: s,
      emissionsFactor,
      captureRate,
      tippingPoints: [...world.tippingPoints, ...newTippingPoints],
      history: [
        ...world.history,
        { year: world.year, climate: world.climate, society: world.society, emissions },
      ],
    },
  };
}
