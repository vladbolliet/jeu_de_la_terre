import { useState } from 'react';
import {
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import type { ScreenView } from '@jdlt/shared';
import { hostCommand } from './socket.ts';

const COLLAPSED_KEY = 'jdlt.hostbar.collapsed';

// Per-viewer convenience only: storage may be unavailable (private mode…).
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}
function saveCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
}

/** Floating host controls; can be folded into a small round button. */
export function HostBar({ view }: { view: ScreenView }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = (value: boolean) => {
    setCollapsed(value);
    saveCollapsed(value);
  };

  if (collapsed)
    return (
      <button
        className="hostbar-fab"
        onClick={() => toggle(false)}
        aria-label="Afficher les commandes de l'hôte"
        title="Commandes de l'hôte"
      >
        <SlidersHorizontal />
      </button>
    );

  const running = view.phaseEndsAt !== null;
  const timed = view.phase !== 'lobby' && view.phase !== 'ended';

  return (
    <div className="hostbar" role="toolbar" aria-label="Commandes de l'hôte">
      <div className="hostbar-status">
        <span className={`hostbar-dot${timed && !running ? ' paused' : ''}`} />
        <span className="hostbar-title">Hôte</span>
        <span className="hostbar-players">
          <Users className="icon" />
          {view.connectedCount}
          <span className="hostbar-muted">/{view.playerCount}</span>
        </span>
      </div>
      <div className="hostbar-actions">
        {view.phase === 'lobby' ? (
          <button className="hb-btn primary" onClick={() => hostCommand('start')}>
            <Play className="icon" /> Lancer la partie
          </button>
        ) : (
          <>
            {timed && (
              <button className="hb-btn" onClick={() => hostCommand(running ? 'pause' : 'resume')}>
                {running ? <Pause className="icon" /> : <Play className="icon" />}
                {running ? 'Pause' : 'Reprendre'}
              </button>
            )}
            {view.phase !== 'ended' && (
              <button className="hb-btn primary" onClick={() => hostCommand('next')}>
                <SkipForward className="icon" /> Phase suivante
              </button>
            )}
          </>
        )}
        <button
          className="hb-btn danger"
          onClick={() => confirm('Réinitialiser la partie ?') && hostCommand('reset')}
          title="Réinitialiser la partie"
        >
          <RotateCcw className="icon" />
        </button>
      </div>
      <button
        className="hb-collapse"
        onClick={() => toggle(true)}
        aria-label="Replier les commandes"
        title="Replier"
      >
        <ChevronDown />
      </button>
    </div>
  );
}
