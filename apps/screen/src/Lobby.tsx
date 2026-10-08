import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { ScreenView } from '@jdlt/shared';
import land110m from 'world-atlas/land-110m.json';
import { ROLES, ROLE_ICON, ROLE_LABEL } from './roles.ts';
import { STRIPE_COLORS } from './stripes.ts';

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
const DEG_PER_SECOND = 4;
const TILT_DEG = 18;
const DOT_STEP_DEG = 1.8;
const MAX_BACKING_PX = 900;
const RAD = Math.PI / 180;

/** Unit vector for a lon/lat point: x right, y up, z towards the viewer at lon 0. */
function toVec(lon: number, lat: number, out: number[]) {
  const c = Math.cos(lat * RAD);
  out.push(c * Math.sin(lon * RAD), Math.sin(lat * RAD), c * Math.cos(lon * RAD));
}

/**
 * Land as evenly spaced dots. Land is rasterised once on a small offscreen
 * equirectangular canvas and sampled, which is far cheaper than geoContains.
 */
function landDots(): Float32Array {
  const W = 720;
  const H = 360;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const path = geoPath(geoEquirectangular().fitSize([W, H], { type: 'Sphere' }), ctx);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  path(LAND);
  ctx.fill();
  const px = ctx.getImageData(0, 0, W, H).data;
  const out: number[] = [];
  for (let lat = -85; lat <= 85; lat += DOT_STEP_DEG) {
    const lonStep = DOT_STEP_DEG / Math.max(0.2, Math.cos(lat * RAD));
    for (let lon = -180; lon < 180; lon += lonStep) {
      const x = Math.floor(((lon + 180) / 360) * W);
      const y = Math.floor(((90 - lat) / 180) * H);
      if (px[(y * W + x) * 4 + 3]! > 127) toVec(lon, lat, out);
    }
  }
  return new Float32Array(out);
}

/** Meridians and parallels every 20°, as polylines of unit vectors. */
function graticuleLines(): Float32Array[] {
  const lines: Float32Array[] = [];
  for (let lon = -180; lon < 180; lon += 20) {
    const l: number[] = [];
    for (let lat = -80; lat <= 80; lat += 4) toVec(lon, lat, l);
    lines.push(new Float32Array(l));
  }
  for (let lat = -60; lat <= 60; lat += 20) {
    const l: number[] = [];
    for (let lon = -180; lon <= 180; lon += 4) toVec(lon, lat, l);
    lines.push(new Float32Array(l));
  }
  return lines;
}

/**
 * Slowly spinning dotted globe behind the lobby. Points are precomputed as 3D
 * unit vectors; each frame is only a rotation, drawn on a canvas in a
 * requestAnimationFrame loop, so the spin is smooth even on weak laptops.
 */
function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dots = landDots();
    const lines = graticuleLines();
    const sinT = Math.sin(TILT_DEG * RAD);
    const cosT = Math.cos(TILT_DEG * RAD);
    let size = 0;
    let unit = 1;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = Math.min(MAX_BACKING_PX, Math.round(canvas.clientWidth * dpr));
      unit = size / canvas.clientWidth || 1;
      canvas.width = canvas.height = size;
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const a = ((now - start) / 1000) * DEG_PER_SECOND * RAD;
      const sinA = Math.sin(a);
      const cosA = Math.cos(a);
      const r = size / 2 - 2 * unit;
      const c = size / 2;
      // Rotate around the polar axis, then tilt the north pole towards the viewer.
      const project = (v: Float32Array, i: number) => {
        const x = v[i]! * cosA + v[i + 2]! * sinA;
        const z1 = -v[i]! * sinA + v[i + 2]! * cosA;
        const y = v[i + 1]! * cosT - z1 * sinT;
        const z = v[i + 1]! * sinT + z1 * cosT;
        return [c + r * x, c - r * y, z] as const;
      };

      ctx.clearRect(0, 0, size, size);

      ctx.strokeStyle = 'rgb(60 195 211 / 0.18)';
      ctx.lineWidth = unit;
      ctx.beginPath();
      for (const line of lines) {
        let pen = false;
        for (let i = 0; i < line.length; i += 3) {
          const [x, y, z] = project(line, i);
          if (z <= 0) pen = false;
          else if (pen) ctx.lineTo(x, y);
          else {
            ctx.moveTo(x, y);
            pen = true;
          }
        }
      }
      ctx.stroke();

      ctx.fillStyle = '#5fd6e3';
      const d = 3.4 * unit;
      for (let i = 0; i < dots.length; i += 3) {
        const [x, y, z] = project(dots, i);
        if (z <= 0) continue;
        // Fade towards the limb for depth.
        ctx.globalAlpha = 0.25 + 0.75 * z;
        ctx.fillRect(x - d / 2, y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="lobby-globe" aria-hidden />;
}

// ---------- warming stripes ----------

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
