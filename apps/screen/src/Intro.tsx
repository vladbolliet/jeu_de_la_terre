// Intro phase: the film (1900 → today), then today's real figures around the Earth.
// The server ends the phase (INTRO_S); the host can skip it with "Phase suivante".
import { useEffect, useRef, useState } from 'react';
import type { Measurement, ScreenView } from '@jdlt/shared';
import { EarthGlobe } from './EarthGlobe.tsx';
import { WorldMap } from './WorldMap.tsx';
import { webglAvailable } from './webgl.ts';

/** Under public/, subtitles burned in (sources: docs/film/). */
const FILM = 'film/intro.mp4';
const HAS_WEBGL = webglAvailable();
/** A football pitch, in hectares. */
const PITCH_HA = 0.714;

export function Intro({ view }: { view: ScreenView }) {
  const [filmDone, setFilmDone] = useState(false);
  return filmDone ? (
    <TodayEarth view={view} />
  ) : (
    <Film endsAt={view.phaseEndsAt} onDone={() => setFilmDone(true)} />
  );
}

/** Plays once with sound; follows the host's pause. A missing file goes straight to the figures. */
function Film({ endsAt, onDone }: { endsAt: number | null; onDone: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const paused = endsAt === null;
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (paused) return video.pause();
    // Autoplay with sound needs a click on this page (the host's "Lancer"): else play muted.
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => onDone());
    });
  }, [paused]);

  return (
    <div className="intro-film">
      <video
        ref={ref}
        src={FILM}
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          // A screen reloaded late in the intro goes straight to the figures.
          if (endsAt !== null && endsAt - Date.now() < e.currentTarget.duration * 1000) onDone();
        }}
        onEnded={onDone}
        onError={onDone}
      />
    </div>
  );
}

const fr = (v: number, digits = 0) =>
  v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "2026-10-19" → "19 oct. 2026", "a/b" → "12 derniers mois", "2025" → "2025". */
function when(m: Measurement) {
  if (m.date.includes('/')) return '12 derniers mois';
  if (/^\d{4}-\d{2}-\d{2}$/.test(m.date))
    return new Date(`${m.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  return m.date;
}

function TodayEarth({ view }: { view: ScreenView }) {
  const t = view.today;
  const pitchesPerMinute = Math.round((t.forestLoss.value * 1e6) / (365 * 24 * 60) / PITCH_HA);
  const tiles = [
    {
      label: 'CO₂ dans l’air',
      value: fr(t.co2.value, 1),
      unit: 'ppm',
      note: '280 avant l’ère industrielle',
      m: t.co2,
    },
    {
      label: 'Réchauffement',
      value: `+${fr(t.temperature.value, 2)}`,
      unit: '°C',
      note: 'par rapport à 1850-1900',
      m: t.temperature,
    },
    {
      label: 'Niveau des mers',
      value: `+${fr(t.seaLevel.value)}`,
      unit: 'cm',
      note: 'depuis 1900',
      m: t.seaLevel,
    },
    {
      label: 'Émissions de CO₂',
      value: fr(t.emissions.value, 1),
      unit: 'Gt / an',
      note: 'milliards de tonnes : charbon, pétrole, gaz',
      m: t.emissions,
    },
    {
      label: 'Espèces menacées',
      value: fr(t.threatenedSpecies.value),
      unit: '',
      note: 'd’extinction : mammifères, oiseaux, arbres, coraux…',
      m: t.threatenedSpecies,
    },
    {
      label: 'Forêt tropicale détruite',
      value: fr(t.forestLoss.value, 1),
      unit: 'Mha / an',
      note: `millions d’hectares : ${pitchesPerMinute} terrains de foot par minute`,
      m: t.forestLoss,
    },
  ];
  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="today">
      <div className="today-globe">
        {HAS_WEBGL ? <EarthGlobe world={view.world} /> : <WorldMap world={view.world} />}
      </div>
      <div className="today-main">
        <p className="today-kicker reveal">{today}</p>
        <h1 className="today-title reveal" style={{ animationDelay: '0.15s' }}>
          La Terre aujourd’hui
        </h1>
        <ul className="today-tiles">
          {tiles.map((tile, i) => (
            <li
              key={tile.label}
              className="today-tile reveal"
              style={{ animationDelay: `${0.5 + i * 0.25}s` }}
            >
              <span className="today-label">{tile.label}</span>
              <span className="today-value">
                {tile.value}
                {tile.unit && <small> {tile.unit}</small>}
              </span>
              <span className="today-note">{tile.note}</span>
              <span className="today-source">
                {tile.m.live && <i className="live-dot" aria-label="en direct" />}
                {tile.m.source} · {when(tile.m)}
              </span>
            </li>
          ))}
        </ul>
        <p className="today-outro reveal" style={{ animationDelay: '2.4s' }}>
          Ces chiffres sont réels. La suite, c’est vous qui l’écrivez.
        </p>
      </div>
    </div>
  );
}
