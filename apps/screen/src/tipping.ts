import type { TippingPointId } from '@jdlt/shared';

/** Screen-side presentation of tipping points (labels mirror packages/engine/src/config.ts). */
export const TIPPING: Record<
  TippingPointId,
  { label: string; icon: string; lonLat: [number, number] }
> = {
  arctic_ice: { label: 'Banquise arctique', icon: '🧊', lonLat: [-95, 72] },
  permafrost: { label: 'Permafrost', icon: '🌡️', lonLat: [155, 67] },
  amazon: { label: 'Forêt amazonienne', icon: '🔥', lonLat: [-62, -6] },
  coral_reefs: { label: 'Récifs coralliens', icon: '🪸', lonLat: [147, -18] },
};
