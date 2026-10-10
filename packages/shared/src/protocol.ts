// Socket.IO contract between server, mobile and screen.
// Changing this file = breaking change for the 3 devs: open a PR and ping everyone.
import type { Phase, RoleCounts, TippingPointId, World } from './state.ts';
import type { Effects, Role } from './content.ts';

/** Option as seen by a player: no numeric effects (players must not see the eco impact). */
export interface OptionView {
  id: string;
  label: string;
}

export interface CardView {
  /** Unique per dealt card (a player may receive the same card twice). */
  instanceId: string;
  cardId: string;
  title: string;
  text: string;
  /** Name of the player whose choice sent this card, for cross-impact cards. */
  fromPlayer?: string;
  options: OptionView[];
}

export interface VoteView {
  id: string;
  title: string;
  text: string;
  options: OptionView[];
}

export interface VoteResult {
  voteId: string;
  title: string;
  winner: OptionView;
  tally: Record<string, number>;
}

/** One choice made by the player during the game. */
export interface ChoiceRecord {
  year: number;
  cardTitle: string;
  optionLabel: string;
  /** Revealed only when the game has ended (phase 'ended'), undefined before. */
  effects?: Effects;
}

/** Per-role statistics for the current era (choices made so far). */
export interface RoleEraStats {
  choices: number;
  /** Mean `emissions` effect of the choices made by this role (-10…+10). */
  meanEmissions: number;
}

export interface PlayerView {
  phase: Phase;
  year: number;
  /** Epoch ms when the current phase ends (null = waiting for the host). */
  phaseEndsAt: number | null;
  me: { id: string; name: string; role: Role; roleName: string; objective: string; score: number };
  hand: CardView[];
  /** Outcome texts of the choices made this era. */
  outcomes: string[];
  vote: (VoteView & { myChoice: string | null }) | null;
  lastVoteResult: VoteResult | null;
  /** All choices made by this player since 1900. */
  history: ChoiceRecord[];
}

export interface ScreenView {
  phase: Phase;
  year: number;
  phaseEndsAt: number | null;
  playerCount: number;
  connectedCount: number;
  roleCounts: RoleCounts;
  /** Number of choices made this era / number of cards dealt this era. */
  choicesMade: number;
  cardsDealt: number;
  world: World;
  vote: (VoteView & { ballots: number }) | null;
  lastVoteResult: VoteResult | null;
  /** Tipping points crossed during the last resolved era. */
  newTippingPoints: TippingPointId[];
  leaderboard: { role: Role; name: string; score: number }[];
  roleStats: Record<Role, RoleEraStats>;
  /** Global events that fired at the end of the last resolved era (shown during feedback). */
  events: { id: string; title: string; text: string }[];
  /** URL players should open (for the QR code). Null if PUBLIC_URL is not set on the server. */
  joinUrl: string | null;
}

export type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

export type HostAction = 'start' | 'next' | 'pause' | 'resume' | 'reset';

export interface ClientToServerEvents {
  'player:join': (
    p: { name: string; token?: string },
    ack: Ack<{ token: string; playerId: string }>,
  ) => void;
  'player:choose': (
    p: { instanceId: string; optionId: string },
    ack: Ack<{ outcome: string | null }>,
  ) => void;
  'player:vote': (p: { voteId: string; optionId: string }, ack: Ack<null>) => void;
  'screen:join': () => void;
  'host:command': (p: { key: string; action: HostAction }, ack: Ack<null>) => void;
}

export interface ServerToClientEvents {
  'player:state': (s: PlayerView) => void;
  /** The game was reset by the host: forget the saved token and go back to the join screen. */
  'player:kicked': () => void;
  'screen:state': (s: ScreenView) => void;
}
