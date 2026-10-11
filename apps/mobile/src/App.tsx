import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ERAS, type CardView, type PlayerView } from '@jdlt/shared';
import { choose, join, socket, storage, vote as sendVote } from './socket.ts';
import { Ended } from './Ended.tsx';
import { ROLE_STYLE } from './roles.ts';
import { useCountdown } from './useCountdown.ts';
import { useWakeLock } from './useWakeLock.ts';

function roleVars(view: PlayerView): CSSProperties {
  return { '--role': ROLE_STYLE[view.me.role].color } as CSSProperties;
}

/** Era being played or recapped: the server has already moved `year` forward when feedback starts. */
function eraYear(view: PlayerView): number {
  if (view.phase !== 'feedback') return view.year;
  return ERAS.filter((y) => y < view.year).at(-1) ?? view.year;
}

export function App() {
  const [view, setView] = useState<PlayerView | null>(null);
  const [connected, setConnected] = useState(false);
  const [roleSeen, setRoleSeen] = useState(storage.roleSeen);
  // Year of the last era whose full-screen intro was shown.
  const [introSeen, setIntroSeen] = useState<number | null>(null);

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

  // Keep the screen on from the moment the player has joined until the end of the game.
  useWakeLock(view !== null && view.phase !== 'ended');

  if (!view) return <JoinScreen connected={connected} />;
  if (roleSeen !== view.me.id)
    return (
      <>
        {!connected && <div className="banner banner-fixed">Reconnexion…</div>}
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
    <main className="game" style={roleVars(view)}>
      <div className="backdrop" aria-hidden="true">
        {view.phase !== 'lobby' && <span className="watermark">{eraYear(view)}</span>}
        <i className="planet" />
      </div>
      {view.phase === 'choices' && introSeen !== view.year && (
        <EraIntro key={view.year} year={view.year} onDone={() => setIntroSeen(view.year)} />
      )}
      <TopBar view={view} connected={connected} />
      <div className="stage">
        <PhaseBody view={view} />
      </div>
    </main>
  );
}

function JoinScreen({ connected }: { connected: boolean }) {
  const [name, setName] = useState(storage.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="join">
      <div className="backdrop" aria-hidden="true">
        <i className="planet" />
      </div>
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
        <div className="reveal-medal">
          <i />
          <i />
          <span className="reveal-icon">{ROLE_STYLE[view.me.role].icon}</span>
        </div>
        <h1>{view.me.roleName}</h1>
        <section className="reveal-card">
          <span className="reveal-label">Ton objectif</span>
          <p className="reveal-objective">{view.me.objective}</p>
        </section>
      </div>
      <button onClick={onDone}>Compris</button>
    </main>
  );
}

const PHASE_LABEL: Partial<Record<PlayerView['phase'], string>> = {
  choices: 'Choisis tes cartes',
  conflicts: 'Vote collectif',
  feedback: 'Résultats',
};

