// Today's real-world figures, shown on the screen during the intro and used as the
// game's initial climate. CO2 and temperature are fetched daily; the others are
// published once a year and kept here (update them when a new edition comes out).
import type { Measurement, TodayStats } from '@jdlt/shared';

const NOAA_CO2_URL = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.txt';
const COPERNICUS_T2M_URL =
  'https://sites.ecmwf.int/data/climatepulse/data/series/era5_daily_series_2t_global.csv';
/** Warming of the 1991–2020 reference period vs 1850–1900 (Copernicus / IPCC AR6). */
const REF_1991_2020_VS_PREINDUSTRIAL = 0.88;
const FETCH_TIMEOUT_MS = 8000;

const known = (value: number, date: string, source: string): Measurement => ({
  value,
  date,
  source,
  live: false,
});

/** Used when a source cannot be reached (no Internet in the room, source down). */
export const FALLBACK_TODAY: TodayStats = {
  co2: known(427, '2026-10', 'NOAA, Mauna Loa'),
  temperature: known(1.45, '2025', 'Copernicus (ERA5)'),
  temperatureDay: known(1.45, '2025', 'Copernicus (ERA5)'),
  seaLevel: known(23, '2025', 'NOAA / NASA'),
  emissions: known(38.1, '2025', 'Global Carbon Project'),
  threatenedSpecies: known(48646, '2025', 'UICN, Liste rouge'),
  forestLoss: known(6.7, '2024', 'Global Forest Watch'),
};

/** Last daily value of the NOAA Mauna Loa file ("yyyy mm dd decimal ppm" rows). */
export function parseNoaaDaily(text: string): Measurement | null {
  const rows = text
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.trim().split(/\s+/).map(Number))
    .filter((r) => r.length >= 5 && r.every(Number.isFinite) && r[4]! > 0);
  const last = rows.at(-1);
  if (!last) return null;
  const [y, m, d, , ppm] = last as [number, number, number, number, number];
  return { value: ppm, date: isoDate(y, m, d), source: 'NOAA, Mauna Loa', live: true };
}

/**
 * Copernicus Climate Pulse CSV ("date,2t,clim_91-20,ano_91-20,status"):
 * latest daily anomaly and mean of the last 365 days, both vs pre-industrial.
 */
export function parseCopernicus(
  text: string,
): Pick<TodayStats, 'temperature' | 'temperatureDay'> | null {
  const rows = text
    .split('\n')
    .filter((l) => /^\d{4}-\d{2}-\d{2},/.test(l))
    .map((l) => l.split(','))
    .map(([date, , , ano]) => ({ date: date!, ano: Number(ano) }))
    .filter((r) => Number.isFinite(r.ano));
  const year = rows.slice(-365);
  const last = year.at(-1);
  if (!last || year.length < 365) return null;
  const mean = year.reduce((s, r) => s + r.ano, 0) / year.length;
  const source = 'Copernicus (ERA5)';
  return {
    temperature: {
      value: mean + REF_1991_2020_VS_PREINDUSTRIAL,
      date: `${year[0]!.date}/${last.date}`,
      source,
      live: true,
    },
    temperatureDay: {
      value: last.ano + REF_1991_2020_VS_PREINDUSTRIAL,
      date: last.date,
      source,
      live: true,
    },
  };
}

/** Fetches what can be fetched; each figure falls back on its own. Never throws. */
export async function fetchTodayStats(fetchImpl: typeof fetch = fetch): Promise<TodayStats> {
  const get = async (url: string) => {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  };
  const [noaa, copernicus] = await Promise.all([get(NOAA_CO2_URL), get(COPERNICUS_T2M_URL)]);
  return {
    ...FALLBACK_TODAY,
    co2: (noaa && parseNoaaDaily(noaa)) || FALLBACK_TODAY.co2,
    ...((copernicus && parseCopernicus(copernicus)) || {}),
  };
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
