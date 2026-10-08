import { useEffect, useRef, useState } from 'react';
import { Pause } from 'lucide-react';
import type { ScreenView } from '@jdlt/shared';

const PHASE_LABEL: Record<ScreenView['phase'], string> = {
  lobby: 'En attente des joueurs',
  choices: 'Phase 1 · Microchoix',
  conflicts: 'Phase 2 · Conflits',
  feedback: 'Phase 3 · Bilan',
  ended: 'Fin de la partie',
};

export const URGENT_S = 10;

/**
 * Countdown + progress for the current phase.
 * ScreenView has no phase duration, so the total is estimated from the first
 * `phaseEndsAt` seen for a given (year, phase); resuming after a pause keeps it.
 * A screen reloaded mid-phase therefore starts its bar from the current point.
 */
function usePhaseTimer(view: ScreenView) {
  const key = `${view.year}-${view.phase}`;
  const durationRef = useRef<{ key: string; ms: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  const endsAt = view.phaseEndsAt;
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [endsAt]);

  if (endsAt && durationRef.current?.key !== key) {
    durationRef.current = { key, ms: Math.max(1, endsAt - Date.now()) };
  }
  // Remember the remaining time when the host pauses, to freeze the display.
  const lastRemainingRef = useRef<number | null>(null);
  if (endsAt) lastRemainingRef.current = Math.max(0, endsAt - now);

  const timed = view.phase === 'choices' || view.phase === 'conflicts' || view.phase === 'feedback';
  const paused = timed && !endsAt;
  const remainingMs = endsAt ? Math.max(0, endsAt - now) : paused ? lastRemainingRef.current : null;
  const totalMs = durationRef.current?.key === key ? durationRef.current.ms : null;

  return {
    seconds: remainingMs !== null ? Math.ceil(remainingMs / 1000) : null,
    progress: remainingMs !== null && totalMs ? Math.min(1, 1 - remainingMs / totalMs) : null,
    paused,
  };
}

const STEPS = [
  { phase: 'choices', label: 'Microchoix' },
  { phase: 'conflicts', label: 'Conflits' },
  { phase: 'feedback', label: 'Bilan' },
] as const;

export function PhaseHeader({ view }: { view: ScreenView }) {
  const { seconds, progress, paused } = usePhaseTimer(view);
  const urgent = !paused && seconds !== null && seconds <= URGENT_S;
  const step = STEPS.findIndex((s) => s.phase === view.phase);

  return (
    <header className={`phase-header${urgent ? ' urgent' : ''}`}>
      <div className="year-block">
        <div key={view.year} className="year">
          {view.year}
        </div>
        {view.phase !== 'ended' && <div className="year-range">→ {view.year + 20}</div>}
      </div>
      {step === -1 ? (
        <div className="phase">{PHASE_LABEL[view.phase]}</div>
      ) : (
        <ol className="phase-steps" aria-label={PHASE_LABEL[view.phase]}>
          {STEPS.map((s, i) => (
            <li key={s.phase} className={i < step ? 'done' : i === step ? 'current' : ''}>
              <span className="step-num">{i + 1}</span>
              <span className="step-label">{s.label}</span>
            </li>
          ))}
        </ol>
      )}
      {(seconds !== null || paused) && (
        <RingTimer seconds={seconds} progress={progress} paused={paused} />
      )}
    </header>
  );
}

/** Countdown ring: the coloured arc empties as the phase runs out. */
function RingTimer({
  seconds,
  progress,
  paused,
}: {
  /** Null when the screen was loaded while the game was paused. */
  seconds: number | null;
  progress: number | null;
  paused: boolean;
}) {
  return (
    <div className={`ring-timer${paused ? ' is-paused' : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle className="ring-track" cx="50" cy="50" r="44" />
        <circle
          className="ring-arc"
          cx="50"
          cy="50"
          r="44"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={progress ?? 0}
        />
      </svg>
      <div className="ring-center">
        {paused || seconds === null ? (
          <Pause className="ring-pause" />
        ) : (
          <span className="timer">{formatTime(seconds)}</span>
        )}
      </div>
      {paused && <div className="ring-paused-label">Pause</div>}
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
