import {
  Axe,
  DoorOpen,
  EyeOff,
  Factory,
  Frown,
  HardHat,
  Megaphone,
  Smile,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  TreeDeciduous,
  TrendingDown,
  TrendingUp,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { ChoiceRecord, EffectKey, Effects } from '@jdlt/shared';

/** One effect of a choice, put into words: players never see the numbers. */
export interface EffectLine {
  icon: LucideIcon;
  text: string;
  /** Whether this is good or bad news for the planet / society. */
  tone: 'good' | 'bad';
}

interface Wording {
  /** Shown when the effect is positive / negative: [icon, text]. */
  more: [LucideIcon, string];
  less: [LucideIcon, string];
  /** true when a positive value is bad news (pollution drivers). */
  moreIsBad: boolean;
}

const WORDING: Record<EffectKey, Wording> = {
  emissions: { more: [Factory, 'plus de CO₂'], less: [Wind, 'moins de CO₂'], moreIsBad: true },
  capture: {
    more: [Sprout, "du CO₂ retiré de l'air"],
    less: [Sprout, "moins de CO₂ retiré de l'air"],
    moreIsBad: false,
  },
  deforestation: {
    more: [Axe, 'plus de forêts détruites'],
    less: [TreeDeciduous, 'moins de forêts détruites'],
    moreIsBad: true,
  },
  gdp: {
    more: [TrendingUp, 'plus de croissance'],
    less: [TrendingDown, 'moins de croissance'],
    moreIsBad: false,
  },
  employment: {
    more: [HardHat, "plus d'emplois"],
    less: [DoorOpen, "moins d'emplois"],
    moreIsBad: false,
  },
  wellbeing: {
    more: [Smile, 'plus de bien-être'],
    less: [Frown, 'moins de bien-être'],
    moreIsBad: false,
  },
  approval: {
    more: [ThumbsUp, 'plus de confiance envers les politiques'],
    less: [ThumbsDown, 'moins de confiance envers les politiques'],
    moreIsBad: false,
  },
  awareness: {
    more: [Megaphone, 'un public plus sensibilisé'],
    less: [EyeOff, 'un public moins sensibilisé'],
    moreIsBad: false,
  },
};

/** Effects are on a -10…+10 scale: 1 is a nudge, 5 and above is a lot. */
function intensity(value: number): string {
  const size = Math.abs(value);
  if (size >= 5) return 'beaucoup ';
  if (size < 2) return 'un peu ';
  return '';
}

/** Translates the effects of a choice into icons and words, strongest first. */
export function describeEffects(effects: Effects): EffectLine[] {
  return (Object.keys(WORDING) as EffectKey[])
    .map((key) => ({ key, value: effects[key] ?? 0 }))
    .filter((e) => e.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .map(({ key, value }) => {
      const w = WORDING[key];
      const [icon, text] = value > 0 ? w.more : w.less;
      // "un public plus sensibilisé" reads better without the intensity prefix glued to "un".
      const prefix = text.startsWith('un ') ? '' : intensity(value);
      return { icon, text: prefix + text, tone: value > 0 === w.moreIsBad ? 'bad' : 'good' };
    });
}

/** How the player's choices weighed on emissions over the whole game. */
export function emissionsBalance(history: ChoiceRecord[]) {
  let total = 0;
  let polluting = 0;
  let clean = 0;
  for (const h of history) {
    // CO2 removed from the air counts as clean as CO2 not emitted.
    const e = (h.effects?.emissions ?? 0) - (h.effects?.capture ?? 0);
    total += e;
    if (e > 0) polluting++;
    if (e < 0) clean++;
  }
  return { trend: Math.sign(total) as -1 | 0 | 1, polluting, clean };
}
