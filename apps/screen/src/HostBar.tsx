import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Type,
  Users,
} from 'lucide-react';
import type { ScreenView } from '@jdlt/shared';
import { hostCommand } from './socket.ts';
import {
  applyFontScale,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  readFontScale,
} from './fontScale.ts';

const COLLAPSED_KEY = 'jdlt.hostbar.collapsed';
/** Mouse idle time after which the controls (and cursor) hide. */
const IDLE_MS = 5000;

// Per-viewer convenience only: storage may be unavailable (private mode…).
// Folded by default so nothing covers the projected screen.
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) !== '0';
  } catch {
    return true;
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
  const [fontScale, setFontScale] = useState(readFontScale);
  const changeFontScale = (delta: number) => setFontScale(applyFontScale(fontScale + delta));
  const hovering = useRef(false);
  const toggle = (value: boolean) => {
    hovering.current = false;
    setCollapsed(value);
    saveCollapsed(value);
  };

  // After IDLE_MS without mouse movement: fold the bar, hide the round
  // button and the cursor. Any movement brings the round button back.
  // Not while the pointer rests on the bar.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = 0;
    const arm = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (hovering.current) return arm();
        setIdle(true);
        setCollapsed(true);
        saveCollapsed(true);
      }, IDLE_MS);
    };
    const wake = () => {
      setIdle(false);
      arm();
    };
    arm();
    window.addEventListener('mousemove', wake);
    window.addEventListener('mousedown', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('mousedown', wake);
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('pointer-idle', idle);
    return () => document.body.classList.remove('pointer-idle');
  }, [idle]);

  if (collapsed)
    return (
      <button
        className={`hostbar-fab${idle ? ' idle' : ''}`}
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
    <div
      className="hostbar"
      role="toolbar"
      aria-label="Commandes de l'hôte"
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
    >
      <div className="hostbar-status">
        <span className={`hostbar-dot${timed && !running ? ' paused' : ''}`} />
        <span className="hostbar-title">Hôte</span>
        <span className="hostbar-players">
          <Users className="icon" />
          {view.connectedCount}
          <span className="hostbar-muted">/{view.playerCount}</span>
        </span>
      </div>
      <div className="hostbar-font" role="group" aria-label="Taille du texte">
        <button
          className="hb-font-btn"
          onClick={() => changeFontScale(-FONT_SCALE_STEP)}
          disabled={fontScale <= FONT_SCALE_MIN}
          aria-label="Réduire le texte"
          title="Réduire le texte"
        >
          <Type className="icon small" />
        </button>
        <button
          className="hb-font-value"
          onClick={() => setFontScale(applyFontScale(1))}
          title="Taille du texte (cliquer pour revenir à 100 %)"
        >
          {Math.round(fontScale * 100)} %
        </button>
        <button
          className="hb-font-btn"
          onClick={() => changeFontScale(FONT_SCALE_STEP)}
          disabled={fontScale >= FONT_SCALE_MAX}
          aria-label="Agrandir le texte"
          title="Agrandir le texte"
        >
          <Type className="icon" />
        </button>
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
