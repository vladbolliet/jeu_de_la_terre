import { useEffect, useState, type CSSProperties } from 'react';
import type { CardView, PlayerView } from '@jdlt/shared';
import { choose, join, socket, storage, vote as sendVote } from './socket.ts';
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
    // Forget the saved identity and go back to the join screen.
    const forget = () => {
      storage.token = undefined;
      setView(null);
    };
    socket.on('player:state', setView);
    // The host reset the game.
    socket.on('player:kicked', forget);
    socket.on('connect', () => {
      setConnected(true);
      // Auto re-join after reconnect if we already have an identity.
      if (storage.token) join(storage.name).catch(forget);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.connect();
    return () => {
      socket.off('player:state');
      socket.off('player:kicked');
      socket.off('connect');
      socket.off('disconnect');
      socket.disconnect();
    };
  }, []);

  if (!view) return <JoinScreen connected={connected} />;
  if (roleSeen !== view.me.id)
    return (
      <>
        {!connected && <div className="banner">Reconnexion…</div>}
        <RoleReveal
          view={view}
          onDone={() => {
            storage.roleSeen = view.me.id;
            setRoleSeen(view.me.id);
          }}
        />
      </>
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
      return <Choices key={view.year} view={view} />;
    case 'conflicts':
      return view.vote ? <Vote view={view} /> : <p className="center">Pas de vote cette ère.</p>;
    case 'feedback':
      return <Outcomes view={view} waiting="Regarde l'écran principal." />;
    case 'ended':
      return <p className="center">Fin de la partie ! Score final : {view.me.score} pts</p>;
  }
}

/** Choices phase: one card at a time, then the outcome of the choice, then waiting for the others. */
function Choices({ view }: { view: PlayerView }) {
  // Card being sent: kept on screen even if a state push removes it from the hand before the ack.
  const [sending, setSending] = useState<CardView | null>(null);
  // Cards already answered: state pushes are throttled, so the hand can lag behind the ack.
  const [played, setPlayed] = useState<string[]>([]);
  const [result, setResult] = useState<{ outcome: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hand = view.hand.filter((c) => !played.includes(c.instanceId));

  if (result)
    return (
      <section className="result">
        <div className="result-check">✓</div>
        <p className="result-outcome">{result.outcome ?? 'Choix enregistré.'}</p>
        {hand.length ? (
          <button className="primary" onClick={() => setResult(null)}>
            {hand.length > 1 ? `Cartes suivantes (${hand.length})` : 'Carte suivante'}
          </button>
        ) : (
          <p className="muted waiting">En attente des autres joueurs…</p>
        )}
      </section>
    );

  // Cards sent by another player come first.
  const card = sending ?? hand.find((c) => c.fromPlayer) ?? hand[0];
  if (!card) return <Outcomes view={view} waiting="En attente des autres joueurs…" />;

  const others = hand.filter((c) => c.instanceId !== card.instanceId).length;
  return (
    <>
      <section key={card.instanceId} className={card.fromPlayer ? 'card card-received' : 'card'}>
        {card.fromPlayer && <div className="from">📨 {card.fromPlayer} t'envoie cette carte</div>}
        <h2>{card.title}</h2>
        <p>{card.text}</p>
        {card.options.map((o) => (
          <button
            key={o.id}
            disabled={sending !== null}
            onClick={() => {
              setSending(card);
              setError(null);
              choose(card.instanceId, o.id)
                .then((res) => {
                  setPlayed((ids) => [...ids, card.instanceId]);
                  setResult(res);
                })
                .catch((err: Error) => setError(err.message))
                .finally(() => setSending(null));
            }}
          >
            {o.label}
          </button>
        ))}
        {error && <p className="error">{error}</p>}
      </section>
      {others > 0 && (
        <p className="muted center-text">
          {others === 1
            ? 'Encore 1 carte après celle-ci'
            : `Encore ${others} cartes après celle-ci`}
        </p>
      )}
    </>
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
          onClick={() => sendVote(vote.id, o.id).catch(() => {})}
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
