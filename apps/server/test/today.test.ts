import { describe, expect, it } from 'vitest';
import { FALLBACK_TODAY, fetchTodayStats, parseCopernicus, parseNoaaDaily } from '../src/today.ts';

const noaa = `# header
# more header
  2026  10  17  2026.7918    427.25
  2026  10  18  2026.7945    426.67
`;

const copernicus = [
  '# comment',
  'date,2t,clim_91-20,ano_91-20,status',
  ...Array.from({ length: 400 }, (_, i) => {
    const d = new Date(Date.UTC(2025, 8, 1 + i)).toISOString().slice(0, 10);
    return `${d},15.0,14.4,${i < 35 ? '9.000' : '0.600'},FINAL`;
  }),
].join('\n');

describe('today', () => {
  it('reads the last NOAA daily value', () => {
    expect(parseNoaaDaily(noaa)).toEqual({
      value: 426.67,
      date: '2026-10-18',
      source: 'NOAA, Mauna Loa',
      live: true,
    });
    expect(parseNoaaDaily('# nothing')).toBeNull();
  });

  it('averages the last 365 Copernicus days, vs pre-industrial', () => {
    const t = parseCopernicus(copernicus)!;
    expect(t.temperature.value).toBeCloseTo(0.6 + 0.88);
    expect(t.temperatureDay.value).toBeCloseTo(0.6 + 0.88);
    expect(t.temperatureDay.date).toBe('2026-10-05');
    expect(parseCopernicus(copernicus.split('\n').slice(0, 100).join('\n'))).toBeNull();
  });

  it('falls back on built-in values when offline', async () => {
    const offline = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    expect(await fetchTodayStats(offline)).toEqual(FALLBACK_TODAY);
  });
});
