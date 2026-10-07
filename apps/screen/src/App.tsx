import { useEffect, useState } from 'react';
import type { ScreenView } from '@jdlt/shared';
import { hostCommand, hostKey, socket } from './socket.ts';
import { PhaseHeader } from './PhaseHeader.tsx';
import { WorldMap } from './WorldMap.tsx';
import { Indicators } from './Indicators.tsx';
import { Lobby } from './Lobby.tsx';
import { ChoicesPanel, VotePanel } from './PhasePanels.tsx';

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
      <PhaseHeader view={view} />
      <section className="stage">
        {view.phase === 'conflicts' ? (
          <VotePanel view={view} />
        ) : (
          <>
            <div className="map">
              <WorldMap world={view.world} />
            </div>
            {view.phase === 'choices' && <ChoicesPanel view={view} />}
          </>
        )}
      </section>
      <aside>
        <Indicators world={view.world} />
        <ResultPanel view={view} />
      </aside>
      {hostKey && <HostBar view={view} />}
    </div>
  );
}

function ResultPanel({ view }: { view: ScreenView }) {
  switch (view.phase) {
    case 'lobby':
    case 'choices':
    case 'conflicts':
      return null;
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
