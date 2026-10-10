import {
  Bird,
  Coins,
  Factory,
  Globe2,
  Megaphone,
  Smile,
  Thermometer,
  Trees,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { Climate, Society, World } from '@jdlt/shared';
import { Sparkline } from './Sparkline.tsx';

type Severity = 'ok' | 'warn' | 'bad';

export interface Indicator<T> {
  key: keyof T;
  label: string;
  icon: LucideIcon;
  unit: string;
  digits: number;
  /** Direction in which a change is bad news. */
  worse: 'up' | 'down';
  /** Severity of the current value; omitted for neutral indicators. */
  severity?: (v: number) => Severity;
}

/** Higher is worse. */
const above = (warn: number, bad: number) => (v: number) =>
  v >= bad ? 'bad' : v >= warn ? 'warn' : 'ok';
/** Lower is worse. */
const below = (warn: number, bad: number) => (v: number) =>
  v <= bad ? 'bad' : v <= warn ? 'warn' : 'ok';

export const CLIMATE: Indicator<Climate>[] = [
  {
    key: 'temperature',
    label: 'Température',
    icon: Thermometer,
    unit: ' °C',
    digits: 2,
    worse: 'up',
    severity: above(1, 2),
  },
  {
    key: 'co2',
    label: 'CO₂',
    icon: Factory,
    unit: ' ppm',
    digits: 0,
    worse: 'up',
    severity: above(350, 450),
  },
  {
    key: 'seaLevel',
    label: 'Niveau de la mer',
    icon: Waves,
    unit: ' cm',
    digits: 0,
    worse: 'up',
    severity: above(20, 50),
  },
  {
    key: 'forest',
    label: 'Forêts',
    icon: Trees,
    unit: ' %',
    digits: 0,
    worse: 'down',
    severity: below(85, 65),
  },
  {
    key: 'biodiversity',
    label: 'Biodiversité',
    icon: Bird,
    unit: ' %',
    digits: 0,
    worse: 'down',
    severity: below(85, 65),
  },
];

export const SOCIETY: Indicator<Society>[] = [
  { key: 'gdp', label: 'PIB', icon: Coins, unit: '', digits: 0, worse: 'down' },
  { key: 'wellbeing', label: 'Bien-être', icon: Smile, unit: '', digits: 0, worse: 'down' },
  {
    key: 'awareness',
    label: 'Sensibilisation',
    icon: Megaphone,
    unit: '',
    digits: 0,
    worse: 'down',
  },
];

/** Thermometer scale (°C) and the Paris Agreement band. */
const THERMO_MAX = 4;
const PARIS = [1.5, 2];

export function Indicators({ world }: { world: World }) {
  // history[last] is the world at the start of the previous era.
  const prev = world.history.at(-1);
  const [temperature, ...others] = CLIMATE;
  return (
    <div className="indicators">
      <div className="panel-kicker">
        <Globe2 className="icon" /> État de la planète
      </div>
      <TemperatureCard ind={temperature!} world={world} prev={prev?.climate.temperature} />
      <div className="climate-grid">
        {others.map((ind) => (
          <ClimateTile key={ind.key} ind={ind} world={world} prev={prev?.climate[ind.key]} />
        ))}
      </div>
      <div className="society-strip">
        {SOCIETY.map((ind) => {
          const value = world.society[ind.key];
          return (
            <div key={ind.key} className="society-chip">
              <span className="society-label">{ind.label}</span>
              <span className="society-value">{value.toFixed(ind.digits)}</span>
              {prev && <Delta {...deltaOf(ind, value, prev.society[ind.key])} compact />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TemperatureCard({
  ind,
  world,
  prev,
}: {
  ind: Indicator<Climate>;
  world: World;
  prev: number | undefined;
}) {
  const value = world.climate.temperature;
  const pos = (t: number) => `${(Math.min(THERMO_MAX, Math.max(0, t)) / THERMO_MAX) * 100}%`;
  return (
    <div className={`tile temperature-card sev-${ind.severity!(value)}`}>
      <div className="temp-head">
        <span className="tile-icon">
          <Thermometer strokeWidth={2.2} />
        </span>
        <span className="tile-label">Réchauffement</span>
        {prev !== undefined && <Delta {...deltaOf(ind, value, prev)} />}
      </div>
      <div className="temp-value">
        {value >= 0 ? '+' : ''}
        {value.toFixed(ind.digits)}
        <span className="tile-unit">°C</span>
      </div>
      <div className="thermo">
        <div className="thermo-bar">
          <div
            className="thermo-paris"
            style={{ left: pos(PARIS[0]!), right: `calc(100% - ${pos(PARIS[1]!)})` }}
          />
          <span className="thermo-paris-label" style={{ left: pos(1.75) }}>
            Accord de Paris
          </span>
          <div className="thermo-cursor" style={{ left: pos(value) }} />
        </div>
        <div className="thermo-ticks">
          {[0, 1, 2, 3, 4].map((t) => (
            <span key={t} style={{ left: pos(t) }}>
              {t === 0 ? '0' : `+${t}`}°
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClimateTile({
  ind,
  world,
  prev,
}: {
  ind: Indicator<Climate>;
  world: World;
  prev: number | undefined;
}) {
  const value = world.climate[ind.key];
  const Icon = ind.icon;
  const points = [
    ...world.history.map((h) => ({ year: h.year, value: h.climate[ind.key] })),
    { year: world.year, value },
  ];
  return (
    <div className={`tile climate-tile sev-${ind.severity!(value)}`}>
      <div className="climate-tile-head">
        <span className="tile-icon">
          <Icon strokeWidth={2.2} />
        </span>
        <span className="tile-label">{ind.label}</span>
      </div>
      <div className="climate-tile-value">
        <span className="tile-value">
          {value.toFixed(ind.digits)}
          <span className="tile-unit">{ind.unit}</span>
        </span>
        {prev !== undefined && <Delta {...deltaOf(ind, value, prev)} />}
      </div>
      <Sparkline points={points} />
    </div>
  );
}

/** Delta of the displayed (rounded) values. */
function deltaOf<T>(ind: Indicator<T>, value: number, prev: number) {
  return {
    delta: Number(value.toFixed(ind.digits)) - Number(prev.toFixed(ind.digits)),
    digits: ind.digits,
    worse: ind.worse,
  };
}

function Delta({
  delta,
  digits,
  worse,
  compact,
}: {
  delta: number;
  digits: number;
  worse: 'up' | 'down';
  compact?: boolean;
}) {
  const shown = Number(delta.toFixed(digits)) || 0;
  const cls = `tile-delta${compact ? ' compact' : ''}`;
  if (shown === 0) return <div className={cls}>=</div>;
  const bad = worse === 'up' ? shown > 0 : shown < 0;
  return (
    <div className={`${cls} ${bad ? 'worse' : 'better'}`}>
      {shown > 0 ? '▲ +' : '▼ '}
      {shown.toFixed(digits)}
    </div>
  );
}
