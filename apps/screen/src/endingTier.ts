/**
 * Ending of the game, picked from the final temperature anomaly (IPCC thresholds).
 * Presentation only: the world itself is computed by the server.
 */
export type EndingTier = 'preserved' | 'strained' | 'damaged' | 'scorched';

export function endingTier(temperature: number): EndingTier {
  if (temperature < 1.5) return 'preserved';
  if (temperature < 2) return 'strained';
  if (temperature < 3) return 'damaged';
  return 'scorched';
}

// Placeholder texts, to be reviewed by the designers.
export const ENDINGS: Record<EndingTier, { title: string; verdict: string; conclusion: string }> = {
  preserved: {
    title: 'Une planète préservée',
    verdict: "L'accord de Paris est tenu : le réchauffement reste sous +1,5 °C.",
    conclusion:
      "Vos choix ont payé : les écosystèmes ont tenu bon et les sociétés ont eu le temps de s'adapter. Ce futur est possible, mais il demande d'agir tôt et ensemble.",
  },
  strained: {
    title: 'Une planète sous tension',
    verdict: 'Le seuil de +2 °C est évité, de justesse.',
    conclusion:
      'Canicules et sécheresses sont devenues fréquentes, mais le pire a été évité. Chaque dixième de degré compte : quelques choix de plus auraient tout changé.',
  },
  damaged: {
    title: 'Une planète abîmée',
    verdict: 'Le seuil de +2 °C est dépassé : des équilibres ont cédé.',
    conclusion:
      "Des points de bascule ont été franchis et ne reviendront pas en arrière. Le réchauffement n'est pas une fatalité : il dépend des décisions individuelles et collectives que nous prenons aujourd'hui.",
  },
  scorched: {
    title: 'Une planète en surchauffe',
    verdict: 'Plus de +3 °C : le climat s’est emballé.',
    conclusion:
      "Feux, montée des eaux, effondrement du vivant : c'est le scénario que les scientifiques veulent éviter. Rien n'est écrit : le climat de 2100 dépend des décisions que nous prenons aujourd'hui.",
  },
};
