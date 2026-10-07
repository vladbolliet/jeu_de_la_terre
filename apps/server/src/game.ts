// Authoritative game state. All rules live here; clients only send intents.
import { randomUUID } from 'node:crypto';
import {
  END_YEAR,
  ROLES,
  indicatorValue,
  type Card,
  type CardView,
  type ChoiceRecord,
  type Content,
  type Effects,
  type Phase,
  type PlayerView,
  type Role,
  type RoleCounts,
  type RoleEraStats,
  type ScreenView,
  type TippingPointId,
  type Vote,
  type VoteResult,
  type World,
} from '@jdlt/shared';
import { initialWorld, pick, resolveEra } from '@jdlt/engine';

interface DealtCard {
  instanceId: string;
  card: Card;
  fromPlayer?: string;
}

interface Player {
  id: string;
  token: string;
  name: string;
  role: Role;
  connected: boolean;
  score: number;
  hand: DealtCard[];
  outcomes: string[];
  history: Required<ChoiceRecord>[];
}

type Durations = { choices: number; conflicts: number; feedback: number };

export class GameError extends Error {}

export class Game {
  private players = new Map<string, Player>();
  private byToken = new Map<string, Player>();
  phase: Phase = 'lobby';
  private world: World = initialWorld();
  private phaseEndsAt: number | null = null;
  private pausedRemainingMs: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private decisions: { role: Role; effects: Effects }[] = [];
  private cardsDealt = 0;
  private vote: Vote | null = null;
  private ballots = new Map<string, string>();
  private lastVoteResult: VoteResult | null = null;
  private collective: Effects[] = [];
  private newTippingPoints: TippingPointId[] = [];

  constructor(
    private content: Content,
    private durations: Durations,
    /** Called whenever state changed; the server throttles broadcasts. */
    private onChange: () => void,
    private rng: () => number = Math.random,
    private publicUrl: string | null = null,
  ) {}

  // ---------- players ----------

  join(name: string, token?: string): Player {
    const existing = token ? this.byToken.get(token) : undefined;
    if (existing) {
      existing.connected = true;
      this.onChange();
      return existing;
    }
    const player: Player = {
      id: randomUUID(),
      token: randomUUID(),
      name: name.trim().slice(0, 24) || 'Anonyme',
      role: this.nextRole(),
      connected: true,
      score: 0,
      hand: [],
      outcomes: [],
      history: [],
    };
    this.players.set(player.id, player);
    this.byToken.set(player.token, player);
    if (this.phase === 'choices') this.deal(player);
    this.onChange();
    return player;
  }

  disconnect(playerId: string) {
    const p = this.players.get(playerId);
    if (p) p.connected = false;
    this.onChange();
  }

  /** Assigns the role whose current count is furthest below its target share. */
  private nextRole(): Role {
    const counts = this.roleCounts();
    const total = this.content.roles.reduce((s, r) => s + r.share, 0);
    const n = this.players.size + 1;
    let best = this.content.roles[0]!;
    let bestDeficit = -Infinity;
    for (const r of this.content.roles) {
      const deficit = (r.share / total) * n - counts[r.id];
      if (deficit > bestDeficit) [best, bestDeficit] = [r, deficit];
    }
    return best.id;
  }

