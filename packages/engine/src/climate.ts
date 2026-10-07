// Pure world model: no I/O, no randomness. (world, decisions) -> new world.
import {
  ERAS,
  END_YEAR,
  type Effects,
  type EffectKey,
  type TippingPointId,
  type World,
} from '@jdlt/shared';
import {
  BASELINE_DEFORESTATION,
  BASELINE_EMISSIONS,
  BASELINE_GDP_GROWTH,
  CLIMATE_SENSITIVITY,
  DEFORESTATION_SENSITIVITY,
  EMISSIONS_SENSITIVITY,
  PREINDUSTRIAL_CO2,
  SOCIETY_SENSITIVITY,
  TEMPERATURE_INERTIA,
  TIPPING_POINTS,
} from './config.ts';

const YEARS_PER_ERA = 20;
/** GtCO2 per ppm of atmospheric CO2. */
const GT_PER_PPM = 7.8;
/** Share of emitted CO2 staying in the atmosphere. */
const AIRBORNE_FRACTION = 0.5;

export function initialWorld(): World {
  return {
    year: ERAS[0],
    climate: { co2: 296, temperature: 0.1, seaLevel: 0, biodiversity: 100, forest: 100 },
    society: { gdp: 100, employment: 60, wellbeing: 40, approval: 50, awareness: 5 },
    emissionsFactor: 1,
    tippingPoints: [],
    history: [],
  };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** Mean of each effect key over a list of decisions (missing keys count as 0). */
export function meanEffects(decisions: Effects[], playerCount: number): Required<Effects> {
  const keys: EffectKey[] = [
    'emissions',
    'deforestation',
    'gdp',
    'employment',
    'wellbeing',
    'approval',
    'awareness',
  ];
  const n = Math.max(1, playerCount);
  const out = {} as Required<Effects>;
  for (const k of keys) out[k] = decisions.reduce((s, d) => s + (d[k] ?? 0), 0) / n;
  return out;
}

export interface EraInput {
  /** One entry per individual choice made this era. */
  decisions: Effects[];
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

  const avg = meanEffects(input.decisions, input.playerCount);
  for (const c of input.collective) {
    for (const [k, v] of Object.entries(c) as [EffectKey, number][]) avg[k] += v;
  }

  const emissionsFactor = Math.max(
    0.05,
    world.emissionsFactor * (1 + avg.emissions * EMISSIONS_SENSITIVITY),
  );
  const emissions = (BASELINE_EMISSIONS[eraIndex] ?? 0) * emissionsFactor;

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

  c.co2 += (emissions * YEARS_PER_ERA * AIRBORNE_FRACTION) / GT_PER_PPM + feedbackCo2;
  const equilibrium = CLIMATE_SENSITIVITY * Math.log2(c.co2 / PREINDUSTRIAL_CO2);
  c.temperature += (equilibrium - c.temperature) * TEMPERATURE_INERTIA;
  c.seaLevel += YEARS_PER_ERA * (0.1 + 0.2 * Math.max(0, c.temperature));
  c.forest = clamp(
    c.forest -
      (BASELINE_DEFORESTATION[eraIndex] ?? 0) -
      avg.deforestation * DEFORESTATION_SENSITIVITY,
  );
  c.biodiversity = clamp(
    c.biodiversity - 1 - Math.max(0, c.temperature - 1) * 3 - (100 - c.forest) * 0.03 - feedbackBio,
  );

  const s = { ...world.society };
  const damage = Math.max(0, c.temperature - 1.5) * 0.08;
  s.gdp *= (BASELINE_GDP_GROWTH[eraIndex] ?? 1) * (1 + avg.gdp * 0.02) * (1 - damage);
  s.employment = clamp(s.employment + avg.employment * SOCIETY_SENSITIVITY);
  s.wellbeing = clamp(s.wellbeing + 3 + avg.wellbeing * SOCIETY_SENSITIVITY - damage * 40);
  s.approval = clamp(s.approval + avg.approval * SOCIETY_SENSITIVITY);
  s.awareness = clamp(s.awareness + 2 + avg.awareness * SOCIETY_SENSITIVITY);

  const newTippingPoints = TIPPING_POINTS.filter(
    (t) => !crossedBefore.has(t.id) && t.crossed(c),
  ).map((t) => t.id);

  return {
    emissions,
    newTippingPoints,
    world: {
      year: ERAS[eraIndex + 1] ?? END_YEAR,
      climate: c,
      society: s,
      emissionsFactor,
      tippingPoints: [...world.tippingPoints, ...newTippingPoints],
      history: [
        ...world.history,
        { year: world.year, climate: world.climate, society: world.society, emissions },
      ],
    },
  };
}
