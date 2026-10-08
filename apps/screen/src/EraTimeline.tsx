import type { World } from '@jdlt/shared';
import { END_YEAR, ERAS, temperatureColor } from './stripes.ts';

/** Light stripes (pale blue/pink) need dark text. */
function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

/**
 * The game as warming stripes, one per era: played eras take the colour of the
 * temperature they ended at, the current one glows, the future is still blank.
 */
export function EraTimeline({ world }: { world: World }) {
  const current = ERAS.indexOf(world.year);
  // history holds the world at the start of each played era; the current world is the latest.
  const temperatureAt = (year: number) =>
    year === world.year
      ? world.climate.temperature
      : world.history.find((h) => h.year === year)?.climate.temperature;

  return (
    <div className="era-timeline">
      <ol className="era-stripes">
        {ERAS.map((year, i) => {
          const done = current === -1 || i < current;
          const now = i === current;
          const t = done
            ? temperatureAt(ERAS[i + 1] ?? END_YEAR)
            : now
              ? world.climate.temperature
              : undefined;
          const color = t !== undefined ? temperatureColor(t) : undefined;
          return (
            <li
              key={year}
              className={`era${done ? ' done' : ''}${now ? ' now' : ''}`}
              style={
                color
                  ? { background: color, color: isLight(color) ? '#0f2a3c' : '#fff' }
                  : undefined
              }
            >
              {done && t !== undefined && (
                <span className="era-temp">
                  {t >= 0 ? '+' : ''}
                  {t.toFixed(1)}°
                </span>
              )}
              {now && <span className="era-now">Maintenant</span>}
              <span className="era-year">{year}</span>
            </li>
          );
        })}
      </ol>
      <span className="era-end">{END_YEAR}</span>
    </div>
  );
}
