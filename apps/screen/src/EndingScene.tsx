import type { ReactNode } from 'react';
import type { World } from '@jdlt/shared';
import type { EndingTier } from './endingTier.ts';

/**
 * Illustrated coastal landscape of 2100, drawn from the final world: sky, light
 * and vegetation follow the ending tier, the sea rises over the city with
 * `seaLevel`, trees die with `forest`, birds vanish with `biodiversity`, and
 * crossed tipping points leave visible marks (no snow or sea ice after
 * arctic_ice, forest fires after amazon).
 * Deterministic: the layout comes from a fixed seed, so the same world always
 * gives the same picture.
 */

// Scene geometry in SVG units. The SVG covers its box (slice) anchored at the
// bottom; keep important things within x ≈ 200…1400, the rest may be cropped.
const W = 1600;
const H = 560;
/** Extra sky above y = 0, room for the verdict text over the landscape. */
const SKY = 120;
const TOP = -SKY;
const HORIZON = 332;
const SUN: [number, number] = [1210, -10];
/**
 * Front water surface at 0 cm and how much it rises at 100 cm: about one ground
 * floor, roughly to scale. +1 m floods quays and beaches, it does not drown towers.
 */
const SEA_Y0 = 391;
const SEA_RISE = 14;
/** City ground (top of the coastal strip). */
const CITY_Y = 384;

/* ---------- Deterministic randomness ---------- */

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: () => number, a: number, b: number) => a + r() * (b - a);

