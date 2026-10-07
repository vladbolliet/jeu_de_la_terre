import { useEffect, useRef, useState } from 'react';
import type { OptionView, ScreenView } from '@jdlt/shared';
import { hostKey, socket } from './socket.ts';
import { HostBar } from './HostBar.tsx';
import { PhaseHeader } from './PhaseHeader.tsx';
import { WorldMap } from './WorldMap.tsx';
import { Indicators } from './Indicators.tsx';
import { Lobby } from './Lobby.tsx';
import { ChoicesPanel, VotePanel } from './PhasePanels.tsx';
import { Feedback } from './Feedback.tsx';
import { Ending } from './Ending.tsx';

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
      </aside>
      {hostKey && <HostBar view={view} />}
    </div>
  );
}
