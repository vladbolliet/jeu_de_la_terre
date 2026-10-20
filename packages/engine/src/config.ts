// Tuning knobs of the simulation. Designers: change these, then run `pnpm simulate`.
import type { TippingPointId } from '@jdlt/shared';

// Eras have different lengths (see ERAS), so baselines are yearly rates. Index = era index.

/** Baseline world CO2 emissions (Gt/yr) if players were neutral: roughly today's policies. */
export const BASELINE_EMISSIONS = [41, 41, 40, 39, 37, 35, 32, 29, 26, 23];

/** Baseline forest loss (points per year). */
export const BASELINE_DEFORESTATION = [0.15, 0.15, 0.15, 0.15, 0.14, 0.14, 0.13, 0.12, 0.12, 0.12];

/** Baseline GDP growth (per year). */
export const BASELINE_GDP_GROWTH = [0.03, 0.03, 0.028, 0.026, 0.024, 0.022, 0.02, 0.018, 0.016, 0.015];

/** How much the average player emissions effect (-10…+10) changes the persistent emissions factor per era (whatever its length). */
export const EMISSIONS_SENSITIVITY = 0.07;
export const DEFORESTATION_SENSITIVITY = 0.4;
/** How much the average society effect (-10…+10) moves a 0–100 indicator per era. */
export const SOCIETY_SENSITIVITY = 1.5;

/** °C per doubling of CO2 (equilibrium climate sensitivity). */
export const CLIMATE_SENSITIVITY = 3;
/** Share of the gap to equilibrium temperature closed per 20 years. */
export const TEMPERATURE_INERTIA = 0.6;
export const PREINDUSTRIAL_CO2 = 280;

export interface TippingPointDef {
  id: TippingPointId;
  label: string;
  /** Crossed when this returns true. */
  crossed: (t: { temperature: number; forest: number }) => boolean;
  /** Extra CO2 (ppm per year) once crossed. */
  extraCo2: number;
  /** Extra biodiversity loss (points per year) once crossed. */
  extraBiodiversityLoss: number;
}

export const TIPPING_POINTS: TippingPointDef[] = [
  {
    id: 'coral_reefs',
    label: 'Récifs coralliens',
    crossed: (t) => t.temperature > 1.5,
    extraCo2: 0,
    extraBiodiversityLoss: 0.2,
  },
  {
    id: 'arctic_ice',
    label: 'Banquise arctique',
    crossed: (t) => t.temperature > 1.8,
    extraCo2: 0.15,
    extraBiodiversityLoss: 0.05,
  },
  {
    id: 'permafrost',
    label: 'Permafrost',
    crossed: (t) => t.temperature > 2.2,
    extraCo2: 0.4,
    extraBiodiversityLoss: 0.05,
  },
  {
    id: 'amazon',
    label: 'Forêt amazonienne',
    crossed: (t) => t.forest < 65 || t.temperature > 2.8,
    extraCo2: 0.3,
    extraBiodiversityLoss: 0.15,
  },
];
