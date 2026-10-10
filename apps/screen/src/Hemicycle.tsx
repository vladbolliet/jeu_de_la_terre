import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Mail } from 'lucide-react';

/** At most this many envelopes in flight at once; extra ballots light their seat directly. */
const MAX_FLIGHTS = 24;
const MILESTONE_MS = 2800;

interface Seat {
  x: number;
  y: number;
}

/**
 * Seats of a parliament-style hemicycle in a 200×105 box (centre at 100,100),
 * ordered left to right so it fills like a wave.
 */
function layout(n: number): { seats: Seat[]; r: number } {
  const rows = Math.min(7, Math.max(1, Math.round(Math.sqrt(n / 4))));
  // The hollow in the middle holds the vote count.
  const inner = rows === 1 ? 1 : 0.58;
  const radii = Array.from({ length: rows }, (_, i) =>
    rows === 1 ? 1 : inner + ((1 - inner) * i) / (rows - 1),
  );
  const sum = radii.reduce((a, b) => a + b, 0);
  // Seats per row proportional to the row's length; the outer row absorbs rounding.
  const counts = radii.map((r) => Math.max(1, Math.round((n * r) / sum)));
  counts[rows - 1]! += n - counts.reduce((a, b) => a + b, 0);
  while (counts[rows - 1]! < 1) {
    const i = counts.findIndex((c) => c > 1);
    counts[i]!--;
    counts[rows - 1]!++;
  }

  const all: (Seat & { angle: number; row: number })[] = [];
  let spacing = Infinity;
  radii.forEach((radius, row) => {
    const count = counts[row]!;
    if (count > 1) spacing = Math.min(spacing, (Math.PI * radius) / (count - 1));
    for (let j = 0; j < count; j++) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (count - 1);
      all.push({
        x: 100 + Math.cos(angle) * radius * 92,
        y: 100 - Math.sin(angle) * radius * 92,
        angle,
        row,
      });
    }
  });
  if (rows > 1) spacing = Math.min(spacing, (1 - inner) / (rows - 1));
  if (!Number.isFinite(spacing)) spacing = 0.2;
  all.sort((a, b) => b.angle - a.angle || a.row - b.row);
  return { seats: all.map(({ x, y }) => ({ x, y })), r: Math.min(7, spacing * 92 * 0.4) };
}

interface Flight {
  id: number;
  seat: number;
  /** Staggers a burst of ballots so they don't arrive as one blob. */
  delay: number;
}

/**
 * One seat per connected player; each ballot flies in as an envelope and lights
 * the next seat. The screen only knows how many voted, never who or for what.
 */
export function Hemicycle({
  voteId,
  ballots,
  voters,
}: {
  voteId: string;
  ballots: number;
  voters: number;
}) {
  const n = Math.max(1, voters, ballots);
  const { seats, r } = useMemo(() => layout(n), [n]);

  const [flights, setFlights] = useState<Flight[]>([]);
  const [milestone, setMilestone] = useState<{ id: number; text: string } | null>(null);
  const [wave, setWave] = useState(false);
  const prev = useRef({ voteId, ballots });
  const nextId = useRef(0);

  // Layout effect: new flights must hide their seat before the browser paints it lit.
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = { voteId, ballots };
    if (before.voteId !== voteId) {
      setFlights([]);
      setMilestone(null);
      setWave(false);
      return;
    }
    if (ballots <= before.ballots) return;

    const fresh: Flight[] = [];
    const first = Math.max(before.ballots, ballots - MAX_FLIGHTS);
    for (let seat = first; seat < ballots; seat++)
      fresh.push({ id: nextId.current++, seat, delay: (seat - first) * 70 });
    setFlights((f) => [...f, ...fresh]);

    const id = nextId.current;
    if (voters > 0 && ballots >= voters && before.ballots < voters) {
      setMilestone({ id, text: 'Tout le monde a voté !' });
      setWave(true);
    } else if (voters >= 4 && before.ballots < voters / 2 && ballots >= voters / 2) {
      setMilestone({ id, text: 'La moitié a voté' });
    }
  }, [voteId, ballots, voters]);

  useEffect(() => {
    if (!milestone) return;
    // The wave stays on: removing it would replay every seat's pop animation.
    const t = setTimeout(() => setMilestone(null), MILESTONE_MS);
    return () => clearTimeout(t);
  }, [milestone]);

  const flying = new Set(flights.map((f) => f.seat));
  const landed = ballots - flights.filter((f) => f.seat < ballots).length;
  const land = (id: number) => setFlights((f) => f.filter((x) => x.id !== id));

  return (
    <div className={`hemicycle${wave ? ' wave' : ''}`}>
      <svg viewBox="0 0 200 105" aria-hidden>
        {seats.map((s, i) => (
          <circle
            key={i}
            className={i < ballots && !flying.has(i) ? 'seat lit' : 'seat'}
            cx={s.x}
            cy={s.y}
            r={r}
            style={{ '--i': i / n } as CSSProperties}
          />
        ))}
      </svg>
      {flights.map((f) =>
        seats[f.seat] ? (
          <Envelope key={f.id} seat={seats[f.seat]!} delay={f.delay} onLand={() => land(f.id)} />
        ) : null,
      )}
      <div className="hemicycle-count">
        <strong key={landed}>{landed}</strong>
        <span>
          vote{landed > 1 ? 's' : ''} sur {voters}
        </span>
      </div>
      {milestone && (
        <div key={milestone.id} className="milestone">
          {milestone.text}
        </div>
      )}
    </div>
  );
}

/** An envelope rising from the room (bottom of the screen) into its seat. */
function Envelope({ seat, delay, onLand }: { seat: Seat; delay: number; onLand: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onLand);
  done.current = onLand;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dx = (Math.random() - 0.7) * window.innerWidth * 0.5;
    const dy = window.innerHeight * (0.45 + Math.random() * 0.2);
    const spin = (Math.random() - 0.5) * 60;
    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(1.4)`, opacity: 0 },
        { opacity: 1, offset: 0.15 },
        {
          transform: `translate(${dx * 0.3}px, ${-40}px) rotate(${spin / 3}deg) scale(1.1)`,
          offset: 0.7,
        },
        { transform: 'translate(0, 0) rotate(0) scale(0.3)', opacity: 0.2 },
      ],
      {
        duration: 1100 + Math.random() * 400,
        delay,
        easing: 'cubic-bezier(.3,.1,.3,1)',
        fill: 'both',
      },
    );
    anim.onfinish = () => done.current();
    return () => anim.cancel();
  }, []);

  return (
    <div
      ref={ref}
      className="envelope"
      style={{ left: `${seat.x / 2}%`, top: `${(seat.y / 105) * 100}%` }}
    >
      <Mail strokeWidth={2.4} />
    </div>
  );
}
