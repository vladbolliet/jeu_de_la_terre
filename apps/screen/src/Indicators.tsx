import {
  Bird,
  Coins,
  Factory,
  Globe2,
  Megaphone,
  Smile,
  Thermometer,
  Trees,
  Users,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { Climate, Society, World } from '@jdlt/shared';

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

export function Indicators({ world }: { world: World }) {
  // history[last] is the world at the start of the previous era.
  const prev = world.history.at(-1);
  return (
    <div className="indicators">
      <div className="panel-kicker">
        <Globe2 className="icon" /> État de la planète
      </div>
      <div className="climate-tiles">
        {CLIMATE.map((ind) => (
          <Tile
            key={ind.key}
            ind={ind}
            value={world.climate[ind.key]}
            prev={prev?.climate[ind.key]}
            className="tile climate"
          />
        ))}
      </div>
      <div className="panel-kicker">
        <Users className="icon" /> Société
      </div>
      <div className="society-tiles">
        {SOCIETY.map((ind) => (
          <Tile
            key={ind.key}
            ind={ind}
            value={world.society[ind.key]}
            prev={prev?.society[ind.key]}
            className="tile society"
          />
        ))}
      </div>
    </div>
  );
}

function Tile<T>({
  ind,
  value,
  prev,
  className,
}: {
  ind: Indicator<T>;
  value: number;
  prev: number | undefined;
  className: string;
}) {
  const severity = ind.severity?.(value);
  const Icon = ind.icon;
  return (
    <div className={`${className}${severity ? ` sev-${severity}` : ''}`}>
      <span className="tile-icon">
        <Icon strokeWidth={2.2} />
      </span>
      <div className="tile-label">{ind.label}</div>
      <div className="tile-value">
        {value.toFixed(ind.digits)}
        <span className="tile-unit">{ind.unit}</span>
      </div>
      {prev !== undefined && (
        // Delta of the displayed (rounded) values.
        <Delta
          delta={Number(value.toFixed(ind.digits)) - Number(prev.toFixed(ind.digits))}
          digits={ind.digits}
          worse={ind.worse}
        />
      )}
    </div>
  );
}

function Delta({ delta, digits, worse }: { delta: number; digits: number; worse: 'up' | 'down' }) {
  const shown = Number(delta.toFixed(digits)) || 0;
  if (shown === 0) return <div className="tile-delta">=</div>;
  const bad = worse === 'up' ? shown > 0 : shown < 0;
  return (
    <div className={`tile-delta ${bad ? 'worse' : 'better'}`}>
      {shown > 0 ? '▲ +' : '▼ '}
      {shown.toFixed(digits)}
    </div>
  );
}