/** Sticky top bar: role, score and a countdown ring that turns red and vibrates at 10 s if the player still has to play. */
function TopBar({ view, connected }: { view: PlayerView; connected: boolean }) {
  const seconds = useCountdown(view.phaseEndsAt);
  const label = PHASE_LABEL[view.phase];
  const mustPlay =
    (view.phase === 'choices' && view.hand.length > 0) ||
    (view.phase === 'conflicts' && view.vote !== null && view.vote.myChoice === null);
  // Nothing to do during feedback: no red alert there.
  const urgent = view.phase !== 'feedback' && seconds !== null && seconds > 0 && seconds <= 10;
  const hurry = urgent && mustPlay;

  // Vibrate once per phase (no-op on iOS Safari, which has no Vibration API).
  const vibratedFor = useRef<number | null>(null);
  useEffect(() => {
    if (hurry && vibratedFor.current !== view.phaseEndsAt) {
      vibratedFor.current = view.phaseEndsAt;
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [hurry, view.phaseEndsAt]);

  return (
    <div className="topbar">
      {!connected && <div className="banner">Reconnexion…</div>}
      <header>
        <div className="avatar">{ROLE_STYLE[view.me.role].icon}</div>
        <div className="who">
          <strong>{view.me.roleName}</strong>
          <span>
            {view.me.name} ·{' '}
            {/* Re-mounted when the score changes so the bump animation replays. */}
            <b key={view.me.score} className="score">
              {view.me.score} pts
            </b>
          </span>
        </div>
        {label && (
          <div className={`ring${urgent ? ' urgent' : ''}${hurry ? ' hurry' : ''}`}>
            <svg viewBox="0 0 64 64">
              <circle className="ring-bg" cx="32" cy="32" r="28" />
              {view.phaseEndsAt !== null && (
                // Drains over the time left when it mounts (pure CSS, re-mounted for each phase).
                <circle
                  key={view.phaseEndsAt}
                  className="ring-fg"
                  cx="32"
                  cy="32"
                  r="28"
                  style={{ animationDuration: `${Math.max(0, view.phaseEndsAt - Date.now())}ms` }}
                />
              )}
            </svg>
            <strong className={seconds !== null && seconds >= 100 ? 'small' : ''}>
              {seconds === null
                ? '⏸'
                : seconds >= 100
                  ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
                  : seconds}
            </strong>
          </div>
        )}
      </header>
      <p className="objective">
        <span className="tag">Objectif</span>
        {view.me.objective}
      </p>
      {label && (
        <div className={`phase-line${hurry ? ' hurry' : ''}`}>
          <span className="year">{eraYear(view)}</span>
          <span>{hurry ? 'Dépêche-toi !' : seconds === null ? 'Partie en pause' : label}</span>
        </div>
      )}
    </div>
  );
}

function PhaseBody({ view }: { view: PlayerView }) {
  switch (view.phase) {
    case 'lobby':
      return <Lobby view={view} />;
    case 'choices':
      return <Choices key={view.year} view={view} />;
    case 'conflicts':
      return view.vote ? (
        <Vote view={view} />
      ) : (
        <Message icon="🗳️" title="Pas de vote cette époque" text="Regarde l'écran principal." />
      );
    case 'feedback':
      return <Feedback view={view} />;
    case 'ended':
      return <Ended view={view} />;
  }
}

/** Centered full-height message, used when there is nothing to play. */
function Message({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <section className="message">
      <div className="message-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function Lobby({ view }: { view: PlayerView }) {
  return (
    <section className="message">
      <div className="lobby-badge">
        <i />
        <i />
        <span>{ROLE_STYLE[view.me.role].icon}</span>
      </div>
      <h2>Tu es dans la partie, {view.me.name} !</h2>
      <p>Elle va bientôt commencer.</p>
      <p className="muted">En attendant, regarde l'écran principal.</p>
      <div className="dots">
        <i />
        <i />
        <i />
      </div>
    </section>
  );
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
      <section className="message result">
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
  if (!card) {
    // No card dealt this era (e.g. the player joined after the deal).
    if (!view.outcomes.length && !view.history.some((h) => h.year === view.year))
      return (
        <Message
          icon="🃏"
          title="Pas de carte pour toi cette époque"
          text="Regarde l'écran principal en attendant la suite."
        />
      );
    return (
      <section className="message">
        <div className="message-icon">⏳</div>
        <h2>Tes choix sont faits</h2>
        {view.outcomes.map((o, i) => (
          <p key={i} className="outcome">
            {o}
          </p>
        ))}
        <p className="muted waiting">En attente des autres joueurs…</p>
      </section>
    );
  }

  const others = hand.filter((c) => c.instanceId !== card.instanceId).length;
  return (
    <div className="play" key={card.instanceId}>
      <section className={card.fromPlayer ? 'card card-received' : 'card'}>
        <div className="card-band">
          {card.fromPlayer
            ? `📨 ${card.fromPlayer} t'envoie cette carte`
            : `Ta carte · ${view.year}`}
        </div>
        <div className="card-body">
          <h2>{card.title}</h2>
          <p>{card.text}</p>
        </div>
        <span className="card-mark" aria-hidden="true">
          {ROLE_STYLE[view.me.role].icon}
        </span>
      </section>
      <div className="actions">
        {others > 0 && (
          <p className="muted">
            {others === 1
              ? 'Encore 1 carte après celle-ci'
              : `Encore ${others} cartes après celle-ci`}
          </p>
        )}
        {error && <p className="error">{error}</p>}
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
      </div>
    </div>
  );
}

function Vote({ view }: { view: PlayerView }) {
  const vote = view.vote!;
  // Option being sent; the highlighted choice always comes from the server (`myChoice`).
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="play">
      <section className="card vote">
        <div className="card-band">Tout le monde décide</div>
        <div className="card-body">
          <div className="vote-icon">🗳️</div>
          <h2>{vote.title}</h2>
          <p>{vote.text}</p>
        </div>
      </section>
      <div className="actions">
        <p className="muted">
          {vote.myChoice
            ? "Vote enregistré. Tu peux changer d'avis jusqu'à la fin."
            : 'Touche une option pour voter.'}
        </p>
        {error && <p className="error">{error}</p>}
        {vote.options.map((o) => (
          <button
            key={o.id}
            className={vote.myChoice === o.id ? 'selected' : ''}
            disabled={sending !== null}
            aria-pressed={vote.myChoice === o.id}
            onClick={() => {
              setSending(o.id);
              setError(null);
              sendVote(vote.id, o.id)
                .catch((err: Error) => setError(err.message))
                .finally(() => setSending(null));
            }}
          >
            {vote.myChoice === o.id && '✓ '}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const INTRO_MS = 2800;

/** Full-screen year shown for ~3 s when an era starts; a tap skips it. */
function EraIntro({ year, onDone }: { year: number; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => done.current(), INTRO_MS);
    return () => clearTimeout(id);
  }, []);

  // The year rolls from the previous era up to the new one.
  const [shown, setShown] = useState(year - 20);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(year);
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start - 300) / 900);
      if (t > 0) setShown(Math.round(year - 20 + 20 * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [year]);

  const index = ERAS.indexOf(year as (typeof ERAS)[number]);
  return (
    <div className="era-intro" onClick={onDone}>
      <div className="era-rings">
        <i />
        <i />
        <i />
      </div>
      {index >= 0 && (
        <p className="era-count">
          Époque {index + 1} sur {ERAS.length}
        </p>
      )}
      <strong>{shown}</strong>
      <p className="era-text">
        {index === 0 ? 'La partie commence !' : 'Une nouvelle époque commence'}
      </p>
      <div className="era-dots">
        {ERAS.map((y, i) => (
          <i key={y} className={i < index ? 'past' : i === index ? 'now' : ''} />
        ))}
      </div>
    </div>
  );
}

/** Feedback phase: recap of the era that just ended, then look at the main screen. */
function Feedback({ view }: { view: PlayerView }) {
  const year = eraYear(view);
  const choices = view.history.filter((h) => h.year === year);
  const result = view.lastVoteResult;
  const ballots = result ? Object.values(result.tally).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="feedback">
      <section className="look">
        <div className="look-icon">👀</div>
        Regarde l'écran principal
      </section>
      <section className="panel">
        <h2>Tes choix en {year}</h2>
        {choices.length ? (
          <ul>
            {choices.map((c, i) => (
              <li key={i}>
                <span className="muted">{c.cardTitle}</span>
                <strong>{c.optionLabel}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Tu n'as joué aucune carte cette époque.</p>
        )}
        {view.outcomes.map((o, i) => (
          <p key={i} className="outcome">
            {o}
          </p>
        ))}
      </section>
      {result && (
        <section className="panel">
          <h2>🗳️ {result.title}</h2>
          <p className="muted">Décision collective</p>
          <p className="winner">{result.winner.label}</p>
          <p className="muted">
            {ballots > 0
              ? `${result.tally[result.winner.id] ?? 0} voix sur ${ballots}`
              : "Personne n'a voté."}
          </p>
        </section>
      )}
    </div>
  );
}
