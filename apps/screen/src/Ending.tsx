import { useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import type { Climate, ScreenView, World } from '@jdlt/shared';
import { TIPPING } from './tipping.ts';
import { temperatureColor } from './stripes.ts';
import { EndingScene } from './EndingScene.tsx';
import { Leaderboard } from './Leaderboard.tsx';
import { ENDINGS, endingTier } from './endingTier.ts';

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
      { value: 1.5, label: '+1,5' },
      { value: 2, label: '+2' },
    ],
  },
  { key: 'co2', title: 'CO₂', unit: ' ppm', digits: 0 },
  { key: 'biodiversity', title: 'Biodiversité', unit: ' %', digits: 0 },
];

const fr = (v: number, digits: number) =>
  v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function Ending({ view }: { view: ScreenView }) {
  const { world } = view;
  const tier = endingTier(world.climate.temperature);
  const ending = ENDINGS[tier];

  return (
    <section className={`ending ending-${tier}`}>
      <div className="ending-main">
        <div className="ending-hero">
          <EndingScene world={world} tier={tier} />
          <div className="ending-verdict">
            <div className="ending-kicker">Le monde en 2100</div>
            <h1>{ending.title}</h1>
            <div className="ending-temp">
              <CountUp value={world.climate.temperature} /> °C
            </div>
            <p>{ending.verdict}</p>
            <div className="ending-tipping">
              {world.tippingPoints.length ? (
                world.tippingPoints.map((id) => {
                  const { icon: Icon, label } = TIPPING[id];
                  return (
                    <span key={id} className="tipping-chip">
                      <Icon className="icon" /> {label}
                    </span>
                  );
                })
              ) : (
                <span className="tipping-chip safe">
                  <CircleCheck className="icon" /> Aucun point de bascule franchi
                </span>
              )}
            </div>
          </div>
          <Stripes world={world} />
        </div>
        <div className="ending-curves">
          {CURVES.map((c) => (
            <LineChart key={c.key} curve={c} world={world} />
          ))}
        </div>
      </div>
      <div className="ending-side">
        <Leaderboard entries={view.leaderboard} />
        <div className="card conclusion">
          <p>{ending.conclusion}</p>
        </div>
      </div>
    </section>
  );
}

/** Final temperature counting up from 0 when the ending appears. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 2500));
      setShown(value * (1 - (1 - t) ** 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{`${shown >= 0 ? '+' : '−'}${fr(Math.abs(shown), 1)}`}</>;
}

/** Warming stripes of the game, one per era plus 2100. */
function Stripes({ world }: { world: World }) {
  const temps = [...world.history.map((h) => h.climate.temperature), world.climate.temperature];
  return (
    <div className="ending-stripes">
      <span>1900</span>
      <div className="stripes-band">
        {temps.map((t, i) => (
          <i
            key={i}
            style={{ background: temperatureColor(t), animationDelay: `${0.5 + i * 0.12}s` }}
          />
        ))}
      </div>
      <span>2100</span>
    </div>
  );
}

// Chart geometry in SVG units; the SVG scales to its box.
const W = 540;
const H = 300;
const PAD = { left: 20, right: 170, top: 64, bottom: 50 };
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
  const last = points.at(-1)!;
  const isTemp = curve.key === 'temperature';
  const gradientId = `curve-${curve.key}`;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${curve.title} de 1900 à 2100`}>
        {isTemp && (
          // The temperature line takes the warming-stripes colour of each era.
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={x(X0)}
              x2={x(X1)}
              y1={0}
              y2={0}
            >
              {points.map((p) => (
                <stop
                  key={p.year}
                  offset={(p.year - X0) / (X1 - X0)}
                  stopColor={temperatureColor(p.value)}
                />
              ))}
            </linearGradient>
          </defs>
        )}
        <text className="chart-title" x={PAD.left} y={40}>
          {curve.title}
        </text>
        <line className="baseline" x1={x(X0)} x2={x(X1)} y1={H - PAD.bottom} y2={H - PAD.bottom} />
        {[1900, 2000, 2100].map((year) => (
          <text key={year} className="tick" x={x(year)} y={H - 8}>
            {year}
          </text>
        ))}
        {curve.refs?.map((r, i) => (
          <g key={r.value}>
            <line className="ref" x1={x(X0)} x2={x(X1)} y1={y(r.value)} y2={y(r.value)} />
            {/* Lowest reference labelled under its line, the others above; right of the title. */}
            <text className="ref-label" x={x(2035)} y={i === 0 ? y(r.value) + 24 : y(r.value) - 8}>
              {r.label}
            </text>
          </g>
        ))}
        <path
          className="curve"
          d={d}
          style={isTemp ? { stroke: `url(#${gradientId})` } : undefined}
        />
        <circle
          className="end-dot"
          cx={x(last.year)}
          cy={y(last.value)}
          r={9}
          style={isTemp ? { fill: temperatureColor(last.value) } : undefined}
        />
        <text className="end-label" x={x(last.year) + 16} y={y(last.value) + 12}>
          {isTemp && last.value >= 0 ? '+' : ''}
          {fr(last.value, curve.digits)}
          <tspan className="end-unit">{curve.unit}</tspan>
        </text>
      </svg>
    </figure>
  );
}
