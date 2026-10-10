import { useEffect, useState } from 'react';
import type { OptionView, VoteResult } from '@jdlt/shared';

/** Timeline of the reveal (ms from its start). */
const COUNT_AT = 2400;
const COUNT_MS = 2200;
const STAMP_AT = COUNT_AT + COUNT_MS + 200;
const LEAVE_AT = STAMP_AT + 2800;
const DONE_AT = LEAVE_AT + 600;

type Stage = 'suspense' | 'count' | 'stamp' | 'leave';

/**
 * Full-screen vote count played once when the conflicts phase ends:
 * suspense, bars racing up, then the winner gets stamped. Then it fades away
 * and leaves the regular feedback screen underneath.
 */
export function VoteReveal({
  result,
  options,
  onDone,
}: {
  result: VoteResult;
  options: OptionView[];
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>('suspense');
  const progress = useCountUp(stage !== 'suspense', COUNT_MS);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage('count'), COUNT_AT),
      setTimeout(() => setStage('stamp'), STAMP_AT),
      setTimeout(() => setStage('leave'), LEAVE_AT),
      setTimeout(onDone, DONE_AT),
    ];
    return () => timers.forEach(clearTimeout);
    // Played once per mount; App remounts it for each vote.
  }, []);

  const rows = options.map((o) => ({ ...o, votes: result.tally[o.id] ?? 0 }));
  const total = rows.reduce((sum, o) => sum + o.votes, 0);
  const stamped = stage === 'stamp' || stage === 'leave';

  return (
    <div className={`vote-reveal stage-${stage}`}>
      <div className="reveal-panel">
        <div className="reveal-kicker">{result.title}</div>
        <h2 className="reveal-title">
          {stage === 'suspense'
            ? 'Le monde a choisi…'
            : total === 0
              ? 'Personne n’a voté…'
              : 'Dépouillement'}
        </h2>
        <ol className="reveal-options">
          {rows.map((o, i) => {
            const winner = o.id === result.winner.id;
            const share = total ? o.votes / total : 0;
            return (
              <li
                key={o.id}
                className={stamped ? (winner ? 'winner' : 'loser') : ''}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                <span className="reveal-label">{o.label}</span>
                <span className="reveal-count">
                  {Math.round(o.votes * progress)}
                  <small> · {Math.round(share * progress * 100)} %</small>
                </span>
                <div className="reveal-bar">
                  <div style={{ transform: `scaleX(${share * progress})` }} />
                </div>
                {stamped && winner && (
                  <span className="stamp">{total === 0 ? 'Par défaut' : 'Adopté'}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** 0 → 1 with an ease-out once `running` turns true. */
function useCountUp(running: boolean, ms: number) {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      setP(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, ms]);
  return p;
}
