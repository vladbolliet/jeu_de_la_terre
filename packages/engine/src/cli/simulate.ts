// Plays a full game with bots to balance content and the climate model.
// Usage: pnpm simulate [--players 100] [--strategy random|greedy|green] [--seed 1]
import { parseArgs } from 'node:util';
import {
  ERAS,
  REGIONS,
  conditionHolds,
  nextEraYear,
  roleShare,
  type Card,
  type Option,
  type Region,
  type Role,
} from '@jdlt/shared';
import { loadContent } from '../load.ts';
import { initialWorld, resolveEra, type Decision } from '../climate.ts';
import { nextRegion, regionWeights } from '../regions.ts';
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

// Same assignment as the server: group by population, then role by its share in the group.
const regionCounts: Record<Region, number> = { riche: 0, emergent: 0, developpement: 0 };
const roster: { role: Role; region: Region }[] = [];
for (let i = 0; i < players; i++) {
  const region = nextRegion(0, regionCounts);
  const inRegion = roster.filter((p) => p.region === region);
  const total = content.roles.reduce((s, r) => s + roleShare(r, region), 0);
  const role = content.roles.reduce((best, r) => {
    const deficit = (d: typeof r) =>
      (roleShare(d, region) / total) * (inRegion.length + 1) -
      inRegion.filter((p) => p.role === d.id).length;
    return deficit(r) > deficit(best) ? r : best;
  }).id;
  regionCounts[region]++;
  roster.push({ role, region });
}
console.log(
  REGIONS.map((r) => `${r}=${regionCounts[r]}`).join(' '),
  content.roles.map((d) => `${d.id}=${roster.filter((p) => p.role === d.id).length}`).join(' '),
);

const chooseOption = (card: Card): Option => {
  const opts = card.options;
  if (values.strategy === 'greedy') return opts.reduce((a, b) => (b.score > a.score ? b : a));
  if (values.strategy === 'green')
    return opts.reduce((a, b) => ((b.effects.emissions ?? 0) < (a.effects.emissions ?? 0) ? b : a));
  return pick(opts, rng)!;
};

let world = initialWorld();
const fired = new Set<string>();
const rows = [];
for (const [eraIndex, era] of ERAS.entries()) {
  const weights = regionWeights(eraIndex, regionCounts);
  const decisions: Decision[] = [];
  for (const { role, region } of roster) {
    const pool = content.cards.filter(
      (c) =>
        !c.interactionOnly &&
        c.roles.includes(role) &&
        (!c.eras || c.eras.includes(era)) &&
        (!c.regions || c.regions.includes(region)),
    );
    const card = pick(pool, rng);
    if (card) decisions.push({ effects: chooseOption(card).effects, weight: weights[region] });
  }
  const events = content.events.filter(
    (e) => !fired.has(e.id) && (!e.eras || e.eras.includes(era)) && conditionHolds(world, e.when),
  );
  for (const e of events) fired.add(e.id);
  const res = resolveEra(world, {
    decisions,
    playerCount: roster.length,
    collective: events.map((e) => e.effects),
  });
  world = res.world;
  const c = world.climate;
  rows.push({
    'fin d’ère': nextEraYear(era),
    'CO2 ppm': c.co2.toFixed(0),
    '°C': c.temperature.toFixed(2),
    'mer cm': c.seaLevel.toFixed(0),
    forêt: c.forest.toFixed(0),
    biodiv: c.biodiversity.toFixed(0),
    PIB: world.society.gdp.toFixed(0),
    'Gt/an': res.emissions.toFixed(1),
    bascules: res.newTippingPoints.join(' '),
    événements: events.map((e) => e.id).join(' '),
  });
}
console.log(`stratégie=${values.strategy} joueurs=${roster.length}`);
console.table(rows);
