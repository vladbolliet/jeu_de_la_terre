import { useEffect, useState } from 'react';
import { Factory, Flag, Scale, Sprout } from 'lucide-react';
import type { PlayerView } from '@jdlt/shared';
import { describeEffects, emissionsBalance } from './effects.ts';

/** Counts from 0 up to `target` (used for the final score). */
function useCountUp(target: number, ms = 1400): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setValue(target);
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

const VERDICT = {
  1: { icon: Factory, tone: 'bad', text: 'Tes choix ont plutôt augmenté les émissions.' },
  0: { icon: Scale, tone: 'neutral', text: "Tes choix n'ont presque pas changé les émissions." },
  [-1]: { icon: Sprout, tone: 'good', text: 'Tes choix ont plutôt réduit les émissions.' },
} as const;

/** End of the game: final score, then the impact of every choice (effects are only sent now). */
export function Ended({ view }: { view: PlayerView }) {
  const green = useCountUp(view.me.green);
  const { trend, polluting, clean } = emissionsBalance(view.history);
  const verdict = VERDICT[trend];
  const VerdictIcon = verdict.icon;
  return (
    <div className="ended">
      <section className="final">
        <div className="final-flag">
          <Flag aria-hidden />
        </div>
        <p className="final-label">Fin de la partie · tes choix verts</p>
        <p className="final-score">
          {green} <small>{view.me.green > 1 ? 'choix verts' : 'choix vert'}</small>
        </p>
        <p className="muted">
          Le classement final compte les choix les plus verts. Ton score de rôle : {view.me.score}{' '}
          pts.
        </p>
      </section>

      <h2 className="section-title">Ton impact</h2>

      {view.history.length === 0 ? (
        <section className="panel">
          <p>Tu n'as joué aucune carte pendant la partie.</p>
        </section>
      ) : (
        <>
          <section className={`panel verdict ${verdict.tone}`}>
            <div className="verdict-icon">
              <VerdictIcon aria-hidden />
            </div>
            <p className="verdict-text">{verdict.text}</p>
            {polluting + clean > 0 && (
              <>
                <div className="balance">
                  <i className="bad" style={{ flexGrow: polluting }} />
                  <i className="good" style={{ flexGrow: clean }} />
                </div>
                <p className="muted balance-legend">
                  <span>
                    <Factory aria-hidden />
                    {polluting === 1 ? '1 choix polluant' : `${polluting} choix polluants`}
                  </span>
                  <span>
                    <Sprout aria-hidden />
                    {clean === 1 ? '1 choix propre' : `${clean} choix propres`}
                  </span>
                </p>
              </>
            )}
          </section>

          <ol className="impact">
            {view.history.map((h, i) => {
              const lines = describeEffects(h.effects ?? {});
              return (
                // Only the first items are staggered: the rest is below the fold.
                <li key={i} style={{ animationDelay: `${0.5 + Math.min(i, 6) * 0.12}s` }}>
                  <span className="impact-year">{h.year}</span>
                  <div className="impact-body">
                    <span className="muted">{h.cardTitle}</span>
                    <strong>{h.optionLabel}</strong>
                    {lines.length ? (
                      <ul className="chips">
                        {lines.map(({ icon: Icon, text, tone }) => (
                          <li key={text} className={tone}>
                            <Icon aria-hidden />
                            {text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Pas d'effet notable.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
      <p className="muted ended-foot">Regarde l'écran principal pour le bilan de la planète.</p>
    </div>
  );
}
