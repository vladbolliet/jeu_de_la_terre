// Placeholder map: countries tinted by temperature. To be replaced/extended
// (deforestation, sea level, heat zones…).
import { useMemo } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { World } from '@jdlt/shared';
import countries110m from 'world-atlas/countries-110m.json';

const WIDTH = 960;
const HEIGHT = 500;
const topo = countries110m as unknown as Topology<{ countries: GeometryCollection }>;
const geo = feature(topo, topo.objects.countries);
const path = geoPath(geoNaturalEarth1().fitSize([WIDTH, HEIGHT], geo));

function heatColor(t: number) {
  // 0 °C → green, 4 °C+ → dark red
  const x = Math.min(1, Math.max(0, t / 4));
  return `hsl(${120 - 120 * x}, ${45 + 25 * x}%, ${45 - 15 * x}%)`;
}

export function WorldMap({ world }: { world: World }) {
  const paths = useMemo(() => geo.features.map((f) => path(f) ?? ''), []);
  const fill = heatColor(world.climate.temperature);
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Carte du monde">
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={fill}
          stroke="#0f172a"
          strokeWidth={0.5}
          style={{ transition: 'fill 2s' }}
        />
      ))}
    </svg>
  );
}
