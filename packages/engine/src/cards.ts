// Dealing cards without repeats. Pure: the caller passes the random source.
import { ERAS, type Card, type Effects, type Region, type Role } from '@jdlt/shared';

/** Cards that can be dealt at random to a player of this role and group (any era). */
export function dealableCards(cards: Card[], role: Role, region: Region): Card[] {
  return cards.filter(
    (c) =>
      !c.interactionOnly && c.roles.includes(role) && (!c.regions || c.regions.includes(region)),
  );
}

const available = (card: Card, year: number) =>
  !card.eras || (card.eras as readonly number[]).includes(year);

/**
 * Picks a card the player has never seen for the era starting at `year`, or undefined if none is
 * left. Among the cards that still leave a different card for every later era, the ones that can
 * come out in few of the remaining eras are favoured, keeping the flexible ones for later.
 */
export function pickFreshCard(
  cards: Card[],
  year: number,
  seen: ReadonlySet<string>,
  rng: () => number,
): Card | undefined {
  const fresh = cards.filter((c) => !seen.has(c.id));
  const pool = fresh.filter((c) => available(c, year));
  if (!pool.length) return undefined;
  const later = ERAS.filter((y) => y > year);
  // Weighted shuffle: scarce cards tend to come first.
  const order = pool
    .map((c) => {
      const eras = [year, ...later].filter((y) => available(c, y)).length;
      return { c, key: rng() ** eras };
    })
    .sort((a, b) => b.key - a.key)
    .map((x) => x.c);
  const leavesEnough = (c: Card) =>
    matchedEras(
      fresh.filter((f) => f !== c),
      later,
    ) === later.length;
  return order.find(leavesEnough) ?? order[0];
}

/** How many of these eras can each get a different card (max matching eras → cards). */
function matchedEras(cards: Card[], years: readonly number[]): number {
  const owner = new Map<string, number>();
  const assign = (y: number, tried: Set<string>): boolean => {
    for (const c of cards) {
      if (!available(c, y) || tried.has(c.id)) continue;
      tried.add(c.id);
      const other = owner.get(c.id);
      if (other === undefined || assign(other, tried)) {
        owner.set(c.id, y);
        return true;
      }
    }
    return false;
  };
  return years.reduce((n, y) => n + (assign(y, new Set()) ? 1 : 0), 0);
}

/** How many of the 10 eras can get a different card. 10 = a whole game without repeats. */
export function distinctCardEras(cards: Card[]): number {
  return matchedEras(cards, ERAS);
}

/**
 * What a choice costs the planet: CO2 emitted, forests destroyed, minus CO2 removed and half the
 * public awareness it raises (informing counts, so journalists and activists can play green too).
 */
export function climateCost(effects: Effects): number {
  return (
    (effects.emissions ?? 0) +
    (effects.deforestation ?? 0) -
    (effects.capture ?? 0) -
    0.5 * (effects.awareness ?? 0)
  );
}

/**
 * Options of a card that are the best for the planet (lowest climate cost). Empty when every
 * option costs the same: such a card offers no green choice.
 */
export function greenOptionIds(card: Pick<Card, 'options'>): string[] {
  const costs = card.options.map((o) => climateCost(o.effects));
  const best = Math.min(...costs);
  if (Math.max(...costs) - best < 1e-9) return [];
  return card.options.filter((_, i) => costs[i]! - best < 1e-9).map((o) => o.id);
}
