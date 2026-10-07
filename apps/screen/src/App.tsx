import { useEffect, useRef, useState } from 'react';
import type { OptionView, ScreenView } from '@jdlt/shared';
import { hostKey, socket } from './socket.ts';
import { HostBar } from './HostBar.tsx';
import { PhaseHeader } from './PhaseHeader.tsx';
import { WorldMap } from './WorldMap.tsx';
import { EarthGlobe } from './EarthGlobe.tsx';
import { webglAvailable } from './webgl.ts';
import { Indicators } from './Indicators.tsx';
import { Lobby } from './Lobby.tsx';
import { ChoicesPanel, VotePanel } from './PhasePanels.tsx';
import { Feedback } from './Feedback.tsx';
import { Ending } from './Ending.tsx';

// The flat map stays as a fallback for machines without WebGL.
const HAS_WEBGL = webglAvailable();

export function App() {
  const [view, setView] = useState<ScreenView | null>(null);
  // Option labels of the current vote, kept for the feedback phase (see Feedback.tsx).
  const voteOptions = useRef<OptionView[]>([]);
  if (view?.vote) voteOptions.current = view.vote.options;

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

  if (view.phase === 'feedback' || view.phase === 'ended')
    return (
      <div className="layout full-layout">
        <PhaseHeader view={view} />
        {view.phase === 'feedback' ? (
          <Feedback view={view} voteOptions={voteOptions.current} />
        ) : (
          <Ending view={view} />
        )}
        {hostKey && <HostBar view={view} />}
      </div>
    );

  // Three columns: what players do · the Earth · the state of the planet.
  // The vote takes over the first two during the conflicts phase.
  return (
    <div className="layout game-layout">
      <PhaseHeader view={view} />
      {view.phase === 'conflicts' ? (
        <section className="vote-stage">
          <VotePanel view={view} />
        </section>
      ) : (
        <>
          <section className="players">
            <ChoicesPanel view={view} />
          </section>
          <section className="stage">
            <div className="map">
              {HAS_WEBGL ? <EarthGlobe world={view.world} /> : <WorldMap world={view.world} />}
            </div>
          </section>
        </>
      )}
      <aside>
        <Indicators world={view.world} />
      </aside>
      {hostKey && <HostBar view={view} />}
    </div>
  );
}
