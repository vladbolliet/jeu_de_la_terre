import { Fish, Flame, Snowflake, Thermometer, type LucideIcon } from 'lucide-react';
import type { TippingPointId } from '@jdlt/shared';

/** Screen-side presentation of tipping points (labels mirror packages/engine/src/config.ts). */
export const TIPPING: Record<
  TippingPointId,
  {
    label: string;
    icon: LucideIcon;
    lonLat: [number, number];
    explanation: string;
    /** Muted ~4 s clip under public/ (sources: public/videos/CREDITS.md). */
    video: string;
  }
> = {
  // Placeholder explanations, to be reviewed by the designers.
  arctic_ice: {
    video: 'videos/arctic_ice.mp4',
    label: 'Banquise arctique',
    icon: Snowflake,
    lonLat: [-95, 72],
    explanation:
      "La banquise d'été fond : l'océan, plus sombre que la glace, absorbe davantage de chaleur et accélère le réchauffement.",
  },
  permafrost: {
    video: 'videos/permafrost.mp4',
    label: 'Permafrost',
    icon: Thermometer,
    lonLat: [155, 67],
    explanation:
      'Le sol gelé de Sibérie dégèle et libère du méthane et du CO₂ : le réchauffement s’emballe tout seul.',
  },
  amazon: {
    video: 'videos/amazon.mp4',
    label: 'Forêt amazonienne',
    icon: Flame,
    lonLat: [-62, -6],
    explanation:
      "Trop chaude et trop sèche, l'Amazonie dépérit en savane et rejette du carbone au lieu d'en absorber.",
  },
  coral_reefs: {
    video: 'videos/coral_reefs.mp4',
    label: 'Récifs coralliens',
    icon: Fish,
    lonLat: [147, -18],
    explanation:
      "L'océan trop chaud blanchit les coraux : un quart des espèces marines perd son habitat.",
  },
};
