import { Flame, Landmark, Mountain, PawPrint, TriangleAlert, Tornado, Waves, type LucideIcon } from 'lucide-react';
import type { Climate, ScreenView } from '@jdlt/shared';
import { TIPPING } from './tipping.ts';

/** A full-screen muted clip played at the start of the feedback phase (see ClipPlayer.tsx). */
export interface Clip {
  key: string;
  /** Path under public/ (sources: public/videos/CREDITS.md). */
  video: string;
  kind: 'tipping' | 'extinct' | 'disaster' | 'history';
  kicker: string;
  kickerIcon: LucideIcon;
  title: string;
  icon?: LucideIcon;
  text: string;
  /** Big stamp over the footage, e.g. for extinct species. */
  stamp?: string;
}

/** All clips are cut to this length; a clip is only started if it can play to the end. */
export const CLIP_MS = 6000;

// Placeholder texts, to be reviewed by the designers. These clips are screen-only
// presentation: they react to indicators the server already resolved and change nothing.

/** Fires once, the era its indicator first crosses the threshold. */
const DISASTERS: {
  key: string;
  indicator: keyof Climate;
  above: number;
  title: string;
  icon: LucideIcon;
  text: string;
}[] = [
  {
    key: 'wildfire',
    indicator: 'temperature',
    above: 1.5,
    title: 'Mégafeux',
    icon: Flame,
    text: 'Chaleur et sécheresse record : des incendies géants ravagent forêts et villages.',
  },
  {
    key: 'tornado',
    indicator: 'temperature',
    above: 2,
    title: 'Tempêtes extrêmes',
    icon: Tornado,
    text: 'Plus de chaleur, plus d’énergie dans l’atmosphère : orages et tornades frappent plus fort.',
  },
  {
    key: 'tsunami',
    indicator: 'seaLevel',
    above: 50,
    title: 'Submersion marine',
    icon: Waves,
    text: 'La mer a monté de 50 cm : à chaque tempête, les vagues envahissent les villes côtières.',
  },
];

/** Species declared extinct, one per biodiversity threshold crossed (biodiversity: 100 = 1900). */
const EXTINCTIONS: { key: string; below: number; title: string; text: string }[] = [
  {
    key: 'orangutan',
    below: 90,
    title: 'Orang-outan',
    text: 'Sa forêt a été rasée pour l’huile de palme et le bois. Dans votre monde, il a disparu.',
  },
  {
    key: 'polar_bear',
    below: 75,
    title: 'Ours polaire',
    text: 'Sans banquise, il ne peut plus chasser le phoque. Dans votre monde, il a disparu.',
  },
  {
    key: 'emperor_penguin',
    below: 60,
    title: 'Manchot empereur',
    text: 'La glace où il élève ses petits fond trop tôt. Dans votre monde, il a disparu.',
  },
];

/** Real events shown in the feedback that ends at `year`, whatever the players did. */
const HISTORY: (Omit<Clip, 'video' | 'kind' | 'kickerIcon'> & { year: number })[] = [
  {
    key: 'thylacine',
    year: 1940,
    kicker: 'Fait réel · 1936',
    title: 'Tigre de Tasmanie',
    icon: PawPrint,
    text: 'Chassé jusqu’au dernier : le dernier tigre de Tasmanie meurt au zoo de Hobart en 1936.',
    stamp: 'Espèce éteinte',
  },
  {
    key: 'volcano',
    year: 2000,
    kicker: 'Fait réel · 1991',
    title: 'Éruption du Pinatubo',
    icon: Mountain,
    text: 'Ses cendres voilent le soleil : la Terre se refroidit d’environ 0,5 °C pendant deux ans, puis le réchauffement reprend.',
  },
];

const video = (key: string) => `videos/${key}.mp4`;

/**
 * Clips for the era that just ended, most important first.
 * Only meaningful during feedback: history[last] is then the era just played.
 */
export function clipsForEra(view: ScreenView): Clip[] {
  const now = view.world.climate;
  const before = view.world.history.at(-1)?.climate;
  const crossedUp = (k: keyof Climate, v: number) => !!before && before[k] < v && now[k] >= v;
  const crossedDown = (k: keyof Climate, v: number) => !!before && before[k] >= v && now[k] < v;

  const tipping: Clip[] = view.newTippingPoints.map((id) => ({
    key: id,
    video: TIPPING[id].video,
    kind: 'tipping',
    kicker: 'Point de bascule franchi',
    kickerIcon: TriangleAlert,
    title: TIPPING[id].label,
    icon: TIPPING[id].icon,
    text: TIPPING[id].explanation,
  }));
  const extinct: Clip[] = EXTINCTIONS.filter((e) => crossedDown('biodiversity', e.below)).map(
    (e) => ({
      key: e.key,
      video: video(e.key),
      kind: 'extinct',
      kicker: `Biodiversité : −${Math.round(100 - now.biodiversity)} % depuis 1900`,
      kickerIcon: PawPrint,
      title: e.title,
      text: e.text,
      stamp: 'Espèce éteinte',
    }),
  );
  const disasters: Clip[] = DISASTERS.filter((d) => crossedUp(d.indicator, d.above)).map((d) => ({
    key: d.key,
    video: video(d.key),
    kind: 'disaster',
    kicker: 'Catastrophe climatique',
    kickerIcon: TriangleAlert,
    title: d.title,
    icon: d.icon,
    text: d.text,
  }));
  const history: Clip[] = HISTORY.filter((h) => h.year === view.world.year).map((h) => ({
    ...h,
    video: video(h.key),
    kind: 'history',
    kickerIcon: Landmark,
  }));
  return [...tipping, ...extinct, ...disasters, ...history];
}
