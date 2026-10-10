import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
import { EraTimeline } from './EraTimeline.tsx';
import { VoteReveal } from './VoteReveal.tsx';
import { ClipPlayer } from './ClipPlayer.tsx';
import { clipsForEra, type Clip } from './clips.ts';
import { heat } from './stripes.ts';

// The flat map stays as a fallback for machines without WebGL.
const HAS_WEBGL = webglAvailable();

export function App() {
  const [view, setView] = useState<ScreenView | null>(null);
  // Option labels of the current vote, kept for the feedback phase (see Feedback.tsx).
  const voteOptions = useRef<OptionView[]>([]);
  if (view?.vote) voteOptions.current = view.vote.options;

  // The vote count is played only when we see conflicts turn into feedback live,
  // not when the screen is (re)loaded in the middle of the feedback phase.
  // Same for the era's clips, which play once the vote count is done. Clips that
  // don't fit in the feedback phase wait for the next one (or the ending).
  const [reveal, setReveal] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  // Feedback/ended screen whose clip session is over, so it doesn't restart.
  const [clipsDoneFor, setClipsDoneFor] = useState<string | null>(null);
  const lastPhase = useRef(view?.phase);
  useLayoutEffect(() => {
    const before = lastPhase.current;
    lastPhase.current = view?.phase;
    if (view?.phase === 'lobby') setClips([]);
    if (view?.phase !== 'feedback') {
      setReveal(null);
      return;
    }
    if (before === 'conflicts' && view.lastVoteResult && voteOptions.current.length)
      setReveal(view.lastVoteResult.voteId);
    if (before && before !== 'feedback') setClips((queue) => [...queue, ...clipsForEra(view)]);
  }, [view?.phase]);

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

  // The whole screen warms up with the planet (see .layout in styles.css).
  const heatStyle = { '--heat': heat(view.world.climate.temperature) } as CSSProperties;

  const clipSession = `${view.phase}-${view.world.year}`;
  if (view.phase === 'feedback' || view.phase === 'ended')
    return (
      <div className="layout full-layout" style={heatStyle}>
        <PhaseHeader view={view} />
        {view.phase === 'feedback' ? (
          <Feedback view={view} voteOptions={voteOptions.current} />
        ) : (
          <Ending view={view} />
        )}
        {reveal && view.lastVoteResult?.voteId === reveal && (
          <VoteReveal
            key={reveal}
            result={view.lastVoteResult}
            options={voteOptions.current}
            onDone={() => setReveal(null)}
          />
        )}
        {!reveal && clips.length > 0 && clipsDoneFor !== clipSession && (
          <ClipPlayer
            key={clipSession}
            clips={clips}
            endsAt={view.phase === 'feedback' ? view.phaseEndsAt : null}
            onDone={(played) => {
              setClips((queue) => queue.filter((c) => !played.includes(c.key)));
              setClipsDoneFor(clipSession);
            }}
          />
        )}
        {hostKey && <HostBar view={view} />}
      </div>
    );

  // Three columns: what players do · the Earth · the state of the planet,
  // over the eras timeline. The vote takes over the first two during the conflicts phase.
  return (
    <div className="layout game-layout" style={heatStyle}>
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
      <EraTimeline world={view.world} />
      {hostKey && <HostBar view={view} />}
    </div>
  );
}
