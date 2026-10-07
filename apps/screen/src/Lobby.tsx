import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Factory, House, Landmark, Megaphone, type LucideIcon } from 'lucide-react';
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Role, ScreenView } from '@jdlt/shared';
import land110m from 'world-atlas/land-110m.json';
import { ROLES, ROLE_LABEL } from './roles.ts';

const ROLE_ICON: Record<Role, LucideIcon> = {
  elite: Factory,
  citoyen: House,
  politique: Landmark,
  militant: Megaphone,
};

export function Lobby({ view }: { view: ScreenView }) {
  const joinUrl = view.joinUrl ?? location.origin;
  const count = view.connectedCount;

  return (
    <div className="lobby">
      <Globe />
      <div className="lobby-main">
        <p className="lobby-kicker reveal" style={{ animationDelay: '0.1s' }}>
          Simulation climatique collective
        </p>
        <h1 className="lobby-title reveal" style={{ animationDelay: '0.25s' }}>
          Jeu de la <em>Terre</em>
        </h1>
        <p className="lobby-lede reveal" style={{ animationDelay: '0.4s' }}>
          De 1900 à 2100, vos choix écrivent le climat.
        </p>

        <div className="lobby-count reveal" style={{ animationDelay: '0.55s' }}>
          <span key={count} className="lobby-count-number">
            {count}
          </span>
          <span className="lobby-count-label">
            joueur{count > 1 ? 's' : ''}
            <br />
            connecté{count > 1 ? 's' : ''}
          </span>
        </div>

        <ul className="lobby-roles reveal" style={{ animationDelay: '0.7s' }}>
          {ROLES.map((role) => {
            const Icon = ROLE_ICON[role];
            return (
              <li key={role} className={`role-${role}`}>
                <Icon className="role-icon" strokeWidth={2.2} />
                <span className="role-label">{ROLE_LABEL[role]}</span>
                <span key={view.roleCounts[role]} className="role-count">
                  {view.roleCounts[role]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="lobby-join reveal" style={{ animationDelay: '0.4s' }}>
        <p className="join-title">Rejoindre la partie</p>
        <div className="join-qr">
          <QRCodeSVG
            value={joinUrl}
            size={512}
            marginSize={1}
            level="M"
            fgColor="#06121b"
            bgColor="#f3ebdd"
          />
        </div>
        <p className="join-url">{joinUrl.replace(/^https?:\/\//, '')}</p>
        <p className="join-hint">Scannez, puis entrez votre prénom</p>
      </aside>

      <WarmingStripes />
    </div>
  );
}

// ---------- decorative globe ----------

const landTopo = land110m as unknown as Topology<{ land: GeometryCollection }>;
const LAND = feature(landTopo, landTopo.objects.land);
const GRATICULE = geoGraticule10();
const GLOBE_SIZE = 1000;
const DEG_PER_SECOND = 4;

/** Slowly spinning orthographic globe, drawn in outline behind the lobby. */
function Globe() {
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    const start = performance.now();
    // ~20 fps is plenty for a slow spin and spares the projector laptop.
    const id = setInterval(
      () => setRotation(((performance.now() - start) / 1000) * DEG_PER_SECOND),
      50,
    );
    return () => clearInterval(id);
  }, []);

  const projection = geoOrthographic()
    .scale(GLOBE_SIZE / 2 - 4)
    .translate([GLOBE_SIZE / 2, GLOBE_SIZE / 2])
    .rotate([-rotation, -18]);
  const path = geoPath(projection);

  return (
    <svg className="lobby-globe" viewBox={`0 0 ${GLOBE_SIZE} ${GLOBE_SIZE}`} aria-hidden>
      <defs>
        <radialGradient id="globe-shade" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#123a4d" />
          <stop offset="100%" stopColor="#06121b" />
        </radialGradient>
      </defs>
      <circle
        cx={GLOBE_SIZE / 2}
        cy={GLOBE_SIZE / 2}
        r={GLOBE_SIZE / 2 - 4}
        fill="url(#globe-shade)"
        className="globe-sphere"
      />
      <path d={path(GRATICULE) ?? ''} className="globe-graticule" />
      <path d={path(LAND) ?? ''} className="globe-land" />
    </svg>
  );
}

// ---------- warming stripes ----------

/** Ed Hawkins' "warming stripes" palette (ColorBrewer RdBu), cold → hot. */
const STRIPE_COLORS = [
  '#08306b',
  '#08519c',
  '#2171b5',
  '#4292c6',
  '#6baed6',
  '#9ecae1',
  '#c6dbef',
  '#fee0d2',
  '#fcbba1',
  '#fc9272',
  '#fb6a4a',
  '#ef3b2c',
  '#cb181d',
  '#99000d',
];
const PAST_STRIPES = 25; // 1900 → 2025, one stripe per 5 years
const FUTURE_STRIPES = 15; // 2025 → 2100: not written yet

/** Deterministic warming trend with a little year-to-year noise. */
function stripeColor(i: number) {
  const trend = (i / (PAST_STRIPES - 1)) ** 1.6;
  const s = Math.sin(i * 12.9898) * 43758.5453;
  const noise = s - Math.floor(s) - 0.5;
  const x = Math.min(1, Math.max(0, 0.08 + trend * 0.85 + noise * 0.22));
  return STRIPE_COLORS[Math.round(x * (STRIPE_COLORS.length - 1))];
}

function WarmingStripes() {
  return (
    <div className="stripes" aria-hidden>
      <div className="stripes-band">
        {Array.from({ length: PAST_STRIPES }, (_, i) => (
          <span
            key={i}
            className="stripe"
            style={{ background: stripeColor(i), animationDelay: `${0.9 + i * 0.04}s` }}
          />
        ))}
        {Array.from({ length: FUTURE_STRIPES }, (_, i) => (
          <span
            key={`f${i}`}
            className="stripe future"
            style={{ animationDelay: `${1.9 + i * 0.04}s` }}
          />
        ))}
      </div>
      <div className="stripes-labels">
        <span>1900</span>
        <span className="now">Aujourd'hui</span>
        <span className="future-label">2100 ?</span>
      </div>
    </div>
  );
}
