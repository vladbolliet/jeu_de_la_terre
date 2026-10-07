// Plays a full game with bots to balance content and the climate model.
// Usage: pnpm simulate [--players 100] [--strategy random|greedy|green] [--seed 1]
import { parseArgs } from 'node:util';
import { ERAS, type Card, type Effects, type Option, type Role } from '@jdlt/shared';
import { loadContent } from '../load.ts';
import { initialWorld, resolveEra } from '../climate.ts';
import { createRng, pick } from '../rng.ts';

const { values } = parseArgs({
  options: {
    players: { type: 'string', default: '100' },
    strategy: { type: 'string', default: 'greedy' },
    seed: { type: 'string', default: '1' },
  },
});
const players = Number(values.players);
const rng = createRng(Number(values.seed));
const { content } = loadContent();

const totalShare = content.roles.reduce((s, r) => s + r.share, 0);
const roster: Role[] = content.roles.flatMap((r) =>
  Array<Role>(Math.round((r.share / totalShare) * players)).fill(r.id),
);

const chooseOption = (card: Card): Option => {
  const opts = card.options;
  if (values.strategy === 'greedy') return opts.reduce((a, b) => (b.score > a.score ? b : a));
  if (values.strategy === 'green')
    return opts.reduce((a, b) => ((b.effects.emissions ?? 0) < (a.effects.emissions ?? 0) ? b : a));
  return pick(opts, rng)!;
};

let world = initialWorld();
const rows = [];
for (const era of ERAS) {
  const decisions: Effects[] = [];
  for (const role of roster) {
    const pool = content.cards.filter(
      (c) => !c.interactionOnly && c.roles.includes(role) && (!c.eras || c.eras.includes(era)),
    );
    const card = pick(pool, rng);
    if (card) decisions.push(chooseOption(card).effects);
  }
  const res = resolveEra(world, { decisions, playerCount: roster.length, collective: [] });
  world = res.world;
  const c = world.climate;
  rows.push({
    'fin d’ère': era + 20,
    'CO2 ppm': c.co2.toFixed(0),
    '°C': c.temperature.toFixed(2),
    'mer cm': c.seaLevel.toFixed(0),
    forêt: c.forest.toFixed(0),
    biodiv: c.biodiversity.toFixed(0),
    PIB: world.society.gdp.toFixed(0),
    'Gt/an': res.emissions.toFixed(1),
    bascules: res.newTippingPoints.join(' '),
  });
}
console.log(`stratégie=${values.strategy} joueurs=${roster.length}`);
console.table(rows);
