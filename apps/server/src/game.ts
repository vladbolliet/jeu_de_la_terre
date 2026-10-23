// Authoritative game state. All rules live here; clients only send intents.
import { randomUUID } from 'node:crypto';
import {
  END_YEAR,
  ERAS,
  REGIONS,
  REGION_NAMES,
  ROLES,
  conditionHolds,
  roleShare,
  type BlocPosition,
  type Card,
  type CardView,
  type ChoiceRecord,
  type Content,
  type Effects,
  type GameEvent,
  type Phase,
  type PlayerView,
  type Region,
  type RegionView,
  type Role,
  type RoleCounts,
  type RoleEraStats,
  type ScreenView,
  type TippingPointId,
  type TodayStats,
  type Vote,
  type VoteResult,
  type World,
} from '@jdlt/shared';
import {
  COUNTRIES,
  dealableCards,
  greenOptionIds,
  emissionsShare,
  initialWorld,
  nextRegion,
  peoplePerPlayer,
  pick,
  pickCountry,
  pickFreshCard,
  populationShare,
  regionWeights,
  resolveEra,
  WORLD_POPULATION,
} from '@jdlt/engine';
import { FALLBACK_TODAY } from './today.ts';

interface DealtCard {
  instanceId: string;
  card: Card;
  /** Sender name and id, for cards received through another player's `sends`. */
  fromPlayer?: string;
  fromPlayerId?: string;
}

interface Player {
  id: string;
  token: string;
  name: string;
  role: Role;
  /** Group of countries and country the player lives in, fixed for the whole game. */
  region: Region;
  country: string;
  /** Number of open sockets bound to this player (a phone can briefly have two while reconnecting). */
  connections: number;
  score: number;
  /** Choices that were the best for the planet on their card: the final ranking. */
  green: number;
  hand: DealtCard[];
  /** Ids of every card this player has received (dealt or sent): a card never comes back. */
  seen: string[];
  outcomes: string[];
  history: Required<ChoiceRecord>[];
}

type Durations = { intro: number; choices: number; conflicts: number; feedback: number };

export interface GameOptions {
  durations: Durations;
  /** Called whenever state changed; the server throttles broadcasts. */
  onChange?: () => void;
  rng?: () => number;
  publicUrl?: string | null;
  maxPlayers?: number;
}

/** Serializable game state, written to disk so a server crash does not lose the game. */
export interface GameSnapshot {
  version: 1;
  savedAt: number;
  phase: Phase;
  world: World;
  /** Remaining time of the current phase; null if the phase has no timer. */
  remainingMs: number | null;
  paused: boolean;
  players: (Omit<Player, 'hand' | 'connections' | 'region' | 'country' | 'seen' | 'green'> & {
    hand: { instanceId: string; cardId: string; fromPlayer?: string; fromPlayerId?: string }[];
    /** Missing in snapshots saved before cards stopped repeating. */
    seen?: string[];
    /** Missing in snapshots saved before the green ranking. */
    green?: number;
    /** Missing in snapshots saved before groups of countries existed. */
    region?: Region;
    country?: string;
  })[];
  decisions: EraDecision[];
  cardsDealt: number;
  voteId: string | null;
  ballots: [string, string][];
  lastVoteResult: VoteResult | null;
  collective: Effects[];
  newTippingPoints: TippingPointId[];
  firedEvents: string[];
  eraEvents: string[];
  /** Missing in snapshots saved before the intro existed. */
  today?: TodayStats;
}

interface EraDecision {
  role: Role;
  /** Missing in snapshots saved before groups of countries existed (counted as unweighted). */
  region?: Region;
  effects: Effects;
}

/** Minimum time left to a restored phase, so players have time to reconnect. */
const RESTORE_MIN_MS = 10_000;

export class GameError extends Error {}

