import { END_YEAR, ERAS } from './stripes.ts';

const X0 = ERAS[0]!;

/**
 * Tiny trend line over the whole game (1900 → 2100): it grows to the right era
 * after era, so the empty part on the right is the future still to be written.
 */
export function Sparkline({ points }: { points: { year: number; value: number }[] }) {
  if (points.length < 2) return <svg className="sparkline" aria-hidden />;
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1e-6) {
    min -= 1;
    max += 1;
  }
  const x = (year: number) => ((year - X0) / (END_YEAR - X0)) * 100;
  const y = (v: number) => 28 - ((v - min) / (max - min)) * 24;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.year)},${y(p.value)}`).join(' ');
  const last = points.at(-1)!;
  return (
    <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <path className="spark-area" d={`${line} L${x(last.year)},30 L${x(points[0]!.year)},30 Z`} />
      <path className="spark-line" d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