/** Smooth closed path through ridge points, down to the bottom of the scene. */
function smoothRidge(pts: [number, number][], bottom = H) {
  let d = `M${pts[0]![0]},${bottom} L${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    d += ` Q${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`;
  }
  const last = pts.at(-1)!;
  return `${d} L${last[0]},${last[1]} L${last[0]},${bottom} Z`;
}

/** Shadowed left face of each peak (to clip to the ridge). */
function peakShadows(pts: [number, number][], base: number) {
  return pts
    .filter(([, y], i) => i > 0 && i < pts.length - 1 && y < pts[i - 1]![1] && y < pts[i + 1]![1])
    .map(
      ([x, y]) => `M${x},${y} L${x - (base - y) * 0.9},${base} L${x + (base - y) * 0.12},${base} Z`,
    )
    .join(' ');
}

function linePath(pts: [number, number][], bottom = H) {
  return `M${pts[0]![0]},${bottom} ${pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${pts.at(-1)![0]},${bottom} Z`;
}

/* ---------- Static layout ---------- */

const FAR_MOUNTAINS: [number, number][] = [
  [-40, 316],
  [120, 232],
  [282, 128],
  [400, 262],
  [470, 250],
  [633, 124],
  [722, 196],
  [745, 214],
  [811, 195],
  [890, 262],
  [960, 318],
];
const NEAR_MOUNTAINS: [number, number][] = [
  [-40, 335],
  [60, 282],
  [150, 300],
  [300, 244],
  [453, 168],
  [560, 262],
  [600, 246],
  [643, 208],
  [705, 262],
  [790, 340],
];

/** Mid hills on the left, ending in a slope into the sea around x = 900. */
function midHillY(x: number) {
  const coast = Math.max(0, x - 560) * 0.35;
  return Math.min(CITY_Y - 4, 348 + 10 * Math.sin(x / 120 + 0.5) + 5 * Math.sin(x / 47) + coast);
}
const MID_HILL = smoothRidge(
  Array.from({ length: 49 }, (_, i): [number, number] => [-40 + i * 20, midHillY(-40 + i * 20)]),
);

/** Foreground hill on the left, its coast curving into the water from x = 560 to 737. */
function frontHillY(x: number) {
  const coast = (Math.max(0, x - 560) / 177) ** 1.6 * 165;
  return 395 + 8 * Math.sin(x / 140 + 1) + coast;
}
const FRONT_HILL = smoothRidge(
  Array.from({ length: 47 }, (_, i): [number, number] => [-40 + i * 20, frontHillY(-40 + i * 20)]),
);

/** Snow line on the mountains (clipped to them), jagged. */
function snowPath(y: number, seed: number) {
  const r = rng(seed);
  let d = `M-40,${TOP}`;
  for (let x = -40; x <= 960; x += 18) d += ` L${x},${y + between(r, -6, 8)}`;
  return `${d} L960,${TOP} Z`;
}

type Species = 'pine' | 'round' | 'poplar';
interface TreeSpec {
  x: number;
  y: number;
  s: number;
  species: Species;
  /** 0…1: the tree is alive while rank < forest share. */
  rank: number;
  /** Per-tree shade variation. */
  tone: number;
}

function plantTrees(
  seed: number,
  n: number,
  x0: number,
  x1: number,
  groundY: (x: number) => number,
  depth: number,
  scale: [number, number],
): TreeSpec[] {
  const r = rng(seed);
  const trees: TreeSpec[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + between(r, 0.1, 0.9))) / n;
    const dy = between(r, 0, depth);
    const roll = r();
    trees.push({
      x,
      y: groundY(x) + dy + 4,
      // Trees lower on the slope are closer: a bit bigger.
      s: between(r, scale[0], scale[1]) * (1 + dy / 220),
      species: roll < 0.45 ? 'pine' : roll < 0.85 ? 'round' : 'poplar',
      rank: r(),
      tone: r(),
    });
  }
  return trees.sort((a, b) => a.y - b.y);
}

const FAR_TREES = plantTrees(5, 40, -20, 640, midHillY, 22, [0.3, 0.42]);

/** Hand-placed trees (x, ground y, scale, species), given a seeded death order. */
function placeTrees(seed: number, list: [number, number, number, Species][]): TreeSpec[] {
  const r = rng(seed);
  return list
    .map(([x, y, s, species]) => ({ x, y, s, species, rank: r(), tone: r() }))
    .sort((a, b) => a.y - b.y);
}

const FRONT_TREES = placeTrees(9, [
  [290, 420, 1.3, 'round'],
  [295, 415, 1.1, 'poplar'],
  [342, 419, 1.2, 'round'],
  [436, 402, 1.06, 'pine'],
  [503, 398, 0.75, 'poplar'],
  [533, 435, 1.0, 'round'],
  [376, 442, 1.39, 'round'],
  [463, 456, 1.38, 'pine'],
  [556, 469, 1.27, 'round'],
  [230, 430, 1.2, 'pine'],
]);

/** Small trees on the strip between the hill and the city, and along the waterfront. */
const SHORE_TREES = placeTrees(13, [
  [597, 344, 0.45, 'pine'],
  [617, 350, 0.42, 'pine'],
  [647, 375, 0.3, 'round'],
  [665, 377, 0.3, 'round'],
  [684, 381, 0.28, 'round'],
  ...[720, 740, 757, 807, 827, 888, 941, 958, 975, 1022, 1045, 1095, 1115].map(
    (x): [number, number, number, Species] => [x, CITY_Y + 1, 0.17, 'round'],
  ),
]);

interface Building {
  x: number;
  w: number;
  h: number;
  kind: 'flat' | 'stepped' | 'spire' | 'dome' | 'antenna';
  /** Lit pattern of the window grid (row-major). */
  lit: boolean[];
  cols: number;
  rows: number;
  roof: number;
}

/** Buildings placed by hand: x, width, height, kind. Windows are seeded. */
function placeCity(seed: number, list: [number, number, number, Building['kind']][]): Building[] {
  const r = rng(seed);
  return list.map(([x, w, h, kind]) => {
    const cols = Math.max(2, Math.round((w - 6) / 12));
    const rows = Math.max(2, Math.floor((h - 12) / 15));
    return {
      x,
      w,
      h,
      kind,
      cols,
      rows,
      lit: Array.from({ length: cols * rows }, () => r() < 0.55),
      roof: r(),
    };
  });
}

const BACK_CITY = placeCity(31, [
  [640, 44, 71, 'flat'],
  [710, 40, 102, 'flat'],
  [777, 34, 125, 'flat'],
  [837, 27, 108, 'spire'],
  [901, 40, 115, 'spire'],
  [945, 33, 112, 'spire'],
  [985, 27, 115, 'spire'],
  [1018, 34, 91, 'flat'],
]);
const FRONT_CITY = placeCity(47, [
  [684, 34, 68, 'flat'],
  [717, 37, 61, 'flat'],
  [754, 40, 71, 'antenna'],
  [794, 40, 88, 'flat'],
  [834, 34, 75, 'flat'],
  [868, 40, 88, 'flat'],
  [908, 33, 85, 'flat'],
  [941, 47, 91, 'flat'],
  [988, 40, 71, 'flat'],
  [1028, 50, 65, 'flat'],
  [1078, 44, 65, 'flat'],
]);

/* ---------- Palettes ---------- */

interface Palette {
  sky: [string, string, string];
  sun: string;
  sunR: number;
  farMountains: string;
  nearMountains: string;
  haze: string;
  midHill: string;
  frontHill: [string, string];
  /** Foliage: shadow, base, light. */
  leaves: [string, string, string];
  /** Foliage of dying trees. */
  dry: [string, string, string];
  sea: [string, string];
  building: [string, string];
  window: string;
  sand: string;
}

const PALETTES: Record<EndingTier, Palette> = {
  preserved: {
    sky: ['#1a68c4', '#4aa3e6', '#9ad8f6'],
    sun: '#fff7b8',
    sunR: 46,
    farMountains: '#aac3db',
    nearMountains: '#8ea9c6',
    haze: '#bfe8f8',
    midHill: '#4f9e48',
    frontHill: ['#4cae47', '#3a9a3c'],
    leaves: ['#1f7a34', '#2e9c45', '#5cc45a'],
    dry: ['#6b6a2a', '#9c9a3a', '#c8c060'],
    sea: ['#3c9de4', '#1862c0'],
    building: ['#4f80b8', '#6d9bcc'],
    window: '#f9e594',
    sand: '#e9d79c',
  },
  strained: {
    sky: ['#3f7aa0', '#a5c2c9', '#efdcaa'],
    sun: '#ffe08a',
    sunR: 52,
    farMountains: '#a9b5ba',
    nearMountains: '#7f8f98',
    haze: '#efdcaa',
    midHill: '#8aa055',
    frontHill: ['#7d9a46', '#4f6e2e'],
    leaves: ['#355a2a', '#4f7f34', '#86a84a'],
    dry: ['#7a6a2a', '#a8903a', '#d0b45a'],
    sea: ['#4f98b4', '#1b5574'],
    building: ['#5e7182', '#8798a6'],
    window: '#ffdc8a',
    sand: '#e2c995',
  },
  damaged: {
    sky: ['#6a3e4e', '#c9743f', '#f4be6a'],
    sun: '#ffb04a',
    sunR: 64,
    farMountains: '#b58a72',
    nearMountains: '#8c6656',
    haze: '#f0b064',
    midHill: '#b08a4a',
    frontHill: ['#a5813f', '#6e5228'],
    leaves: ['#4e5424', '#7a7c34', '#a8a14a'],
    dry: ['#7a4e1e', '#a86a2a', '#d09040'],
    sea: ['#6f8c8c', '#2b4e5c'],
    building: ['#594a4a', '#7a6662'],
    window: '#f0b060',
    sand: '#d6b07a',
  },
  scorched: {
    sky: ['#24090d', '#7a1d14', '#d9562a'],
    sun: '#ff6a2a',
    sunR: 78,
    farMountains: '#7a3a2c',
    nearMountains: '#552a22',
    haze: '#c84a24',
    midHill: '#6e4428',
    frontHill: ['#6a4426', '#3e2616'],
    leaves: ['#3e3a1c', '#5c5426', '#7e7032'],
    dry: ['#5a3418', '#7e4a20', '#a0642a'],
    sea: ['#6a5a52', '#2a3238'],
    building: ['#3e3030', '#584442'],
    window: '#d8783a',
    sand: '#b48a5e',
  },
};

/* ---------- Scene ---------- */

export function EndingScene({ world, tier }: { world: World; tier: EndingTier }) {
  const p = PALETTES[tier];
  const { climate, tippingPoints } = world;
  const green = tier === 'preserved' || tier === 'strained';
  const iceLost = tippingPoints.includes('arctic_ice');
  const fires = tippingPoints.includes('amazon');
  const forest = Math.min(1, Math.max(0, climate.forest / 100));
  const seaY = SEA_Y0 - (Math.min(100, Math.max(0, climate.seaLevel)) / 100) * SEA_RISE;
  const birds = Math.round((Math.min(100, Math.max(0, climate.biodiversity)) / 100) * 9);
  /** Living trees close to the forest threshold are drying out, and burn after amazon. */
  const state = (t: TreeSpec) =>
    t.rank >= forest
      ? fires && t.rank < forest + 0.12
        ? 'burning'
        : 'dead'
      : !green && t.rank > forest - 0.25
        ? 'dry'
        : 'alive';

  return (
    <svg
      className={`scene scene-${tier}`}
      viewBox={`0 ${TOP} ${W} ${H + SKY}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <Defs p={p} />

      {/* Sky and sun. */}
      <rect y={TOP} width={W} height={H + SKY} fill="url(#sc-sky)" />
      <circle
        className="scene-sun-glow"
        cx={SUN[0]}
        cy={SUN[1]}
        r={p.sunR * 4}
        fill="url(#sc-sun-glow)"
      />
      {green && <SunRays />}
      <circle cx={SUN[0]} cy={SUN[1]} r={p.sunR} fill={p.sun} />
      <circle cx={SUN[0]} cy={SUN[1]} r={p.sunR * 0.82} fill="#fff" opacity={0.35} />

      {green ? <Clouds /> : <Smoke heavy={tier === 'scorched'} />}

      {/* Mountains, with snow while the Arctic holds (less of it when it warms). */}
      <path d={linePath(FAR_MOUNTAINS)} fill={p.farMountains} />
      <path
        d={peakShadows(FAR_MOUNTAINS, HORIZON)}
        clipPath="url(#sc-far-mountains)"
        fill="#1a2a3a"
        opacity={0.16}
      />
      <path d={linePath(NEAR_MOUNTAINS)} fill={p.nearMountains} />
      <path
        d={peakShadows(NEAR_MOUNTAINS, HORIZON + 30)}
        clipPath="url(#sc-near-mountains)"
        fill="#1a2a3a"
        opacity={0.2}
      />
      {!iceLost && (
        <g fill="#f5f9fc">
          <path
            d={snowPath(tier === 'preserved' ? 160 : 142, 3)}
            clipPath="url(#sc-far-mountains)"
            opacity={0.95}
          />
          <path
            d={snowPath(tier === 'preserved' ? 228 : 216, 7)}
            clipPath="url(#sc-near-mountains)"
            opacity={0.9}
          />
        </g>
      )}
      <rect y={HORIZON - 120} width={W} height={160} fill="url(#sc-haze)" />

      {/* Open sea up to the horizon, with the sun's glitter. */}
      <rect x={440} y={HORIZON} width={W - 440} height={H - HORIZON} fill="url(#sc-sea)" />
      <rect x={440} y={HORIZON} width={W - 440} height={3} fill={p.haze} opacity={0.7} />
      <SeaGlitter color={p.sun} from={HORIZON + 4} to={H} />
      <Swell from={HORIZON + 14} to={SEA_Y0 - 6} />
      {green && <OffshoreWind />}

      {/* Mid hills with a distant forest and the energy of the era. */}
      <path d={MID_HILL} fill={p.midHill} />
      <path d={MID_HILL} fill="url(#sc-mid-shade)" />
      {green ? <Turbines /> : <Factories heavy={tier === 'scorched'} />}
      {FAR_TREES.map((t, i) => (
        <Tree key={i} t={t} state={state(t)} p={p} far />
      ))}

      {/* Coastal city: lighter towers behind, detailed buildings in front, on a sandy shore. */}
      <path
        d={`M540,${CITY_Y + 40} L540,${midHillY(540)} L640,${CITY_Y - 12} L1140,${CITY_Y - 3} L1140,${CITY_Y + 3} L717,${CITY_Y + 5} Q650,${CITY_Y + 12} 600,${CITY_Y + 34} Z`}
        fill={p.midHill}
      />
      <CityLayer buildings={BACK_CITY} p={p} back />
      <CityLayer buildings={FRONT_CITY} p={p} greenRoofs={green} />
      <path
        d={`M600,${CITY_Y + 34} Q650,${CITY_Y + 12} 717,${CITY_Y + 5} L${QUAY[0]},${CITY_Y + 4}`}
        fill="none"
        stroke={p.sand}
        strokeWidth={6}
      />
      <Quay p={p} />
      {SHORE_TREES.map((t, i) => (
        <Tree key={i} t={t} state={state(t)} p={p} far />
      ))}

      {/* Front water: rises with the sea level over the city's feet. */}
      <Water y={seaY} p={p} />
      <Flooding y={seaY} level={climate.seaLevel} />
      {green && <Sailboat />}

      {/* Foreground hill and its forest. */}
      <path d={FRONT_HILL} fill="url(#sc-front-hill)" />
      <GroundDetails tier={tier} />
      {FRONT_TREES.map((t, i) => (
        <Tree key={i} t={t} state={state(t)} p={p} />
      ))}

      {Array.from({ length: birds }, (_, i) => (
        <Bird key={i} i={i} />
      ))}

      {tier === 'scorched' && (
        <rect className="scene-heat" y={TOP} width={W} height={H + SKY} fill="#ff3b1a" />
      )}
      {!green && <rect y={TOP} width={W} height={H + SKY} fill="url(#sc-vignette)" />}
    </svg>
  );
}

function Defs({ p }: { p: Palette }) {
  return (
    <defs>
      <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p.sky[0]} />
        <stop offset="0.5" stopColor={p.sky[1]} />
        <stop offset="0.66" stopColor={p.sky[2]} />
      </linearGradient>
      <radialGradient id="sc-sun-glow">
        <stop offset="0" stopColor={p.sun} stopOpacity="0.9" />
        <stop offset="0.3" stopColor={p.sun} stopOpacity="0.35" />
        <stop offset="1" stopColor={p.sun} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="sc-ray" gradientUnits="userSpaceOnUse" cx={SUN[0]} cy={SUN[1]} r={380}>
        <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="sc-haze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p.haze} stopOpacity="0" />
        <stop offset="0.75" stopColor={p.haze} stopOpacity="0.55" />
        <stop offset="1" stopColor={p.haze} stopOpacity="0" />
      </linearGradient>
      <linearGradient id="sc-sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p.sea[0]} />
        <stop offset="1" stopColor={p.sea[1]} />
      </linearGradient>
      <linearGradient id="sc-front-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p.sea[0]} stopOpacity="0.92" />
        <stop offset="1" stopColor={p.sea[1]} />
      </linearGradient>
      <linearGradient id="sc-mid-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.35" />
      </linearGradient>
      <linearGradient id="sc-front-hill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.75" stopColor={p.frontHill[0]} />
        <stop offset="1" stopColor={p.frontHill[1]} />
      </linearGradient>
      <radialGradient id="sc-vignette" cx="0.5" cy="0.55" r="0.75">
        <stop offset="0.6" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.45" />
      </radialGradient>
      <radialGradient id="sc-fire-glow">
        <stop offset="0" stopColor="#ffb040" stopOpacity="0.8" />
        <stop offset="1" stopColor="#ff5a1a" stopOpacity="0" />
      </radialGradient>
      <clipPath id="sc-far-mountains">
        <path d={linePath(FAR_MOUNTAINS)} />
      </clipPath>
      <clipPath id="sc-near-mountains">
        <path d={linePath(NEAR_MOUNTAINS)} />
      </clipPath>
      <filter id="sc-blur" x="-30%" y="-80%" width="160%" height="260%">
        <feGaussianBlur stdDeviation="14" />
      </filter>
      <filter id="sc-soft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>
  );
}

