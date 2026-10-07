import type { World } from '@jdlt/shared';

const ROWS: { label: string; get: (w: World) => number; unit: string; digits: number }[] = [
  { label: 'CO₂', get: (w) => w.climate.co2, unit: ' ppm', digits: 0 },
  { label: 'Température', get: (w) => w.climate.temperature, unit: ' °C', digits: 2 },
  { label: 'Niveau de la mer', get: (w) => w.climate.seaLevel, unit: ' cm', digits: 0 },
  { label: 'Biodiversité', get: (w) => w.climate.biodiversity, unit: ' %', digits: 0 },
  { label: 'Forêts', get: (w) => w.climate.forest, unit: ' %', digits: 0 },
  { label: 'PIB', get: (w) => w.society.gdp, unit: '', digits: 0 },
  { label: 'Bien-être', get: (w) => w.society.wellbeing, unit: '', digits: 0 },
  { label: 'Sensibilisation', get: (w) => w.society.awareness, unit: '', digits: 0 },
];

export function Indicators({ world }: { world: World }) {
  return (
    <table className="indicators">
      <tbody>
        {ROWS.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td className="value">
              {r.get(world).toFixed(r.digits)}
              {r.unit}
            </td>
            <td>
              <Sparkline
                values={[...world.history.map((h) => r.get({ ...world, ...h })), r.get(world)]}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${20 - ((v - min) / (max - min || 1)) * 20}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 20" width="100" height="20">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