  private roleCounts(): RoleCounts {
    const counts = Object.fromEntries(ROLES.map((r) => [r, 0])) as RoleCounts;
    for (const p of this.players.values()) counts[p.role]++;
    return counts;
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
    this.decisions.push({ role: p.role, effects: option.effects });
    p.history.push({
      year: this.world.year,
      cardTitle: dealt.card.title,
      optionLabel: option.label,
      effects: option.effects,
    });
    if (option.outcome) p.outcomes.push(option.outcome);

    if (option.sends) {
      const target = pick(
        [...this.players.values()].filter(
          (o) => o.connected && o.role === option.sends!.toRole && o.id !== p.id,
        ),
        this.rng,
      );
      const card = this.content.cards.find((c) => c.id === option.sends!.card);
      if (target && card) {
        target.hand.push({ instanceId: randomUUID(), card, fromPlayer: p.name });
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

  // ---------- phases ----------

  start() {
    if (this.phase !== 'lobby') throw new GameError('Partie déjà lancée');
    this.enter('choices');
  }

  /** Ends the current phase now (host skip or timer). */
  next() {
    switch (this.phase) {
      case 'lobby':
        return this.start();
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
    this.world = initialWorld();
    this.phase = 'lobby';
    this.phaseEndsAt = null;
    this.pausedRemainingMs = null;
    this.lastVoteResult = null;
    this.newTippingPoints = [];
    this.onChange();
  }

  private enter(phase: Phase) {
    this.phase = phase;
    this.pausedRemainingMs = null;
    if (phase === 'choices') this.beginEra();
    if (phase === 'conflicts') this.openVote();
    if (phase === 'feedback') this.endEra();
    const seconds =
      phase === 'choices' || phase === 'conflicts' || phase === 'feedback'
        ? this.durations[phase]
        : 0;
    // Skip the conflicts phase quickly when no vote is triggered this era.
    const ms = phase === 'conflicts' && !this.vote ? 3000 : seconds * 1000;
    if (ms > 0) this.schedule(ms);
    else {
      this.clearTimer();
      this.phaseEndsAt = null;
    }
    this.onChange();
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
    for (const p of this.players.values()) {
      p.hand = [];
      p.outcomes = [];
      this.deal(p);
    }
  }

  private deal(p: Player) {
    const pool = this.content.cards.filter(
      (c) =>
        !c.interactionOnly &&
        c.roles.includes(p.role) &&
        (!c.eras || (c.eras as readonly number[]).includes(this.world.year)),
    );
    const card = pick(pool, this.rng);
    if (!card) return;
    p.hand.push({ instanceId: randomUUID(), card });
    this.cardsDealt++;
  }

  private openVote() {
    for (const p of this.players.values()) p.hand = [];
    this.ballots.clear();
    this.vote =
      this.content.votes.find((v) => {
        if (v.eras && !(v.eras as readonly number[]).includes(this.world.year)) return false;
        if (!v.when) return true;
        const value = indicatorValue(this.world, v.when.indicator);
        return (
          (v.when.gt === undefined || value > v.when.gt) &&
          (v.when.lt === undefined || value < v.when.lt)
        );
      }) ?? null;
  }

  private closeVote() {
    const vote = this.vote;
    this.vote = null;
    if (!vote) return;
    const weights = new Map(this.content.roles.map((r) => [r.id, r.voteWeight]));
    const tally: Record<string, number> = Object.fromEntries(vote.options.map((o) => [o.id, 0]));
    for (const [playerId, optionId] of this.ballots) {
      const p = this.players.get(playerId);
      if (p) tally[optionId] = (tally[optionId] ?? 0) + (weights.get(p.role) ?? 1);
    }
    // Ties go to the first option (status quo should be listed first).
    const winner = vote.options.reduce((a, b) => ((tally[b.id] ?? 0) > (tally[a.id] ?? 0) ? b : a));
    this.collective.push(winner.effects);
    this.lastVoteResult = {
      voteId: vote.id,
      title: vote.title,
      winner: { id: winner.id, label: winner.label },
      tally,
    };
  }

  private endEra() {
    const res = resolveEra(this.world, {
      decisions: this.decisions.map((d) => d.effects),
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
      },
      hand: p.hand.map(toCardView),
      outcomes: p.outcomes,
      vote: this.vote
        ? {
            id: this.vote.id,
            title: this.vote.title,
            text: this.vote.text,
            options: this.vote.options.map((o) => ({ id: o.id, label: o.label })),
            myChoice: this.ballots.get(p.id) ?? null,
          }
        : null,
      lastVoteResult: this.lastVoteResult,
      history: p.history.map((h) => (this.phase === 'ended' ? h : { ...h, effects: undefined })),
    };
  }

  screenView(): ScreenView {
    const players = [...this.players.values()];
    return {
      phase: this.phase,
      year: this.world.year,
      phaseEndsAt: this.phaseEndsAt,
      playerCount: players.length,
      connectedCount: players.filter((p) => p.connected).length,
      roleCounts: this.roleCounts(),
      choicesMade: this.decisions.length,
      cardsDealt: this.cardsDealt,
      world: this.world,
      vote: this.vote
        ? {
            id: this.vote.id,
            title: this.vote.title,
            text: this.vote.text,
            options: this.vote.options.map((o) => ({ id: o.id, label: o.label })),
            ballots: this.ballots.size,
          }
        : null,
      lastVoteResult: this.lastVoteResult,
      newTippingPoints: this.newTippingPoints,
      leaderboard: players
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((p) => ({ role: p.role, name: p.name, score: p.score })),
      roleStats: this.roleStats(),
      joinUrl: this.publicUrl,
    };
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
