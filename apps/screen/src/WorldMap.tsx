// Living world map: heat by latitude, forests, sea level, tipping points.
// Every visual is driven by CSS transitions so era changes animate over 2 s.
import { geoCentroid, geoContains, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { TippingPointId, World } from '@jdlt/shared';
import countries110m from 'world-atlas/countries-110m.json';
import land110m from 'world-atlas/land-110m.json';
import { TIPPING } from './tipping.ts';

const WIDTH = 960;
const HEIGHT = 500;
const countriesTopo = countries110m as unknown as Topology<{ countries: GeometryCollection }>;
const landTopo = land110m as unknown as Topology<{ land: GeometryCollection }>;
const countries = feature(countriesTopo, countriesTopo.objects.countries);
const land = feature(landTopo, landTopo.objects.land);
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], countries);
const path = geoPath(projection);

/**
 * Local warming relative to the global anomaly: poles warm about twice as
 * fast (polar amplification) and the tropics a bit faster than mid-latitudes.
 */
function amplification(lat: number) {
  const polar = (Math.abs(lat) / 90) ** 2;
  const tropical = Math.exp(-((lat / 15) ** 2));
  return 0.8 + 1.4 * polar + 0.4 * tropical;
}

const COUNTRIES = countries.features.map((f) => ({
  d: path(f) ?? '',
  amp: amplification(geoCentroid(f)[1]),
}));

/** Coastline drawn under the countries: its outer half reads as rising water. */
const COAST = path(mesh(landTopo, landTopo.objects.land)) ?? '';

/** 0 °C → green, ~2 °C → yellow/orange, 4 °C+ → dark red. */
function heatColor(t: number) {
  const x = Math.min(1, Math.max(0, t / 4));
  return `hsl(${120 - 120 * x}, ${45 + 30 * x}%, ${42 - 12 * x}%)`;
}

// Forest dots: a lon/lat grid over the big forest basins, kept on land only.
const FOREST_ZONES: { lon: [number, number]; lat: [number, number]; step: number }[] = [
  { lon: [-76, -48], lat: [-13, 4], step: 2.4 }, // Amazonie
  { lon: [11, 29], lat: [-5, 5], step: 2.2 }, // Congo
  { lon: [109, 119], lat: [-3, 6.5], step: 1.6 }, // Bornéo
  { lon: [60, 135], lat: [52, 64], step: 3.2 }, // Sibérie
];
const FOREST_DOTS = FOREST_ZONES.flatMap(({ lon, lat, step }) => {
  const dots: { x: number; y: number; rank: number }[] = [];
  for (let lo = lon[0]; lo <= lon[1]; lo += step)
    for (let la = lat[0]; la <= lat[1]; la += step) {
      if (!geoContains(land, [lo, la])) continue;
      const [x, y] = projection([lo, la])!;
      dots.push({ x, y, rank: hash(lo, la) });
    }
  return dots;
});

/** Deterministic pseudo-random in [0, 1): the order in which dots disappear. */
function hash(a: number, b: number) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const SEA_MAX_CM = 100;
const SEA_MAX_STROKE = 9;

export function WorldMap({ world }: { world: World }) {
  const { temperature, forest, seaLevel } = world.climate;
  // forest is 100 at 1900: a dot survives while its rank is below the remaining share.
  const forestShare = Math.min(1, Math.max(0, forest / 100));
  const sea = Math.min(1, Math.max(0, seaLevel / SEA_MAX_CM));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label="Carte du monde"
      className="world-map"
    >
      <path
        d={COAST}
        className="coast"
        strokeWidth={0.5 + sea * SEA_MAX_STROKE}
        strokeOpacity={0.35 + 0.65 * sea}
      />
      {COUNTRIES.map((c, i) => (
        <path key={i} d={c.d} className="country" fill={heatColor(temperature * c.amp)} />
      ))}
      <g className="forest">
        {FOREST_DOTS.map((dot, i) => (
          <circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={3.2}
            className={dot.rank < forestShare ? '' : 'gone'}
          />
        ))}
      </g>
      {world.tippingPoints.map((id) => (
        <TippingMarker key={id} id={id} />
      ))}
    </svg>
  );
}

function TippingMarker({ id }: { id: TippingPointId }) {
  const { label, icon: Icon, lonLat } = TIPPING[id];
  const [x, y] = projection(lonLat)!;
  return (
    <g className="tipping" transform={`translate(${x} ${y})`}>
      <circle r={24} className="tipping-ring" />
      <circle r={21} className="tipping-disc" />
      <Icon className="tipping-icon" x={-13} y={-13} width={26} height={26} strokeWidth={2.4} />
      <text className="tipping-label" y={44}>
        {label}
      </text>
    </g>
  );
}