/* ---------- Sky ---------- */

function SunRays() {
  return (
    <g fill="url(#sc-ray)">
      <animateTransform
        attributeName="transform"
        type="rotate"
        from={`0 ${SUN[0]} ${SUN[1]}`}
        to={`360 ${SUN[0]} ${SUN[1]}`}
        dur="120s"
        repeatCount="indefinite"
      />
      {Array.from({ length: 12 }, (_, i) => (
        <path
          key={i}
          d={`M${SUN[0]},${SUN[1]} L${SUN[0] - 16},${SUN[1] - 380} L${SUN[0] + 16},${SUN[1] - 380} Z`}
          transform={`rotate(${i * 30} ${SUN[0]} ${SUN[1]})`}
        />
      ))}
    </g>
  );
}

const CLOUDS: [number, number, number][] = [
  [522, -37, 0.94],
  [975, 52, 1.09],
  [266, 113, 0.6],
];

function Clouds() {
  return (
    <g>
      {CLOUDS.map(([x, y, s], i) => (
        <g key={i} className="scene-cloud" style={{ animationDelay: `${i * -9}s` }}>
          <g transform={`translate(${x},${y}) scale(${s})`}>
            {/* Shaded underside, then the lit body and highlights. */}
            <path
              d="M-110,18 Q-110,-6 -80,-8 Q-74,-40 -38,-38 Q-20,-70 20,-62 Q52,-76 70,-44 Q104,-46 110,-14 Q130,0 118,18 Z"
              fill="#c9dbe6"
            />
            <path
              d="M-104,10 Q-104,-10 -78,-12 Q-72,-42 -38,-40 Q-20,-70 20,-64 Q50,-78 68,-46 Q100,-48 106,-18 Q122,-6 112,10 Z"
              fill="#fff"
            />
            <ellipse cx={14} cy={-46} rx={26} ry={12} fill="#fff" opacity={0.9} />
          </g>
        </g>
      ))}
    </g>
  );
}

