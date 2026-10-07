import { Trophy } from 'lucide-react';
import type { Climate, ScreenView, World } from '@jdlt/shared';
import { ROLE_LABEL } from './roles.ts';

// Placeholder: the closing message is to be written by the designers.
const CONCLUSION =
  "Chaque choix, même petit, a pesé sur le climat de 2100. Le réchauffement n'est pas une fatalité : il dépend des décisions individuelles et collectives que nous prenons aujourd'hui.";

interface Curve {
  key: keyof Climate;
  title: string;
  unit: string;
  digits: number;
  /** Dashed reference lines (e.g. Paris agreement targets). */
  refs?: { value: number; label: string }[];
}

const CURVES: Curve[] = [
  {
    key: 'temperature',
    title: 'Température',
    unit: ' °C',
    digits: 1,
    refs: [
      { value: 1.5, label: '+1,5 °C' },
      { value: 2, label: '+2 °C' },
    ],
  },
  { key: 'co2', title: 'CO₂', unit: ' ppm', digits: 0 },
  { key: 'biodiversity', title: 'Biodiversité', unit: ' %', digits: 0 },
];

export function Ending({ view }: { view: ScreenView }) {
  return (
    <section className="ending">
      <div className="ending-curves">
        {CURVES.map((c) => (
          <LineChart key={c.key} curve={c} world={view.world} />
        ))}
      </div>
      <div className="ending-side">
        <div className="card leaderboard">
          <div className="card-kicker">
            <Trophy className="icon" /> Classement
          </div>
          <ol>
            {view.leaderboard.map((p, i) => (
              <li key={i}>
                <span className="rank">{i + 1}</span>
                <span className="who">
                  <strong>{p.name}</strong>
                  <span className="role">{ROLE_LABEL[p.role]}</span>
                </span>
                <span className="score">{p.score}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="card conclusion">
          <p>{CONCLUSION}</p>
        </div>
      </div>
    </section>
  );
}

// Chart geometry in SVG units; the SVG scales to its box.
const W = 900;
const H = 230;
const PAD = { left: 16, right: 150, top: 44, bottom: 40 };
const X0 = 1900;
const X1 = 2100;

function LineChart({ curve, world }: { curve: Curve; world: World }) {
  // history holds the start of each played era; the current world closes the series (2100).
  const points = [
    ...world.history.map((h) => ({ year: h.year, value: h.climate[curve.key] })),
    { year: world.year, value: world.climate[curve.key] },
  ];
  const values = [...points.map((p) => p.value), ...(curve.refs?.map((r) => r.value) ?? [])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (year: number) => PAD.left + ((year - X0) / (X1 - X0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.year)},${y(p.value)}`).join(' ');
  const first = points[0]!;
  const last = points.at(-1)!;
  const fmt = (v: number) => `${v.toFixed(curve.digits)}${curve.unit}`;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${curve.title} de 1900 à 2100`}>
        <text className="chart-title" x={PAD.left} y={28}>
          {curve.title}
        </text>
        <line className="baseline" x1={x(X0)} x2={x(X1)} y1={H - PAD.bottom} y2={H - PAD.bottom} />
        {[1900, 1950, 2000, 2050, 2100].map((year) => (
          <text key={year} className="tick" x={x(year)} y={H - 8}>
            {year}
          </text>
        ))}
        {curve.refs?.map((r, i) => (
          <g key={r.value}>
            <line className="ref" x1={x(X0)} x2={x(X1)} y1={y(r.value)} y2={y(r.value)} />
            {/* Lowest reference labelled under its line, the others above, away from the start label. */}
            <text className="ref-label" x={x(1945)} y={i === 0 ? y(r.value) + 22 : y(r.value) - 8}>
              {r.label}
            </text>
          </g>
        ))}
        <path className="curve" d={d} />
        <circle className="end-dot" cx={x(last.year)} cy={y(last.value)} r={7} />
        <text className="end-label" x={x(last.year) + 14} y={y(last.value) + 9}>
          {fmt(last.value)}
        </text>
        <text
          className="start-label"
          x={x(first.year)}
          // Below the line when it starts at the top, so it never hits the title.
          y={y(first.value) < PAD.top + 24 ? y(first.value) + 32 : y(first.value) - 12}
        >
          {fmt(first.value)}
        </text>
      </svg>
    </figure>
  );
}
