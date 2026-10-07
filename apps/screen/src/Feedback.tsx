import { useEffect, useState } from 'react';
import type { OptionView, ScreenView } from '@jdlt/shared';
import { CLIMATE, SOCIETY, type Indicator } from './Indicators.tsx';
import { TIPPING } from './tipping.ts';

/** How long each global event stays on screen when there are several. */
const EVENT_ROTATE_MS = 6000;

/**
 * Full-screen era summary shown during the `feedback` phase.
 * `voteOptions` are the labels seen during the conflicts phase: VoteResult only
 * carries the winner's label, its tally is keyed by option id.
 */
export function Feedback({ view, voteOptions }: { view: ScreenView; voteOptions: OptionView[] }) {
  const { world } = view;
  // During feedback the world is already resolved: history[last] is the era just played.
  const prev = world.history.at(-1);

  return (
    <section className="feedback">
      <h1 className="feedback-title">
        {prev?.year ?? '…'} <span className="arrow">→</span> {world.year}
      </h1>
      <div className="feedback-body">
        <div className="feedback-changes">
          {CLIMATE.map((ind) => (
            <Change
              key={ind.key}
              ind={ind}
              before={prev?.climate[ind.key]}
              after={world.climate[ind.key]}
            />
          ))}
          {SOCIETY.map((ind) => (
            <Change
              key={ind.key}
              ind={ind}
              before={prev?.society[ind.key]}
              after={world.society[ind.key]}
              minor
            />
          ))}
        </div>
        <div className="feedback-cards">
          {view.newTippingPoints.map((id) => (
            <div key={id} className="card tipping-alert">
              <div className="card-kicker">⚠️ Point de bascule franchi</div>
              <h2>
                {TIPPING[id].icon} {TIPPING[id].label}
              </h2>
              <p>{TIPPING[id].explanation}</p>
            </div>
          ))}
          <Events events={view.events} />
          {view.lastVoteResult && (
            <VoteResultCard result={view.lastVoteResult} options={voteOptions} />
          )}
        </div>
      </div>
    </section>
  );
}

function Change<T>({
  ind,
  before,
  after,
  minor,
}: {
  ind: Indicator<T>;
  before: number | undefined;
  after: number;
  minor?: boolean;
}) {
  // Delta of the displayed (rounded) values, so "65 → 64" never shows "=".
  const round = (v: number) => Number(v.toFixed(ind.digits));
  const delta = before === undefined ? 0 : round(round(after) - round(before));
  const tone = delta === 0 ? 'flat' : delta > 0 === (ind.worse === 'up') ? 'worse' : 'better';
  return (
    <div className={`change ${tone}${minor ? ' minor' : ''}`}>
      <span className="change-label">{ind.label}</span>
      <span className="change-values">
        {before !== undefined && <span className="before">{before.toFixed(ind.digits)} → </span>}
        <strong>
          {after.toFixed(ind.digits)}
          {ind.unit}
        </strong>
      </span>
      <span className="change-delta">
        {delta === 0 ? '=' : `${delta > 0 ? '▲ +' : '▼ '}${delta.toFixed(ind.digits)}`}
      </span>
    </div>
  );
}

function Events({ events }: { events: ScreenView['events'] }) {
  const [index, setIndex] = useState(0);
  const key = events.map((e) => e.id).join();
  useEffect(() => {
    setIndex(0);
    if (events.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % events.length), EVENT_ROTATE_MS);
    return () => clearInterval(id);
    // Restart the rotation only when the set of events changes.
  }, [key]);

  const event = events[index % Math.max(1, events.length)];
  if (!event) return null;
  return (
    <div key={event.id} className="card event">
      <div className="card-kicker">
        📰 Événement{events.length > 1 && ` ${index + 1} / ${events.length}`}
      </div>
      <h2>{event.title}</h2>
      <p>{event.text}</p>
    </div>
  );
}

function VoteResultCard({
  result,
  options,
}: {
  result: NonNullable<ScreenView['lastVoteResult']>;
  options: OptionView[];
}) {
  const label = (id: string) =>
    id === result.winner.id ? result.winner.label : (options.find((o) => o.id === id)?.label ?? id);
  const entries = Object.entries(result.tally).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  return (
    <div className="card vote-result">
      <div className="card-kicker">🗳️ Vote · {result.title}</div>
      <h2>✅ {result.winner.label}</h2>
      {total === 0 ? (
        <p>Personne n'a voté : l'option par défaut s'applique.</p>
      ) : (
        <ul className="tally">
          {entries.map(([id, n]) => (
            <li key={id} className={id === result.winner.id ? 'winner' : ''}>
              <span className="tally-label">{label(id)}</span>
              <div className="tally-bar">
                <div style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
              </div>
              <span className="tally-count">{Math.round(n)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