export class Game {
  private players = new Map<string, Player>();
  private byToken = new Map<string, Player>();
  phase: Phase = 'lobby';
  private today: TodayStats = FALLBACK_TODAY;
  private world: World = this.freshWorld();
  private phaseEndsAt: number | null = null;
  private pausedRemainingMs: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private decisions: EraDecision[] = [];
  private cardsDealt = 0;
  private vote: Vote | null = null;
  private ballots = new Map<string, string>();
  private lastVoteResult: VoteResult | null = null;
  private collective: Effects[] = [];
  private newTippingPoints: TippingPointId[] = [];
  /** Ids of events already fired this game (each fires once). */
  private firedEvents = new Set<string>();
  /** Events fired at the end of the last resolved era. */
  private eraEvents: GameEvent[] = [];

  private durations: Durations;
  private onChange: () => void;
  private rng: () => number;
  private publicUrl: string | null;
  private maxPlayers: number;

  constructor(
    private content: Content,
    opts: GameOptions,
  ) {
    this.durations = opts.durations;
    this.onChange = opts.onChange ?? (() => {});
    this.rng = opts.rng ?? Math.random;
    this.publicUrl = opts.publicUrl ?? null;
    this.maxPlayers = opts.maxPlayers ?? 200;
  }

  // ---------- players ----------

  join(name: string, token?: string): Player {
    const existing = token ? this.byToken.get(token) : undefined;
    if (existing) {
      existing.connections++;
      this.onChange();
      return existing;
    }
    if (this.players.size >= this.maxPlayers) throw new GameError('La partie est complète');
    const region = nextRegion(this.eraIndex(), this.regionCounts());
    const player: Player = {
      id: randomUUID(),
      token: randomUUID(),
      name: name.trim().slice(0, 24) || 'Anonyme',
      role: this.nextRole(region),
      region,
      country: pickCountry(region, this.rng).name,
      connections: 1,
      score: 0,
      green: 0,
      hand: [],
      seen: [],
      outcomes: [],
      history: [],
    };
    this.players.set(player.id, player);
    this.byToken.set(player.token, player);
    if (this.phase === 'choices') this.deal(player);
    this.onChange();
    return player;
  }

  /** Called when one socket bound to this player closes. */
  disconnect(playerId: string) {
    const p = this.players.get(playerId);
    if (p) p.connections = Math.max(0, p.connections - 1);
    this.onChange();
  }

  /** Assigns the role whose count in the group is furthest below its share in that group. */
  private nextRole(region: Region): Role {
    const counts = this.roleCounts(region);
    const total = this.content.roles.reduce((s, r) => s + roleShare(r, region), 0);
    const n = this.regionCounts()[region] + 1;
    let best = this.content.roles[0]!;
    let bestDeficit = -Infinity;
    for (const r of this.content.roles) {
      const deficit = (roleShare(r, region) / total) * n - counts[r.id];
      if (deficit > bestDeficit) [best, bestDeficit] = [r, deficit];
    }
    return best.id;
  }

  private roleCounts(region?: Region): RoleCounts {
    const counts = Object.fromEntries(ROLES.map((r) => [r, 0])) as RoleCounts;
    for (const p of this.players.values()) if (!region || p.region === region) counts[p.role]++;
    return counts;
  }

  private regionCounts(): Record<Region, number> {
    const counts = Object.fromEntries(REGIONS.map((r) => [r, 0])) as Record<Region, number>;
    for (const p of this.players.values()) counts[p.region]++;
    return counts;
  }

  /** Index of the current era in ERAS (the last one once the game has ended). */
  private eraIndex(): number {
    const i = ERAS.indexOf(this.world.year as (typeof ERAS)[number]);
    return i < 0 ? ERAS.length - 1 : i;
  }

