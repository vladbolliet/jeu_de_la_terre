// Tuning knobs of the simulation. Designers: change these, then run `pnpm simulate`.
import type { TippingPointId } from '@jdlt/shared';

/** Baseline world CO2 emissions (Gt/yr) per era if players were neutral. Index = era index. */
export const BASELINE_EMISSIONS = [2.5, 4, 5, 10, 19, 25, 36, 40, 42, 42];

/** Baseline forest loss (points) per era. */
export const BASELINE_DEFORESTATION = [1, 1.5, 2, 3, 4, 4, 3.5, 3, 3, 3];

/** Baseline GDP growth per era (multiplier). */
export const BASELINE_GDP_GROWTH = [1.3, 1.2, 1.4, 1.6, 1.5, 1.5, 1.4, 1.3, 1.2, 1.2];

/** How much the average player emissions effect (-10…+10) changes the persistent emissions factor per era. */
export const EMISSIONS_SENSITIVITY = 0.04;
export const DEFORESTATION_SENSITIVITY = 0.4;
/** How much the average society effect (-10…+10) moves a 0–100 indicator per era. */
export const SOCIETY_SENSITIVITY = 1.5;

/** °C per doubling of CO2 (equilibrium climate sensitivity). */
export const CLIMATE_SENSITIVITY = 3;
/** Share of the gap to equilibrium temperature closed per era. */
export const TEMPERATURE_INERTIA = 0.6;
export const PREINDUSTRIAL_CO2 = 280;

export interface TippingPointDef {
  id: TippingPointId;
  label: string;
  /** Crossed when this returns true. */
  crossed: (t: { temperature: number; forest: number }) => boolean;
  /** Extra CO2 (ppm) per era once crossed. */
  extraCo2: number;
  /** Extra biodiversity loss per era once crossed. */
  extraBiodiversityLoss: number;
}

export const TIPPING_POINTS: TippingPointDef[] = [
  {
    id: 'coral_reefs',
    label: 'Récifs coralliens',
    crossed: (t) => t.temperature > 1.5,
    extraCo2: 0,
    extraBiodiversityLoss: 4,
  },
  {
    id: 'arctic_ice',
    label: 'Banquise arctique',
    crossed: (t) => t.temperature > 1.8,
    extraCo2: 3,
    extraBiodiversityLoss: 1,
  },
  {
    id: 'permafrost',
    label: 'Permafrost',
    crossed: (t) => t.temperature > 2.2,
    extraCo2: 8,
    extraBiodiversityLoss: 1,
  },
  {
    id: 'amazon',
    label: 'Forêt amazonienne',
    crossed: (t) => t.forest < 65 || t.temperature > 2.8,
    extraCo2: 6,
    extraBiodiversityLoss: 3,
  },
];
