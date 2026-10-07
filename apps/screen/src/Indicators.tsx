import type { Climate, Society, World } from '@jdlt/shared';

type Severity = 'ok' | 'warn' | 'bad';

export interface Indicator<T> {
  key: keyof T;
  label: string;
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
    unit: ' °C',
    digits: 2,
    worse: 'up',
    severity: above(1, 2),
  },
  { key: 'co2', label: 'CO₂', unit: ' ppm', digits: 0, worse: 'up', severity: above(350, 450) },
  {
    key: 'seaLevel',
    label: 'Niveau de la mer',
    unit: ' cm',
    digits: 0,
    worse: 'up',
    severity: above(20, 50),
  },
  { key: 'forest', label: 'Forêts', unit: ' %', digits: 0, worse: 'down', severity: below(85, 65) },
  {
    key: 'biodiversity',
    label: 'Biodiversité',
    unit: ' %',
    digits: 0,
    worse: 'down',
    severity: below(85, 65),
  },
];

export const SOCIETY: Indicator<Society>[] = [
  { key: 'gdp', label: 'PIB', unit: '', digits: 0, worse: 'down' },
  { key: 'wellbeing', label: 'Bien-être', unit: '', digits: 0, worse: 'down' },
  { key: 'awareness', label: 'Sensibilisation', unit: '', digits: 0, worse: 'down' },
];

export function Indicators({ world }: { world: World }) {
  // history[last] is the world at the start of the previous era.
  const prev = world.history.at(-1);
  return (
    <div className="indicators">
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
  return (
    <div className={`${className}${severity ? ` sev-${severity}` : ''}`}>
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
        />
      )}
    </div>
  );
}

function Delta({ delta, digits }: { delta: number; digits: number }) {
  const shown = Number(delta.toFixed(digits)) || 0;
  if (shown === 0) return <div className="tile-delta">=</div>;
  return (
    <div className="tile-delta">
      {shown > 0 ? '▲ +' : '▼ '}
      {shown.toFixed(digits)}
    </div>
  );
}