  choose(playerId: string, instanceId: string, optionId: string): string | null {
    const p = this.mustPlayer(playerId);
    if (this.phase !== 'choices') throw new GameError('Ce n’est pas le moment de choisir');
    const dealt = p.hand.find((d) => d.instanceId === instanceId);
    if (!dealt) throw new GameError('Carte inconnue');
    const option = dealt.card.options.find((o) => o.id === optionId);
    if (!option) throw new GameError('Option inconnue');

    p.hand = p.hand.filter((d) => d !== dealt);
    p.score += option.score;
    if (greenOptionIds(dealt.card).includes(option.id)) p.green++;
    this.decisions.push({ role: p.role, region: p.region, effects: option.effects });
    p.history.push({
      year: this.world.year,
      cardTitle: dealt.card.title,
      optionLabel: option.label,
      effects: option.effects,
    });
    if (option.outcome) p.outcomes.push(option.outcome);
    if (option.reply && dealt.fromPlayerId)
      this.players.get(dealt.fromPlayerId)?.outcomes.push(option.reply);

    if (option.sends) {
      const { card: cardId, toRole } = option.sends;
      // Only to someone who has never received this card (no repeats); otherwise it is not sent.
      const target = pick(
        [...this.players.values()].filter(
          (o) =>
            o.connections > 0 && o.role === toRole && o.id !== p.id && !o.seen.includes(cardId),
        ),
        this.rng,
      );
      const card = this.content.cards.find((c) => c.id === cardId);
      if (target && card) {
        target.seen.push(card.id);
        target.hand.push({
          instanceId: randomUUID(),
          card,
          fromPlayer: p.name,
          fromPlayerId: p.id,
        });
        this.cardsDealt++;
      }
    }
    this.onChange();
    return option.outcome ?? null;
  }

  castVote(playerId: string, voteId: string, optionId: string) {
    this.mustPlayer(playerId);
    if (this.phase !== 'conflicts' || this.vote?.id !== voteId)
      throw new GameError('Aucun vote en cours');
    if (!this.vote.options.some((o) => o.id === optionId)) throw new GameError('Option inconnue');
    this.ballots.set(playerId, optionId);
    this.onChange();
  }

  private mustPlayer(id: string): Player {
    const p = this.players.get(id);
    if (!p) throw new GameError('Joueur inconnu');
    return p;
  }

  // ---------- today's figures ----------

  /** New real figures. Before the game starts they also become the initial climate. */
  setToday(today: TodayStats) {
    this.today = today;
    if (this.phase === 'lobby') this.world = this.freshWorld();
    this.onChange();
  }

  private freshWorld(): World {
    const t = this.today;
    return initialWorld({
      co2: t.co2.value,
      temperature: t.temperature.value,
      seaLevel: t.seaLevel.value,
    });
  }

  // ---------- phases ----------

  start() {
    if (this.phase !== 'lobby') throw new GameError('Partie déjà lancée');
    this.enter('intro');
  }

  /** Ends the current phase now (host skip or timer). */
  next() {
    switch (this.phase) {
      case 'lobby':
        return this.start();
      case 'intro':
        return this.enter('choices');
      case 'choices':
        return this.enter('conflicts');
      case 'conflicts':
        this.closeVote();
        return this.enter('feedback');
      case 'feedback':
        return this.enter(this.world.year >= END_YEAR ? 'ended' : 'choices');
      case 'ended':
        return;
    }
  }

  pause() {
    if (!this.phaseEndsAt) return;
    this.pausedRemainingMs = Math.max(0, this.phaseEndsAt - Date.now());
    this.phaseEndsAt = null;
    this.clearTimer();
    this.onChange();
  }

  resume() {
    if (this.pausedRemainingMs === null) return;
    this.schedule(this.pausedRemainingMs);
    this.pausedRemainingMs = null;
    this.onChange();
  }

  reset() {
    this.clearTimer();
    this.players.clear();
    this.byToken.clear();
    this.world = this.freshWorld();
    this.phase = 'lobby';
    this.phaseEndsAt = null;
    this.pausedRemainingMs = null;
    this.lastVoteResult = null;
    this.newTippingPoints = [];
    this.firedEvents.clear();
    this.eraEvents = [];
    this.onChange();
  }

