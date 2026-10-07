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

const URGENT_S = 10;

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

export function PhaseHeader({ view }: { view: ScreenView }) {
  const { seconds, progress, paused } = usePhaseTimer(view);
  const urgent = !paused && seconds !== null && seconds <= URGENT_S;

  return (
    <header className={`phase-header${urgent ? ' urgent' : ''}`}>
      <div className="phase-row">
        <div className="year">{view.year}</div>
        <div className="phase">{PHASE_LABEL[view.phase]}</div>
        {paused && (
          <div className="paused">
            <Pause className="icon" /> Pause
          </div>
        )}
        {seconds !== null && <div className="timer">{formatTime(seconds)}</div>}
      </div>
      {progress !== null && (
        <div className="progress">
          <div className="progress-fill" style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
    </header>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
