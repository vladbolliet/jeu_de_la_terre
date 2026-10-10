/** Ed Hawkins' "warming stripes" palette (ColorBrewer RdBu), cold → hot. */
export const STRIPE_COLORS = [
  '#08306b',
  '#08519c',
  '#2171b5',
  '#4292c6',
  '#6baed6',
  '#9ecae1',
  '#c6dbef',
  '#fee0d2',
  '#fcbba1',
  '#fc9272',
  '#fb6a4a',
  '#ef3b2c',
  '#cb181d',
  '#99000d',
];

/** First year of each era, mirrors ERAS in packages/shared/src/content.ts (zod-free import). */
export const ERAS = [1900, 1920, 1940, 1960, 1980, 2000, 2020, 2040, 2060, 2080];
export const END_YEAR = 2100;

/**
 * Temperature anomaly (°C) mapped to the stripes palette like the real warming
 * stripes: 0 is still blue, ~+1 turns pink, +2 is red, +2.5 and above darkest.
 */
const COLD_T = -1;
const HOT_T = 2.5;
/** Temperature at which the screen tint is at its warmest. */
const MAX_HEAT_T = 3;

export function temperatureColor(t: number) {
  const x = Math.min(1, Math.max(0, (t - COLD_T) / (HOT_T - COLD_T)));
  return STRIPE_COLORS[Math.round(x * (STRIPE_COLORS.length - 1))]!;
}

/** 0 (pre-industrial) → 1 (+3 °C): drives the warming tint of the whole screen. */
export function heat(t: number) {
  return Math.min(1, Math.max(0, t / MAX_HEAT_T));
}