  private enter(phase: Phase) {
    this.phase = phase;
    this.pausedRemainingMs = null;
    if (phase === 'choices') this.beginEra();
    if (phase === 'conflicts') this.openVote();
    if (phase === 'feedback') this.endEra();
    const seconds = phase === 'lobby' || phase === 'ended' ? 0 : this.durations[phase];
    // Skip the conflicts phase quickly when no vote is triggered this era.
    const ms = phase === 'conflicts' && !this.vote ? 3000 : seconds * 1000;
    if (ms > 0) this.schedule(ms);
    else {
      this.clearTimer();
      this.phaseEndsAt = null;
    }
    this.onChange();
  }

  /** Stops the phase timer (server shutdown, tests). */
  stop() {
    this.clearTimer();
  }

  private schedule(ms: number) {
    this.clearTimer();
    this.phaseEndsAt = Date.now() + ms;
    this.timer = setTimeout(() => this.next(), ms);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private beginEra() {
    this.decisions = [];
    this.collective = [];
    this.cardsDealt = 0;
    this.lastVoteResult = null;
    this.newTippingPoints = [];
    this.eraEvents = [];
    for (const p of this.players.values()) {
      p.hand = [];
      p.outcomes = [];
      this.deal(p);
    }
  }

  private deal(p: Player) {
    const cards = dealableCards(this.content.cards, p.role, p.region);
    const card = pickFreshCard(cards, this.world.year, new Set(p.seen), this.rng);
    if (!card) return;
    p.seen.push(card.id);
    p.hand.push({ instanceId: randomUUID(), card });
    this.cardsDealt++;
  }

  private openVote() {
    for (const p of this.players.values()) p.hand = [];
    this.ballots.clear();
    this.vote =
      this.content.votes.find((v) => this.inEra(v.eras) && conditionHolds(this.world, v.when)) ??
      null;
  }

  /** Weighted ballots per option, for one group of countries or for everyone. */
  private tally(vote: Vote, region?: Region): Record<string, number> {
    const weights = new Map(this.content.roles.map((r) => [r.id, r.voteWeight]));
    const tally: Record<string, number> = Object.fromEntries(vote.options.map((o) => [o.id, 0]));
    for (const [playerId, optionId] of this.ballots) {
      const p = this.players.get(playerId);
      if (p && (!region || p.region === region))
        tally[optionId] = (tally[optionId] ?? 0) + (weights.get(p.role) ?? 1);
    }
    return tally;
  }

  /** Option each group currently backs. Ties go to the first option (status quo listed first). */
  private blocs(vote: Vote): Record<Region, BlocPosition> {
    const out = {} as Record<Region, BlocPosition>;
    for (const region of REGIONS) {
      const tally = this.tally(vote, region);
      const ballots = Object.values(tally).reduce((s, n) => s + n, 0);
      const best = vote.options.reduce((a, b) => ((tally[b.id] ?? 0) > (tally[a.id] ?? 0) ? b : a));
      out[region] = { ballots, optionId: ballots > 0 ? best.id : null };
    }
    return out;
  }

  /**
   * International negotiation: an option is adopted only if every group that voted backs it
   * (consensus, as in climate summits). Otherwise the status quo (first option) stays.
   */
  private closeVote() {
    const vote = this.vote;
    this.vote = null;
    if (!vote) return;
    const blocs = this.blocs(vote);
    const positions = REGIONS.map((r) => blocs[r].optionId).filter((id) => id !== null);
    const agreement = positions.length > 0 && positions.every((id) => id === positions[0]);
    const winner =
      (agreement && vote.options.find((o) => o.id === positions[0])) || vote.options[0]!;
    this.collective.push(winner.effects);
    this.lastVoteResult = {
      voteId: vote.id,
      title: vote.title,
      options: vote.options.map((o) => ({ id: o.id, label: o.label })),
      winner: { id: winner.id, label: winner.label },
      tally: this.tally(vote),
      agreement,
      blocs,
    };
  }

  private inEra(eras: readonly number[] | undefined) {
    return !eras || eras.includes(this.world.year);
  }

  private endEra() {
    this.eraEvents = this.content.events.filter(
      (e) =>
        !this.firedEvents.has(e.id) && this.inEra(e.eras) && conditionHolds(this.world, e.when),
    );
    for (const e of this.eraEvents) {
      this.firedEvents.add(e.id);
      this.collective.push(e.effects);
    }
    const weights = regionWeights(this.eraIndex(), this.regionCounts());
    const res = resolveEra(this.world, {
      decisions: this.decisions.map((d) => ({
        effects: d.effects,
        weight: d.region && weights[d.region],
      })),
      playerCount: Math.max(1, this.players.size),
      collective: this.collective,
    });
    this.world = res.world;
    this.newTippingPoints = res.newTippingPoints;
  }

  // ---------- views ----------

  playerView(playerId: string): PlayerView | null {
    const p = this.players.get(playerId);
    if (!p) return null;
    const role = this.content.roles.find((r) => r.id === p.role)!;
    const vote = this.vote;
    return {
      phase: this.phase,
      year: this.world.year,
      phaseEndsAt: this.phaseEndsAt,
      me: {
        id: p.id,
        name: p.name,
        role: p.role,
        roleName: role.name,
        objective: role.objective,
        score: p.score,
        green: p.green,
        region: p.region,
        regionName: REGION_NAMES[p.region],
        country: p.country,
        represents: peoplePerPlayer(p.region, this.eraIndex(), this.regionCounts()[p.region]),
      },
      hand: p.hand.map(toCardView),
      outcomes: p.outcomes,
      vote: vote
        ? {
            id: vote.id,
            title: vote.title,
            text: vote.text,
            options: vote.options.map((o) => ({ id: o.id, label: o.label })),
            myChoice: this.ballots.get(p.id) ?? null,
            myBloc: this.blocs(vote)[p.region],
          }
        : null,
      lastVoteResult: this.lastVoteResult,
      history: p.history.map((h) => (this.phase === 'ended' ? h : { ...h, effects: undefined })),
    };
  }

  screenView(): ScreenView {
    const players = [...this.players.values()];
    const vote = this.vote;
    return {
      phase: this.phase,
      year: this.world.year,
      phaseEndsAt: this.phaseEndsAt,
      playerCount: players.length,
      connectedCount: players.filter((p) => p.connections > 0).length,
      roleCounts: this.roleCounts(),
      regions: this.regionViews(),
      countries: COUNTRIES.map((c) => ({
        name: c.name,
        region: c.region,
        lon: c.lon,
        lat: c.lat,
        players: players.filter((p) => p.country === c.name).length,
      })).filter((c) => c.players > 0),
      population: (WORLD_POPULATION[this.eraIndex()] ?? 0) * 1e9,
      choicesMade: this.decisions.length,
      cardsDealt: this.cardsDealt,
      world: this.world,
      vote: vote
        ? {
            id: vote.id,
            title: vote.title,
            text: vote.text,
            options: vote.options.map((o) => ({ id: o.id, label: o.label })),
            ballots: this.ballots.size,
            blocs: this.blocs(vote),
          }
        : null,
      lastVoteResult: this.lastVoteResult,
      newTippingPoints: this.newTippingPoints,
      leaderboard: players
        .sort((a, b) => b.green - a.green || b.score - a.score)
        .slice(0, 10)
        .map((p) => ({ role: p.role, name: p.name, score: p.score, green: p.green })),
      roleStats: this.roleStats(),
      events: this.eraEvents.map((e) => ({ id: e.id, title: e.title, text: e.text })),
      joinUrl: this.publicUrl,
      today: this.today,
    };
  }

  private regionViews(): Record<Region, RegionView> {
    const counts = this.regionCounts();
    const era = this.eraIndex();
    return Object.fromEntries(
      REGIONS.map((r) => [
        r,
        {
          name: REGION_NAMES[r],
          players: counts[r],
          populationShare: populationShare(r, era),
          emissionsShare: emissionsShare(r, era),
          represents: peoplePerPlayer(r, era, counts[r]),
        },
      ]),
    ) as Record<Region, RegionView>;
  }

  private roleStats(): Record<Role, RoleEraStats> {
    const stats = Object.fromEntries(
      ROLES.map((r) => [r, { choices: 0, meanEmissions: 0 }]),
    ) as Record<Role, RoleEraStats>;
    for (const d of this.decisions) {
      const s = stats[d.role];
      s.meanEmissions =
        (s.meanEmissions * s.choices + (d.effects.emissions ?? 0)) / (s.choices + 1);
      s.choices++;
    }
    return stats;
  }

  playerIds() {
    return [...this.players.keys()];
  }

  // ---------- persistence ----------

  snapshot(): GameSnapshot {
    const remainingMs =
      this.pausedRemainingMs ??
      (this.phaseEndsAt ? Math.max(0, this.phaseEndsAt - Date.now()) : null);
    return {
      version: 1,
      savedAt: Date.now(),
      phase: this.phase,
      world: this.world,
      remainingMs,
      paused: this.pausedRemainingMs !== null,
      players: [...this.players.values()].map(({ hand, connections: _, ...p }) => ({
        ...p,
        hand: hand.map((d) => ({
          instanceId: d.instanceId,
          cardId: d.card.id,
          fromPlayer: d.fromPlayer,
          fromPlayerId: d.fromPlayerId,
        })),
      })),
      decisions: this.decisions,
      cardsDealt: this.cardsDealt,
      voteId: this.vote?.id ?? null,
      ballots: [...this.ballots],
      lastVoteResult: this.lastVoteResult,
      collective: this.collective,
      newTippingPoints: this.newTippingPoints,
      firedEvents: [...this.firedEvents],
      eraEvents: this.eraEvents.map((e) => e.id),
      today: this.today,
    };
  }

  /** Rebuilds a game from a snapshot. Cards/votes removed from the content since are dropped. */
  static restore(snap: GameSnapshot, content: Content, opts: GameOptions): Game {
    const g = new Game(content, opts);
    const cards = new Map(content.cards.map((c) => [c.id, c]));
    for (const sp of snap.players) {
      const hand: DealtCard[] = sp.hand.flatMap((h) => {
        const card = cards.get(h.cardId);
        return card ? [{ ...h, card }] : [];
      });
      const region = sp.region ?? nextRegion(0, g.regionCounts());
      const country = sp.country ?? pickCountry(region, g.rng).name;
      const seen = sp.seen ?? sp.hand.map((h) => h.cardId);
      const p: Player = {
        ...sp,
        region,
        country,
        seen,
        green: sp.green ?? 0,
        hand,
        connections: 0,
      };
      g.players.set(p.id, p);
      g.byToken.set(p.token, p);
    }
    g.phase = snap.phase;
    if (snap.today) g.today = snap.today;
    // Worlds saved before CO2 removal existed have no captureRate.
    g.world = { ...snap.world, captureRate: snap.world.captureRate ?? 0 };
    g.decisions = snap.decisions;
    g.cardsDealt = snap.cardsDealt;
    g.vote = content.votes.find((v) => v.id === snap.voteId) ?? null;
    g.ballots = new Map(snap.ballots);
    // Results saved before negotiations by group have no `blocs`: drop them.
    g.lastVoteResult = snap.lastVoteResult?.blocs ? snap.lastVoteResult : null;
    g.collective = snap.collective;
    g.newTippingPoints = snap.newTippingPoints;
    g.firedEvents = new Set(snap.firedEvents);
    g.eraEvents = content.events.filter((e) => snap.eraEvents.includes(e.id));
    if (snap.remainingMs !== null) {
      const ms = Math.max(RESTORE_MIN_MS, snap.remainingMs);
      if (snap.paused) g.pausedRemainingMs = ms;
      else g.schedule(ms);
    }
    return g;
  }
}

function toCardView(d: DealtCard): CardView {
  return {
    instanceId: d.instanceId,
    cardId: d.card.id,
    title: d.card.title,
    text: d.card.text,
    fromPlayer: d.fromPlayer,
    options: d.card.options.map((o) => ({ id: o.id, label: o.label })),
  };
}
