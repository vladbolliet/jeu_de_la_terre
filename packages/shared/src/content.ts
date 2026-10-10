// Schema of the game content written by the designers in /content (YAML).
// Any change here must be reflected in docs/CONTENU.md.
import { z } from 'zod';

export const ROLES = ['elite', 'citoyen', 'politique', 'militant'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

/** First year of each 20-year era. The game ends in 2100. */
export const ERAS = [1900, 1920, 1940, 1960, 1980, 2000, 2020, 2040, 2060, 2080] as const;
export const END_YEAR = 2100;
const EraSchema = z.literal(ERAS);

/**
 * Effects of a choice. Scale: -10 (very negative) … +10 (very positive) per player.
 * The engine averages effects over all players, so balance does not depend on head count.
 * - emissions / deforestation: drivers of the climate model (positive = more pollution)
 * - the others: society indicators (positive = increases)
 */
export const EffectsSchema = z
  .object({
    emissions: z.number().min(-10).max(10).optional(),
    deforestation: z.number().min(-10).max(10).optional(),
    gdp: z.number().min(-10).max(10).optional(),
    employment: z.number().min(-10).max(10).optional(),
    wellbeing: z.number().min(-10).max(10).optional(),
    approval: z.number().min(-10).max(10).optional(),
    awareness: z.number().min(-10).max(10).optional(),
  })
  .strict();
export type Effects = z.infer<typeof EffectsSchema>;
export type EffectKey = keyof Effects;

export const OptionSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    /** Short consequence text shown to the player after choosing. */
    outcome: z.string().optional(),
    effects: EffectsSchema.default({}),
    /** Personal points for the player who picks this option (role objective). */
    score: z.number().default(0),
    /** Cross-impact: sends a card to a random player of another role. */
    sends: z.object({ card: z.string(), toRole: RoleSchema }).optional(),
    /** On a card received through `sends`: text added to the sender's outcomes when this option is picked. */
    reply: z.string().optional(),
  })
  .strict();
export type Option = z.infer<typeof OptionSchema>;

export const CardSchema = z
  .object({
    id: z.string(),
    roles: z.array(RoleSchema).min(1),
    /** Eras where the card can be dealt. Omitted = all eras. */
    eras: z.array(EraSchema).optional(),
    title: z.string(),
    text: z.string(),
    /** true = never dealt randomly, only received through another player's `sends`. */
    interactionOnly: z.boolean().default(false),
    options: z.array(OptionSchema).min(2).max(4),
  })
  .strict();
export type Card = z.infer<typeof CardSchema>;

export const IndicatorKeySchema = z.enum([
  'co2',
  'temperature',
  'seaLevel',
  'biodiversity',
  'forest',
  'gdp',
  'employment',
  'wellbeing',
  'approval',
  'awareness',
]);
export type IndicatorKey = z.infer<typeof IndicatorKeySchema>;

export const ConditionSchema = z
  .object({ indicator: IndicatorKeySchema, gt: z.number().optional(), lt: z.number().optional() })
  .strict();
export type Condition = z.infer<typeof ConditionSchema>;

export const VoteSchema = z
  .object({
    id: z.string(),
    eras: z.array(EraSchema).optional(),
    /** The vote is only triggered if this condition holds at the start of the conflicts phase. */
    when: ConditionSchema.optional(),
    title: z.string(),
    text: z.string(),
    options: z.array(OptionSchema).min(2).max(4),
  })
  .strict();
export type Vote = z.infer<typeof VoteSchema>;

/** Global event (crisis, disaster, discovery) applied automatically at the end of an era. */
export const EventSchema = z
  .object({
    id: z.string(),
    eras: z.array(EraSchema).optional(),
    /** Checked on the world at the end of the era, before resolving it. */
    when: ConditionSchema.optional(),
    title: z.string(),
    text: z.string(),
    /** Applied at full strength, like a vote result. */
    effects: EffectsSchema.default({}),
  })
  .strict();
export type GameEvent = z.infer<typeof EventSchema>;

export const RoleDefSchema = z
  .object({
    id: RoleSchema,
    name: z.string(),
    objective: z.string(),
    /** Target share of players (shares are normalised). */
    share: z.number().positive(),
    /** Weight of this role's ballot in collective votes. */
    voteWeight: z.number().positive().default(1),
  })
  .strict();
export type RoleDef = z.infer<typeof RoleDefSchema>;

export interface Content {
  roles: RoleDef[];
  cards: Card[];
  votes: Vote[];
  /** Each event fires at most once per game. */
  events: GameEvent[];
}
