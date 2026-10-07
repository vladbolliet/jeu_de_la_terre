import type { Condition, IndicatorKey, Role } from './content.ts';

export interface Climate {
  /** CO2 concentration, ppm */
  co2: number;
  /** Temperature anomaly vs pre-industrial, °C */
  temperature: number;
  /** Sea level rise since 1900, cm */
  seaLevel: number;
  /** 100 = 1900 level */
  biodiversity: number;
  /** Forest cover, 100 = 1900 level */
  forest: number;
}

export interface Society {
  /** 100 = 1900 level */
  gdp: number;
  /** 0–100 */
  employment: number;
  wellbeing: number;
  approval: number;
  awareness: number;
}

export type TippingPointId = 'arctic_ice' | 'permafrost' | 'amazon' | 'coral_reefs';

export interface EraSnapshot {
  year: number;
  climate: Climate;
  society: Society;
  emissions: number;
}

export interface World {
  /** Current year (start of the ongoing era, or END_YEAR when finished). */
  year: number;
  climate: Climate;
  society: Society;
  /** Persistent multiplier on baseline emissions, shaped by accumulated choices. */
  emissionsFactor: number;
  tippingPoints: TippingPointId[];
  history: EraSnapshot[];
}

export type Phase = 'lobby' | 'choices' | 'conflicts' | 'feedback' | 'ended';

export function indicatorValue(world: World, key: IndicatorKey): number {
  return key in world.climate
    ? world.climate[key as keyof Climate]
    : world.society[key as keyof Society];
}

/** True if the world satisfies a content `when` condition (no condition = true). */
export function conditionHolds(world: World, when: Condition | undefined): boolean {
  if (!when) return true;
  const value = indicatorValue(world, when.indicator);
  return (when.gt === undefined || value > when.gt) && (when.lt === undefined || value < when.lt);
}

export type RoleCounts = Record<Role, number>;
