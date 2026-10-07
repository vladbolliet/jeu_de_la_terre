import { useEffect, useState } from 'react';
import type { CardView, PlayerView } from '@jdlt/shared';
import { join, socket, storage } from './socket.ts';
import { useCountdown } from './useCountdown.ts';

export function App() {
  const [view, setView] = useState<PlayerView | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.on('player:state', setView);
    socket.on('connect', () => {
      setConnected(true);
      // Auto re-join after reconnect if we already have an identity.
      if (storage.token) join(storage.name).catch(() => (storage.token = undefined));
    });
    socket.on('disconnect', () => setConnected(false));
    socket.connect();
    return () => {
      socket.off('player:state');
      socket.off('connect');
      socket.off('disconnect');
      socket.disconnect();
    };
  }, []);

  if (!view) return <JoinScreen connected={connected} />;
  return (
    <main>
      {!connected && <div className="banner">Reconnexion…</div>}
      <Header view={view} />
      <PhaseBody view={view} />
    </main>
  );
}

function JoinScreen({ connected }: { connected: boolean }) {
  const [name, setName] = useState(storage.name);
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="center">
      <h1>Jeu de la Terre</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          join(name).catch((err: Error) => setError(err.message));
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ton prénom"
          maxLength={24}
          autoFocus
        />
        <button disabled={!connected || !name.trim()}>Rejoindre</button>
      </form>
      {error && <p className="error">{error}</p>}
    </main>
  );
}

function Header({ view }: { view: PlayerView }) {
  const seconds = useCountdown(view.phaseEndsAt);
  return (
    <header>
      <div>
        <strong>{view.me.roleName}</strong> · {view.me.name}
        <div className="objective">{view.me.objective}</div>
      </div>
      <div className="right">
        <div className="year">{view.year}</div>
        <div>
          {view.me.score} pts{seconds !== null && ` · ${seconds}s`}
        </div>
      </div>
    </header>
  );
}

function PhaseBody({ view }: { view: PlayerView }) {
  switch (view.phase) {
    case 'lobby':
      return <p className="center">En attente du lancement de la partie…</p>;
    case 'choices':
      return view.hand.length ? (
        <>
          {view.hand.map((c) => (
            <Card key={c.instanceId} card={c} />
          ))}
        </>
      ) : (
        <Outcomes view={view} waiting="Choix enregistré. Regarde l'écran !" />
      );
    case 'conflicts':
      return view.vote ? <Vote view={view} /> : <p className="center">Pas de vote cette ère.</p>;
    case 'feedback':
      return <Outcomes view={view} waiting="Regarde l'écran principal." />;
    case 'ended':
      return <p className="center">Fin de la partie ! Score final : {view.me.score} pts</p>;
  }
}

function Card({ card }: { card: CardView }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="card">
      {card.fromPlayer && <div className="from">De la part de {card.fromPlayer}</div>}
      <h2>{card.title}</h2>
      <p>{card.text}</p>
      {card.options.map((o) => (
        <button
          key={o.id}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            socket.emit('player:choose', { instanceId: card.instanceId, optionId: o.id }, () =>
              setBusy(false),
            );
          }}
        >
          {o.label}
        </button>
      ))}
    </section>
  );
}

function Vote({ view }: { view: PlayerView }) {
  const vote = view.vote!;
  return (
    <section className="card">
      <h2>🗳️ {vote.title}</h2>
      <p>{vote.text}</p>
      {vote.options.map((o) => (
        <button
          key={o.id}
          className={vote.myChoice === o.id ? 'selected' : ''}
          onClick={() => socket.emit('player:vote', { voteId: vote.id, optionId: o.id }, () => {})}
        >
          {o.label}
        </button>
      ))}
    </section>
  );
}

function Outcomes({ view, waiting }: { view: PlayerView; waiting: string }) {
  return (
    <section className="center">
      {view.outcomes.map((o, i) => (
        <p key={i} className="outcome">
          {o}
        </p>
      ))}
      {view.lastVoteResult && (
        <p>
          Vote « {view.lastVoteResult.title} » : <strong>{view.lastVoteResult.winner.label}</strong>
        </p>
      )}
      <p className="muted">{waiting}</p>
    </section>
  );
}
