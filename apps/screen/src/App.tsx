import { useEffect, useState } from 'react';
import type { ScreenView } from '@jdlt/shared';
import { hostCommand, hostKey, socket } from './socket.ts';
import { useCountdown } from './useCountdown.ts';
import { WorldMap } from './WorldMap.tsx';
import { Indicators } from './Indicators.tsx';
import { Lobby } from './Lobby.tsx';

const PHASE_LABEL: Record<ScreenView['phase'], string> = {
  lobby: 'En attente des joueurs',
  choices: 'Phase 1 · Microchoix',
  conflicts: 'Phase 2 · Conflits',
  feedback: 'Phase 3 · Bilan',
  ended: 'Fin de la partie',
};

export function App() {
  const [view, setView] = useState<ScreenView | null>(null);

  useEffect(() => {
    socket.on('connect', () => socket.emit('screen:join'));
    socket.on('screen:state', setView);
    socket.connect();
    return () => {
      socket.off('connect');
      socket.off('screen:state');
      socket.disconnect();
    };
  }, []);

  const seconds = useCountdown(view?.phaseEndsAt ?? null);
  if (!view) return <div className="loading">Connexion au serveur…</div>;

  if (view.phase === 'lobby')
    return (
      <>
        <Lobby view={view} />
        {hostKey && <HostBar view={view} />}
      </>
    );

  return (
    <div className="layout">
      <header>
        <div className="year">{view.year}</div>
        <div className="phase">{PHASE_LABEL[view.phase]}</div>
        <div className="timer">{seconds !== null ? `${seconds}s` : ''}</div>
      </header>
      <section className="map">
        <WorldMap world={view.world} />
      </section>
      <aside>
        <Indicators world={view.world} />
        <PhasePanel view={view} />
      </aside>
      {hostKey && <HostBar view={view} />}
    </div>
  );
}

function PhasePanel({ view }: { view: ScreenView }) {
  switch (view.phase) {
    case 'lobby':
      return null;
    case 'choices':
      return (
        <div className="panel">
          <h2>
            {view.choicesMade} / {view.cardsDealt} choix
          </h2>
        </div>
      );
    case 'conflicts':
      return (
        <div className="panel">
          {view.vote ? (
            <>
              <h2>🗳️ {view.vote.title}</h2>
              <p>{view.vote.text}</p>
              <p>{view.vote.ballots} votes</p>
            </>
          ) : (
            <h2>Pas de vote cette ère</h2>
          )}
        </div>
      );
    case 'feedback':
    case 'ended':
      return (
        <div className="panel">
          {view.lastVoteResult && (
            <p>
              Vote « {view.lastVoteResult.title} » →{' '}
              <strong>{view.lastVoteResult.winner.label}</strong>
            </p>
          )}
          {view.newTippingPoints.map((t) => (
            <p key={t} className="alert">
              ⚠️ Point de bascule franchi : {t}
            </p>
          ))}
        </div>
      );
  }
}

function HostBar({ view }: { view: ScreenView }) {
  return (
    <div className="hostbar">
      <span>
        Hôte · {view.connectedCount}/{view.playerCount} connectés
      </span>
      {view.phase === 'lobby' && <button onClick={() => hostCommand('start')}>Lancer</button>}
      <button onClick={() => hostCommand('next')}>Phase suivante</button>
      <button onClick={() => hostCommand(view.phaseEndsAt ? 'pause' : 'resume')}>
        {view.phaseEndsAt ? 'Pause' : 'Reprendre'}
      </button>
      <button onClick={() => confirm('Réinitialiser la partie ?') && hostCommand('reset')}>
        Reset
      </button>
    </div>
  );
}