function Smoke({ heavy }: { heavy: boolean }) {
  const r = rng(heavy ? 71 : 73);
  return (
    <g filter="url(#sc-blur)" opacity={heavy ? 0.7 : 0.5}>
      {Array.from({ length: heavy ? 9 : 6 }, (_, i) => {
        const rx = between(r, 160, 320);
        return (
          <ellipse
            key={i}
            className="scene-cloud"
            cx={between(r, 0, W)}
            cy={between(r, -150, 230)}
            rx={rx}
            ry={rx / between(r, 4, 6)}
            fill={heavy ? (i % 2 ? '#1e1210' : '#3a221a') : i % 2 ? '#6a4c44' : '#8a6658'}
            style={{ animationDelay: `${i * -7}s` }}
          />
        );
      })}
    </g>
  );
}

/* ---------- Sea ---------- */

function SeaGlitter({ color, from, to }: { color: string; from: number; to: number }) {
  const r = rng(13);
  return (
    <g fill={color}>
      {Array.from({ length: 70 }, (_, i) => {
        const y = from + ((to - from) * i) / 70 + between(r, -2, 2);
        // The glitter column widens towards the viewer.
        const spread = 18 + ((y - from) / (to - from)) * 120;
        const w = between(r, 8, 28) * (1 + (y - from) / 300);
        return (
          <rect
            key={i}
            className="scene-glint"
            x={SUN[0] + between(r, -spread, spread) - w / 2}
            y={y}
            width={w}
            height={2 + (y - from) / 120}
            rx={1}
            style={{ animationDelay: `${between(r, -3, 0).toFixed(2)}s` }}
          />
        );
      })}
    </g>
  );
}

