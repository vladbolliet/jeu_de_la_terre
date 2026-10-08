import { useEffect, useState, type ReactNode } from 'react';
import { Users, Vote } from 'lucide-react';
import type { ScreenView } from '@jdlt/shared';
import { ROLES, ROLE_ICON, ROLE_LABEL } from './roles.ts';
import { Hemicycle } from './Hemicycle.tsx';
import { URGENT_S } from './PhaseHeader.tsx';

/**
 * `meanEmissions` is in −10…+10 but real cards stay within a few points, so the
 * bars are scaled to the most extreme role of the era, never below this floor
 * (keeps tiny differences from looking huge).
 */
const MIN_SCALE = 4;
/** Below this mean (in absolute value) the era reads as neutral. */
const NEUTRAL = 0.5;

/** Progress ring with the count in the middle. */
function Ring({ ratio, children }: { ratio: number; children: ReactNode }) {
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle className="ring-track" cx="50" cy="50" r="42" />
        <circle
          className="ring-arc"
          cx="50"
          cy="50"
          r="42"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1 - ratio}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function ChoicesPanel({ view }: { view: ScreenView }) {
  const ratio = view.cardsDealt ? Math.min(1, view.choicesMade / view.cardsDealt) : 0;
  const scale = Math.max(MIN_SCALE, ...ROLES.map((r) => Math.abs(view.roleStats[r].meanEmissions)));
  return (
    <>
      <div className="panel-kicker">
        <Users className="icon" /> Choix des joueurs
      </div>
      <div className="panel choices-panel">
        <div className="choices-head">
          <Ring ratio={ratio}>
            <strong key={view.choicesMade} className="ring-count">
              {view.choicesMade}
            </strong>
          </Ring>
          <div className="choices-count">
            <span>sur {view.cardsDealt}</span>
            <span>choix faits</span>
          </div>
        </div>
        <div className="emissions-legend">
          <span className="less">◀ Moins polluant</span>
          <span className="more">Plus polluant ▶</span>
        </div>
        <ul className="role-bars">
          {ROLES.map((role) => {
            const { choices, meanEmissions } = view.roleStats[role];
            const share = (Math.abs(meanEmissions) / scale) * 50;
            const Icon = ROLE_ICON[role];
            return (
              <li key={role} className={`role-${role}${choices ? '' : ' waiting'}`}>
                <span className="role-badge">
                  <Icon strokeWidth={2.4} />
                </span>
                <span className="role-name">{ROLE_LABEL[role]}</span>
                <div className="diverging">
                  <div className="axis" />
                  {choices > 0 && (
                    <div
                      className={`bar ${meanEmissions > 0 ? 'more' : 'less'}`}
                      style={
                        meanEmissions > 0
                          ? { left: '50%', width: `${share}%` }
                          : { right: '50%', width: `${share}%` }
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <EraTrend view={view} scale={scale} />
      </div>
    </>
  );
}

/** Needle gauge: is this era's mix of choices sober or polluting overall? */
function EraTrend({ view, scale }: { view: ScreenView; scale: number }) {
  let total = 0;
  let sum = 0;
  for (const r of ROLES) {
    total += view.roleStats[r].choices;
    sum += view.roleStats[r].choices * view.roleStats[r].meanEmissions;
  }
  const mean = total ? sum / total : 0;
  const angle = Math.max(-1, Math.min(1, mean / scale)) * 90;
  const [label, cls] = !total
    ? ['En attente des choix…', 'waiting']
    : mean > NEUTRAL
      ? ['Ère plutôt polluante', 'more']
      : mean < -NEUTRAL
        ? ['Ère plutôt sobre', 'less']
        : ['Ère équilibrée', 'neutral'];
  return (
    <div className={`era-trend ${cls}`}>
      <svg viewBox="0 0 200 110" aria-hidden>
        <defs>
          <linearGradient id="trend-gradient" x1="0" x2="1">
            <stop offset="0" stopColor="#12804a" />
            <stop offset="0.5" stopColor="#e2b23b" />
            <stop offset="1" stopColor="#cc3216" />
          </linearGradient>
        </defs>
        <path
          className="trend-arc"
          d="M20,100 A80,80 0 0 1 180,100"
          stroke="url(#trend-gradient)"
        />
        <g className="trend-needle" style={{ transform: `rotate(${angle}deg)` }}>
          <line x1="100" y1="100" x2="100" y2="34" />
          <circle cx="100" cy="100" r="9" />
        </g>
      </svg>
      <span className="trend-label">{label}</span>
    </div>
  );
}

/** True during the last `URGENT_S` seconds of the phase (false while paused). */
function useFinalStretch(endsAt: number | null) {
  const [, rerender] = useState(0);
  const ms = URGENT_S * 1000;
  useEffect(() => {
    if (!endsAt) return;
    const wait = endsAt - ms - Date.now();
    if (wait <= 0) return;
    const id = setTimeout(() => rerender((n) => n + 1), wait);
    return () => clearTimeout(id);
  }, [endsAt, ms]);
  return endsAt !== null && endsAt - Date.now() <= ms;
}

export function VotePanel({ view }: { view: ScreenView }) {
  const { vote } = view;
  const final = useFinalStretch(view.phaseEndsAt);
  if (!vote)
    return (
      <div className="vote-panel">
        <h2 className="vote-title">Pas de vote cette ère</h2>
      </div>
    );
  return (
    <div className={`vote-panel${final ? ' final' : ''}`}>
      <div className="vote-main">
        <div className="vote-kicker">
          <Vote className="icon" /> Vote collectif
        </div>
        <h2 className="vote-title">{vote.title}</h2>
        <p className="vote-text">{vote.text}</p>
        <ol className="vote-options">
          {vote.options.map((o, i) => (
            <li key={o.id} style={{ animationDelay: `${0.2 + i * 0.12}s` }}>
              <span className="option-letter">{String.fromCharCode(65 + i)}</span>
              {o.label}
            </li>
          ))}
        </ol>
      </div>
      <div className="vote-side">
        <Hemicycle voteId={vote.id} ballots={vote.ballots} voters={view.connectedCount} />
      </div>
    </div>
  );
}
