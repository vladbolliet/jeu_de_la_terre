export interface ServerConfig {
  port: number;
  /** Secret for the host controls on the screen app (?key=...). */
  hostKey: string;
  contentDir: string | undefined;
  /** Public URL of the game (shown as QR code on the screen), e.g. https://jeu-terre.onrender.com */
  publicUrl: string | null;
  /** Phase durations in seconds. Era total ≈ 2 min. */
  durations: { choices: number; conflicts: number; feedback: number };
  /** Max state broadcasts per second (batches bursts of 100 simultaneous clicks). */
  broadcastHz: number;
  maxPlayers: number;
  /** Max client events per second per socket; extra events are dropped. */
  maxEventsPerSecond: number;
  /** Where the game state is saved to survive a crash. null = no persistence. */
  stateFile: string | null;
  /** A saved state older than this is ignored at startup. */
  stateMaxAgeMs: number;
}

export function loadConfig(env = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3000),
    hostKey: env.HOST_KEY ?? 'dev',
    contentDir: env.CONTENT_DIR,
    publicUrl: env.PUBLIC_URL ?? null,
    durations: {
      choices: Number(env.CHOICES_S ?? 60),
      conflicts: Number(env.CONFLICTS_S ?? 40),
      feedback: Number(env.FEEDBACK_S ?? 20),
    },
    broadcastHz: 5,
    maxPlayers: Number(env.MAX_PLAYERS ?? 200),
    maxEventsPerSecond: 10,
    stateFile: env.STATE_FILE === '' ? null : (env.STATE_FILE ?? './game-state.json'),
    stateMaxAgeMs: 2 * 60 * 60 * 1000,
  };
}