/** Thin horizontal swell lines, denser near the horizon. */
function Swell({ from, to }: { from: number; to: number }) {
  const r = rng(17);
  return (
    <g stroke="#fff" strokeLinecap="round" opacity={0.28}>
      {Array.from({ length: 34 }, (_, i) => {
        const t = (i / 34) ** 1.6;
        const y = from + t * (to - from);
        const x = between(r, 480, 1500);
        const len = 20 + t * 70;
        return <line key={i} x1={x} x2={x + len} y1={y} y2={y} strokeWidth={1 + t * 2} />;
      })}
    </g>
  );
}

function OffshoreWind() {
  return (
    <g>
      <Turbine x={1025} hub={262} base={HORIZON + 4} s={0.3} />
      <Turbine x={1088} hub={282} base={HORIZON + 4} s={0.27} />
      <Turbine x={1273} hub={282} base={HORIZON + 4} s={0.27} />
    </g>
  );
}

function Sailboat() {
  return (
    <g className="scene-boat">
      <g transform="translate(1273, 384) scale(0.85)">
        <path d="M-34,0 L34,0 L24,12 L-26,12 Z" fill="#f2efe8" />
        <path d="M-34,0 L34,0 L30,5 L-30,5 Z" fill="#c7503a" />
        <path d="M0,-2 L0,-74" stroke="#5a4a3a" strokeWidth={2.5} />
        <path d="M3,-70 Q34,-30 28,-6 L3,-6 Z" fill="#fff" />
        <path d="M-3,-60 Q-24,-28 -22,-6 L-3,-6 Z" fill="#e8eef2" />
        <path d="M-30,16 L30,16" stroke="#fff" strokeWidth={2} opacity={0.5} />
      </g>
    </g>
  );
}

function Water({ y, p }: { y: number; p: Palette }) {
  // Long reflections of the city, cut into ripples and fading with depth.
  const reflections = [...BACK_CITY, ...FRONT_CITY].map((b, i) =>
    Array.from({ length: 14 }, (_, k) => (
      <rect
        key={`${i}-${k}`}
        x={b.x + (k % 2 ? 2 : -2)}
        y={y + 3 + k * 7}
        width={b.w}
        height={4}
        fill={i < BACK_CITY.length ? p.building[1] : p.building[0]}
        opacity={0.42 * (1 - k / 14)}
      />
    )),
  );
  return (
    <g>
      <path
        d={`M600,${y} L${W},${y} L${W},${H} L540,${H} L540,${y + 22} Q560,${y + 4} 600,${y} Z`}
        fill="url(#sc-front-water)"
      />
      <g className="scene-ripples">{reflections}</g>
      {/* Foam where the water meets the city, then scattered wavelets. */}
      <path className="scene-foam" d={foamPath(y)} fill="#f4fbfd" opacity={0.45} />
      <g className="scene-waves" fill="none" stroke="#eaf7fb" strokeLinecap="round">
        {WAVELETS.map(([x, dy, w], i) => (
          <path
            key={i}
            d={`M${x},${y + dy} q${w / 4},${-w / 7} ${w / 2},0 q${w / 4},${w / 7} ${w / 2},0`}
            strokeWidth={1.5 + dy / 60}
            opacity={0.35 + dy / 500}
          />
        ))}
      </g>
    </g>
  );
}

/** Irregular foam band along the water line. */
function foamPath(y: number) {
  const r = rng(41);
  let top = `M500,${y + 2}`;
  let bottom = '';
  for (let x = 500; x <= W; x += 18) {
    top += ` Q${x + 9},${y - between(r, 1, 4)} ${x + 18},${y + between(r, -1, 1)}`;
    bottom = ` L${x + 18},${y + between(r, 2, 4)}` + bottom;
  }
  return `${top}${bottom} Z`;
}

/** Wavelets of the front water: x, depth below the surface, width. */
const WAVELETS: [number, number, number][] = (() => {
  const r = rng(43);
  return Array.from({ length: 40 }, () => {
    const dy = 24 + between(r, 0, 1) ** 0.9 * 150;
    return [between(r, 600, 1500), dy, 14 + dy * 0.35];
  });
})();

/* ---------- Waterfront ---------- */

/** Stone quay in front of the city (x range), drowned first when the sea rises. */
const QUAY: [number, number] = [717, 1130];
const QUAY_TOP = CITY_Y + 1;

