import { useEffect, useState, type CSSProperties } from 'react';
import type { CardView, PlayerView } from '@jdlt/shared';
import { join, socket, storage } from './socket.ts';
import { ROLE_STYLE } from './roles.ts';
import { useCountdown } from './useCountdown.ts';

function roleVars(view: PlayerView): CSSProperties {
  return { '--role': ROLE_STYLE[view.me.role].color } as CSSProperties;
}

export function App() {
  const [view, setView] = useState<PlayerView | null>(null);
  const [connected, setConnected] = useState(false);
  const [roleSeen, setRoleSeen] = useState(storage.roleSeen);

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
  if (roleSeen !== view.me.id)
    return (
      <RoleReveal
        view={view}
        onDone={() => {
          storage.roleSeen = view.me.id;
          setRoleSeen(view.me.id);
        }}
      />
    );
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="join">
      <div className="join-logo">🌍</div>
      <h1>Jeu de la Terre</h1>
      <p className="muted">1900 → 2100 : à toi de jouer.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          join(name.trim())
            .catch((err: Error) => setError(err.message))
            .finally(() => setBusy(false));
        }}
      >
        <label htmlFor="name">Ton prénom</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Awa"
          maxLength={24}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="go"
          autoFocus
        />
        <button className="primary" disabled={!connected || busy || !name.trim()}>
          {busy ? 'Inscription…' : 'Rejoindre la partie'}
        </button>
      </form>
      {!connected && <p className="muted">Connexion au serveur…</p>}
      {error && <p className="error">{error}</p>}
    </main>
  );
}

function RoleReveal({ view, onDone }: { view: PlayerView; onDone: () => void }) {
  return (
    <main className="reveal" style={roleVars(view)}>
      <div className="reveal-body">
        <p className="reveal-hello">{view.me.name}, tu es</p>
        <div className="reveal-icon">{ROLE_STYLE[view.me.role].icon}</div>
        <h1>{view.me.roleName}</h1>
        <p className="reveal-label">Ton objectif</p>
        <p className="reveal-objective">{view.me.objective}</p>
      </div>
      <button onClick={onDone}>Compris</button>
    </main>
  );
}

function Header({ view }: { view: PlayerView }) {
  const seconds = useCountdown(view.phaseEndsAt);
  return (
    <header style={roleVars(view)}>
      <div>
        <span className="role-chip">
          {ROLE_STYLE[view.me.role].icon} {view.me.roleName}
        </span>{' '}
        {view.me.name}
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
