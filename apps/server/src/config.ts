export const config = {
  port: Number(process.env.PORT ?? 3000),
  /** Secret for the host controls on the screen app (?key=...). */
  hostKey: process.env.HOST_KEY ?? 'dev',
  contentDir: process.env.CONTENT_DIR,
  /** Public URL of the game (shown as QR code on the screen), e.g. https://jeu-terre.onrender.com */
  publicUrl: process.env.PUBLIC_URL ?? null,
  /** Phase durations in seconds. Era total ≈ 2 min. */
  durations: {
    choices: Number(process.env.CHOICES_S ?? 60),
    conflicts: Number(process.env.CONFLICTS_S ?? 40),
    feedback: Number(process.env.FEEDBACK_S ?? 20),
  },
  /** Max state broadcasts per second (batches bursts of 100 simultaneous clicks). */
  broadcastHz: 5,
};