function Quay({ p }: { p: Palette }) {
  const [x0, x1] = QUAY;
  const stone = shade(p.sand, 0.72);
  return (
    <g>
      <rect x={x0} y={QUAY_TOP} width={x1 - x0} height={10} fill={stone} />
      <rect x={x0} y={QUAY_TOP} width={x1 - x0} height={2} fill={shade(p.sand, 1.05)} />
      {/* Stone joints, bollards and lamp posts along the quay. */}
      {Array.from({ length: Math.floor((x1 - x0) / 16) }, (_, i) => (
        <line
          key={i}
          x1={x0 + 8 + i * 16}
          x2={x0 + 8 + i * 16}
          y1={QUAY_TOP + 3 + (i % 2) * 4}
          y2={QUAY_TOP + 6 + (i % 2) * 4}
          stroke={shade(stone, 0.75)}
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => {
        const x = x0 + 30 + i * 52;
        return (
          <g key={x}>
            <line
              x1={x}
              x2={x}
              y1={QUAY_TOP}
              y2={QUAY_TOP - 16}
              stroke="#2e3a44"
              strokeWidth={1.5}
            />
            <circle cx={x} cy={QUAY_TOP - 17} r={2.2} fill={p.window} />
            <rect x={x + 24} y={QUAY_TOP - 3} width={3} height={3} fill="#2e3a44" />
          </g>
        );
      })}
    </g>
  );
}

/** Water hitting the façades: wet marks above the water line and splashing waves. */
function Flooding({ y, level }: { y: number; level: number }) {
  // Below ~20 cm the sea stays below the quay: nothing to show.
  const k = Math.min(1, Math.max(0, (level - 20) / 80));
  if (k === 0) return null;
  const wet = 3 + k * 7;
  return (
    <g>
      {FRONT_CITY.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={y - wet}
          width={b.w}
          height={wet}
          fill="#0b1a24"
          opacity={0.22}
        />
      ))}
      {FRONT_CITY.map((b, i) => {
        const cx = b.x + b.w / 2;
        const h = 6 + k * 10;
        return (
          <g
            key={`s${b.x}`}
            className="scene-splash"
            style={{ animationDelay: `${-((i * 0.37) % 1.8)}s` }}
          >
            <path
              d={`M${cx - b.w * 0.45},${y + 1} Q${cx - b.w * 0.25},${y - h} ${cx},${y - h * 0.6} Q${cx + b.w * 0.25},${y - h * 1.1} ${cx + b.w * 0.45},${y + 1} Z`}
              fill="#f4fbfd"
              opacity={0.8}
            />
            {[-0.3, 0, 0.3].map((dx) => (
              <circle
                key={dx}
                cx={cx + dx * b.w}
                cy={y - h - 3 - Math.abs(dx) * 8}
                r={1.8}
                fill="#f4fbfd"
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

/* ---------- City ---------- */

function CityLayer({
  buildings,
  p,
  back,
  greenRoofs,
}: {
  buildings: Building[];
  p: Palette;
  back?: boolean;
  greenRoofs?: boolean;
}) {
  const base = back ? CITY_Y : CITY_Y + 1;
  // Back towers are lighter (further away in the haze).
  const [body, face] = back ? [p.building[1], shade(p.building[1], 1.12)] : p.building;
  return (
    <g>
      {buildings.map((b) => {
        const top = base - b.h;
        const roofDetails: ReactNode[] = [];
        if (b.kind === 'spire')
          roofDetails.push(
            <path
              key="s"
              d={`M${b.x + b.w * 0.3},${top} L${b.x + b.w / 2},${top - 46} L${b.x + b.w * 0.7},${top} Z`}
              fill={body}
            />,
          );
        if (b.kind === 'dome')
          roofDetails.push(
            <path
              key="d"
              d={`M${b.x + 4},${top} A${b.w / 2 - 4},${b.w / 3} 0 0 1 ${b.x + b.w - 4},${top} Z`}
              fill={p.building[1]}
            />,
          );
        if (b.kind === 'antenna')
          roofDetails.push(
            <g key="a">
              <line
                x1={b.x + b.w * 0.6}
                x2={b.x + b.w * 0.6}
                y1={top}
                y2={top - 34}
                stroke={p.building[0]}
                strokeWidth={3}
              />
              <circle
                className="scene-beacon"
                cx={b.x + b.w * 0.6}
                cy={top - 35}
                r={3.5}
                fill="#ff3b30"
              />
            </g>,
          );
        return (
          <g key={b.x}>
            {b.kind === 'stepped' && (
              <rect
                x={b.x + b.w * 0.2}
                y={top - 22}
                width={b.w * 0.6}
                height={24}
                fill={p.building[0]}
              />
            )}
            {roofDetails}
            <rect x={b.x} y={top} width={b.w} height={b.h + 30} fill={body} />
            {/* Sunlit right face. */}
            <rect
              x={b.x + b.w * 0.62}
              y={top}
              width={b.w * 0.38}
              height={b.h + 30}
              fill={face}
              opacity={0.6}
            />
            <rect x={b.x - 1} y={top - 3} width={b.w + 2} height={4} fill={face} />
            <Windows b={b} top={top} p={p} dim={back} />
            {greenRoofs && b.roof < 0.3 && (
              <rect
                x={b.x + 6}
                y={top - 5}
                width={b.w - 12}
                height={5}
                fill="#5fa04e"
                opacity={0.85}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

function Windows({ b, top, p, dim }: { b: Building; top: number; p: Palette; dim?: boolean }) {
  const cells: ReactNode[] = [];
  const cw = (b.w - 8) / b.cols;
  for (let r = 0; r < b.rows; r++)
    for (let c = 0; c < b.cols; c++) {
      const lit = b.lit[r * b.cols + c];
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={b.x + 5 + c * cw}
          y={top + 8 + r * 15}
          width={cw - 4}
          height={8}
          fill={lit ? p.window : shade(p.building[0], 0.7)}
          opacity={(lit ? 0.92 : 0.6) * (dim ? 0.55 : 1)}
        />,
      );
    }
  return <g>{cells}</g>;
}

/* ---------- Land ---------- */

/** Wind turbine: hub height, tower base and blade scale (1 = 78 units). */
function Turbine({ x, hub, base, s }: { x: number; hub: number; base: number; s: number }) {
  const y = base;
  const top = hub;
  return (
    <g>
      <path
        d={`M${x - 3 * s - 1},${y} L${x - 1.2 * s},${top} L${x + 1.2 * s},${top} L${x + 3 * s + 1},${y} Z`}
        fill="#eef2f4"
      />
      <g transform={`translate(${x},${top}) scale(${s})`}>
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur={`${4 + (x % 5) * 0.4}s`}
            repeatCount="indefinite"
          />
          {[0, 120, 240].map((a) => (
            <path
              key={a}
              d="M0,0 C-6,-12 -5,-50 0,-78 C3,-50 5,-12 0,0 Z"
              fill="#f6f8f9"
              transform={`rotate(${a})`}
            />
          ))}
        </g>
        <rect x={-5} y={-4} width={14} height={8} rx={3} fill="#dfe5e8" />
        <circle r={4} fill="#c9d1d5" />
      </g>
    </g>
  );
}

function Turbines() {
  return (
    <g>
      <Turbine x={382} hub={241} base={380} s={0.64} />
      <Turbine x={466} hub={201} base={380} s={0.77} />
      <Turbine x={556} hub={225} base={380} s={0.56} />
    </g>
  );
}

function Factories({ heavy }: { heavy: boolean }) {
  return (
    <g>
      {[420, 580].map((x, i) => {
        const y = midHillY(x) + 6;
        const chimneys = [x + 18, x + 40];
        return (
          <g key={x}>
            {chimneys.map((cx, k) => (
              <g key={cx}>
                <rect x={cx} y={y - 104 + k * 14} width={12} height={110} fill="#2e2422" />
                <rect x={cx} y={y - 92 + k * 14} width={12} height={5} fill="#b03a2a" />
                {[0, 1, 2, 3].map((j) => (
                  <circle
                    key={j}
                    className="scene-puff"
                    cx={cx + 6}
                    cy={y - 110 + k * 14}
                    r={14 + j * 5}
                    fill={heavy ? '#2a201e' : '#4a403c'}
                    filter="url(#sc-soft)"
                    style={{ animationDelay: `${(j + k * 0.5 + i) * -1.1}s` }}
                  />
                ))}
              </g>
            ))}
            <path
              d={`M${x - 50},${y} L${x - 50},${y - 40} L${x - 30},${y - 54} L${x - 30},${y - 40} L${x - 10},${y - 54} L${x - 10},${y - 40} L${x + 10},${y - 54} L${x + 10},${y - 40} L${x + 60},${y - 40} L${x + 60},${y} Z`}
              fill="#3a2e2c"
            />
            {[-40, -20, 0, 24, 44].map((dx) => (
              <rect
                key={dx}
                x={x + dx}
                y={y - 30}
                width={8}
                height={10}
                fill="#e08a3a"
                opacity={0.7}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

type TreeState = 'alive' | 'dry' | 'dead' | 'burning';

function Tree({ t, state, p, far }: { t: TreeSpec; state: TreeState; p: Palette; far?: boolean }) {
  const { x, y, s } = t;
  if (state === 'dead' || state === 'burning')
    return (
      <g>
        <DeadTree x={x} y={y} s={s} charred={state === 'burning'} />
        {state === 'burning' && <Fire x={x} y={y} s={s} />}
      </g>
    );
  // Small per-tree shade shift so the forest does not look stamped.
  const f = 1 + (t.tone - 0.5) * 0.3;
  const [dark, base, light] = (state === 'dry' ? p.dry : p.leaves).map((c) => shade(c, f));
  return (
    <g
      className={far ? undefined : 'scene-tree'}
      style={far ? undefined : { animationDelay: `${-t.tone * 5}s` }}
    >
      {!far && <ellipse cx={x + 6 * s} cy={y} rx={26 * s} ry={6 * s} fill="#000" opacity={0.18} />}
      {t.species === 'pine' && <Pine x={x} y={y} s={s} c={[dark!, base!, light!]} />}
      {t.species === 'round' && <RoundTree x={x} y={y} s={s} c={[dark!, base!, light!]} />}
      {t.species === 'poplar' && <Poplar x={x} y={y} s={s} c={[dark!, base!, light!]} />}
    </g>
  );
}

/** Hex colour scaled by `f` (> 1 lighter, < 1 darker). */
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) =>
    Math.min(255, Math.round(v * f))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

type Shades = [string, string, string];
const TRUNK = '#5a3c26';

function Pine({ x, y, s, c }: { x: number; y: number; s: number; c: Shades }) {
  const tiers = [0, 1, 2, 3];
  return (
    <g>
      <rect x={x - 4 * s} y={y - 22 * s} width={8 * s} height={24 * s} fill={TRUNK} />
      {tiers.map((k) => {
        const bottom = y - 16 * s - k * 22 * s;
        const half = (40 - k * 8) * s;
        const tip = bottom - 44 * s;
        return (
          <g key={k}>
            <path
              d={`M${x},${tip} L${x - half},${bottom} Q${x - half / 2},${bottom - 6 * s} ${x},${bottom + 2 * s} Q${x + half / 2},${bottom - 6 * s} ${x + half},${bottom} Z`}
              fill={c[1]}
            />
            {/* Shadow on the left, sunlit right edge. */}
            <path
              d={`M${x},${tip} L${x - half},${bottom} Q${x - half / 2},${bottom - 6 * s} ${x - 2 * s},${bottom + 1 * s} Z`}
              fill={c[0]}
              opacity={0.75}
            />
            <path
              d={`M${x},${tip} L${x + half * 0.85},${bottom - 2 * s} L${x + half * 0.45},${bottom - 4 * s} Z`}
              fill={c[2]}
              opacity={0.8}
            />
          </g>
        );
      })}
    </g>
  );
}

function RoundTree({ x, y, s, c }: { x: number; y: number; s: number; c: Shades }) {
  const blobs: [number, number, number][] = [
    [-22, -62, 24],
    [20, -64, 26],
    [0, -88, 30],
    [-14, -100, 20],
    [16, -96, 22],
  ];
  return (
    <g>
      <path
        d={`M${x - 5 * s},${y} L${x - 3 * s},${y - 60 * s} L${x + 3 * s},${y - 60 * s} L${x + 6 * s},${y} Z`}
        fill={TRUNK}
      />
      <path
        d={`M${x},${y - 40 * s} L${x + 18 * s},${y - 62 * s} M${x},${y - 48 * s} L${x - 16 * s},${y - 66 * s}`}
        stroke={TRUNK}
        strokeWidth={4 * s}
      />
      {blobs.map(([dx, dy, r], i) => (
        <circle key={`d${i}`} cx={x + (dx - 3) * s} cy={y + (dy + 4) * s} r={r * s} fill={c[0]} />
      ))}
      {blobs.map(([dx, dy, r], i) => (
        <circle key={`b${i}`} cx={x + dx * s} cy={y + dy * s} r={r * 0.92 * s} fill={c[1]} />
      ))}
      <circle cx={x + 18 * s} cy={y - 72 * s} r={13 * s} fill={c[2]} opacity={0.85} />
      <circle cx={x + 8 * s} cy={y - 100 * s} r={14 * s} fill={c[2]} opacity={0.85} />
      <circle cx={x + 26 * s} cy={y - 90 * s} r={8 * s} fill={c[2]} opacity={0.7} />
    </g>
  );
}

function Poplar({ x, y, s, c }: { x: number; y: number; s: number; c: Shades }) {
  return (
    <g>
      <rect x={x - 3 * s} y={y - 26 * s} width={6 * s} height={28 * s} fill={TRUNK} />
      <ellipse cx={x} cy={y - 82 * s} rx={20 * s} ry={64 * s} fill={c[1]} />
      <path
        d={`M${x},${y - 146 * s} A${20 * s},${64 * s} 0 0 0 ${x},${y - 18 * s} Z`}
        fill={c[0]}
        opacity={0.7}
      />
      <ellipse cx={x + 9 * s} cy={y - 96 * s} rx={7 * s} ry={34 * s} fill={c[2]} opacity={0.75} />
    </g>
  );
}

function DeadTree({ x, y, s, charred }: { x: number; y: number; s: number; charred: boolean }) {
  const color = charred ? '#1e1512' : '#6a5a4e';
  return (
    <g stroke={color} strokeLinecap="round" fill="none">
      <path d={`M${x},${y} L${x - 1 * s},${y - 70 * s}`} strokeWidth={6 * s} />
      <path
        d={`M${x},${y - 30 * s} L${x - 18 * s},${y - 52 * s} L${x - 24 * s},${y - 70 * s} M${x - 1 * s},${y - 46 * s} L${x + 16 * s},${y - 66 * s} L${x + 20 * s},${y - 84 * s} M${x - 1 * s},${y - 60 * s} L${x - 8 * s},${y - 84 * s}`}
        strokeWidth={3.5 * s}
      />
    </g>
  );
}

function Fire({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g>
      <circle className="scene-glow" cx={x} cy={y - 40 * s} r={70 * s} fill="url(#sc-fire-glow)" />
      <g className="scene-fire" style={{ animationDelay: `${-(x % 3) * 0.2}s` }}>
        <path
          d={`M${x - 26 * s},${y} Q${x - 34 * s},${y - 50 * s} ${x - 6 * s},${y - 96 * s} Q${x - 4 * s},${y - 60 * s} ${x + 8 * s},${y - 70 * s} Q${x + 30 * s},${y - 40 * s} ${x + 24 * s},${y} Z`}
          fill="#e8481a"
        />
        <path
          d={`M${x - 16 * s},${y} Q${x - 20 * s},${y - 36 * s} ${x - 2 * s},${y - 66 * s} Q${x + 16 * s},${y - 34 * s} ${x + 14 * s},${y} Z`}
          fill="#ff9a2a"
        />
        <path
          d={`M${x - 8 * s},${y} Q${x - 10 * s},${y - 20 * s} ${x},${y - 38 * s} Q${x + 9 * s},${y - 20 * s} ${x + 7 * s},${y} Z`}
          fill="#ffe27a"
        />
      </g>
      {[0, 1, 2].map((k) => (
        <circle
          key={k}
          className="scene-ember"
          cx={x + (k - 1) * 10 * s}
          cy={y - 70 * s}
          r={2.5}
          fill="#ffc04a"
          style={{ animationDelay: `${-k * 0.8 - (x % 5) * 0.3}s` }}
        />
      ))}
    </g>
  );
}

/** Flowers and grass on a healthy hill, dry cracks on a burnt one. */
function GroundDetails({ tier }: { tier: EndingTier }) {
  const r = rng(29);
  const spots = Array.from({ length: 60 }, () => {
    const x = between(r, -20, 560);
    return [x, frontHillY(x) + between(r, 14, 150)] as const;
  });
  if (tier === 'preserved' || tier === 'strained') {
    const flowers =
      tier === 'preserved' ? ['#ffd84a', '#ffffff', '#ff7aa8', '#b48aff'] : ['#e8d070', '#f2efe0'];
    return (
      <g>
        {spots.map(([x, y], i) => (
          <g key={i}>
            <path
              d={`M${x},${y} l-4,-12 M${x},${y} l1,-14 M${x},${y} l6,-11`}
              stroke="#2a6a30"
              strokeWidth={2}
              opacity={0.55}
            />
            {i % 2 === 0 && (
              <circle cx={x + 1} cy={y - 14} r={3} fill={flowers[i % flowers.length]} />
            )}
          </g>
        ))}
      </g>
    );
  }
  return (
    <g stroke="#2a180e" strokeWidth={2} fill="none" opacity={0.45}>
      {spots.slice(0, 26).map(([x, y], i) => (
        <path key={i} d={`M${x},${y} l14,4 l8,-6 m-8,6 l4,10 m-18,-14 l-10,6`} />
      ))}
    </g>
  );
}

function Bird({ i }: { i: number }) {
  // Spread birds over the sky with fixed positions and speeds.
  const y = -80 + ((i * 53) % 300);
  const dur = 24 + ((i * 7) % 14);
  const s = 0.7 + ((i * 37) % 10) / 20;
  return (
    <g
      className="scene-bird"
      style={{ animationDuration: `${dur}s`, animationDelay: `${-i * 4.3}s` }}
    >
      <path
        className="scene-wing"
        d={`M0,${y} q${10 * s},${-10 * s} ${20 * s},${-2 * s} q${4 * s},${4 * s} ${4 * s},${4 * s} q0,${-6 * s} ${4 * s},${-6 * s} q${10 * s},${-8 * s} ${20 * s},${2 * s}`}
        fill="none"
        stroke="#1d2a33"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animationDelay: `${-i * 0.17}s` }}
      />
    </g>
  );
}
