import type { TippingPointId } from '@jdlt/shared';

/** Screen-side presentation of tipping points (labels mirror packages/engine/src/config.ts). */
export const TIPPING: Record<
  TippingPointId,
  { label: string; icon: string; lonLat: [number, number]; explanation: string }
> = {
  // Placeholder explanations, to be reviewed by the designers.
  arctic_ice: {
    label: 'Banquise arctique',
    icon: '🧊',
    lonLat: [-95, 72],
    explanation:
      "La banquise d'été fond : l'océan, plus sombre que la glace, absorbe davantage de chaleur et accélère le réchauffement.",
  },
  permafrost: {
    label: 'Permafrost',
    icon: '🌡️',
    lonLat: [155, 67],
    explanation:
      'Le sol gelé de Sibérie dégèle et libère du méthane et du CO₂ : le réchauffement s’emballe tout seul.',
  },
  amazon: {
    label: 'Forêt amazonienne',
    icon: '🔥',
    lonLat: [-62, -6],
    explanation:
      "Trop chaude et trop sèche, l'Amazonie dépérit en savane et rejette du carbone au lieu d'en absorber.",
  },
  coral_reefs: {
    label: 'Récifs coralliens',
    icon: '🪸',
    lonLat: [147, -18],
    explanation:
      "L'océan trop chaud blanchit les coraux : un quart des espèces marines perd son habitat.",
  },
};
