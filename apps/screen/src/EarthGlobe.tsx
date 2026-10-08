// Realistic spinning Earth (three.js) whose look follows the world state:
// sea ice melts with temperature, forests brown as they disappear, city
// lights spread on the night side over the eras, the atmosphere glow turns
// from blue to orange. Textures (bundled so the game works offline):
// Solar System Scope 8K day map, downscaled (CC BY 4.0,
// https://www.solarsystemscope.com/textures/), NASA Black Marble 2016 (city
// lights, public domain); water mask and normal map
// from the three.js examples (MIT).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { TippingPointId, World } from '@jdlt/shared';
import dayUrl from './assets/earth_day.jpg';
// R = water mask, G = city lights.
import dataUrl from './assets/earth_data.png';
import normalUrl from './assets/earth_normal.jpg';
import cloudsUrl from './assets/earth_clouds.jpg';
import { TIPPING } from './tipping.ts';

const RAD = Math.PI / 180;
const SPIN_RAD_PER_S = 7 * RAD;
const CLOUD_DRIFT_RAD_PER_S = 1.5 * RAD;
const AXIAL_TILT = 23.4 * RAD;
/** Time constant of the visual transition between eras (≈ 2 s to settle). */
const EASE_S = 0.6;
const FOV = 30;

/** World state → shader inputs, all in 0…1. */
function targets(world: World) {
  const { temperature, forest, biodiversity } = world.climate;
  return {
    warm: Math.min(1, Math.max(0, temperature / 4)),
    forestLoss: Math.min(1, Math.max(0, (100 - forest) / 50)),
    bioLoss: Math.min(1, Math.max(0, (100 - biodiversity) / 60)),
    // Big cities only in 1900, today's lights by ~2040.
    urban: Math.min(1, Math.max(0, (world.year - 1900) / 140)),
  };
}

const surfaceVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Sphere tangent frame: east (increasing u) and north (increasing v).
    vec3 p = normalize(position);
    vec3 east = normalize(vec3(p.z, 0.0, -p.x) + vec3(1e-5, 0.0, 0.0));
    vNormal = normalize(normalMatrix * p);
    vTangent = normalize(normalMatrix * east);
    vBitangent = normalize(normalMatrix * cross(p, east));
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const surfaceFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uData;
  uniform sampler2D uNormal;
  uniform sampler2D uClouds;
  uniform vec3 uSun;
  uniform float uWarm;
  uniform float uForestLoss;
  uniform float uUrban;
  uniform float uCloudShift;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  varying vec3 vView;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    return 0.55 * noise(p) + 0.3 * noise(p * 2.3) + 0.15 * noise(p * 5.1);
  }

  void main() {
    vec3 tex = texture2D(uDay, vUv).rgb;
    vec4 data = texture2D(uData, vUv);
    float water = smoothstep(0.35, 0.65, data.r);
    float land = 1.0 - water;
    float lat = (vUv.y - 0.5) * 180.0;
    float lon = (vUv.x - 0.5) * 360.0;
    float lum = dot(tex, vec3(0.299, 0.587, 0.114));

    // Oceans: the texture's flat blue (not the texture itself, which has
    // Arctic sea ice painted in), with a faint large-scale variation so the
    // open sea does not look painted.
    vec3 ocean = vec3(0.118, 0.231, 0.459) * (0.92 + 0.16 * fbm(vec2(lon, lat) * 0.04));
    ocean = mix(ocean, ocean * vec3(1.05, 1.12, 0.85) + vec3(0.01, 0.012, 0.0), uWarm * 0.5);

    // Land: vegetation browns with deforestation (tropics first) and heat,
    // bare land and deserts redden.
    vec3 ground = tex * 0.92;
    float green = ground.g - max(ground.r, ground.b);
    float veg = smoothstep(0.0, 0.04, green);
    float tropics = 1.0 - smoothstep(20.0, 40.0, abs(lat));
    float brown = clamp(uForestLoss * (0.7 + 0.6 * tropics) + uWarm * 0.3, 0.0, 0.9);
    ground = mix(ground, vec3(0.45, 0.34, 0.2) * (0.6 + lum), veg * brown);
    float snow = smoothstep(0.55, 0.8, min(ground.r, min(ground.g, ground.b)));
    ground = mix(ground, ground * vec3(1.12, 0.9, 0.74), (1.0 - snow) * uWarm * 0.55);

    vec3 col = mix(ground, ocean, water);

    // Sea ice (not in the texture) retreats poleward as it warms.
    float melt = smoothstep(0.15, 0.85, uWarm);
    float edge = (fbm(vec2(lon * 0.09, lat * 0.25)) - 0.5) * 9.0;
    float arctic = smoothstep(-1.5, 1.5, lat - (mix(71.0, 91.0, melt) + edge));
    float antarctic = smoothstep(-1.5, 1.5, (mix(-61.0, -72.0, melt) - edge) - lat);
    float ice = water * max(arctic, antarctic);
    vec3 iceCol = vec3(0.82, 0.88, 0.93) * (0.88 + 0.12 * noise(vec2(lon, lat) * 1.7));
    col = mix(col, iceCol, ice);

    // Relief from the normal map (land only), smooth sphere for water and ice.
    vec3 nt = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
    vec3 n0 = normalize(vNormal);
    vec3 nr = normalize(vTangent * nt.x * 1.6 + vBitangent * nt.y * 1.6 + n0 * nt.z);
    vec3 n = normalize(mix(n0, nr, land * (1.0 - ice)));

    float sunDot = dot(n0, uSun);
    float day = smoothstep(-0.12, 0.22, sunDot);
    float diffuse = max(dot(n, uSun), 0.0);
    float light = 0.03 + 1.05 * smoothstep(-0.05, 0.75, diffuse) * day;

    // Clouds cast a soft shadow on the day side.
    float cloud = texture2D(uClouds, vec2(vUv.x - uCloudShift + 0.0025, vUv.y - 0.002)).r;
    light *= 1.0 - smoothstep(0.2, 0.9, cloud) * 0.45 * day;

    vec3 v = normalize(vView);
    vec3 h = normalize(uSun + v);
    float nh = max(dot(n0, h), 0.0);
    float glint = (pow(nh, 140.0) * 1.4 + pow(nh, 14.0) * 0.07) * water * (1.0 - ice) * day;

    // City lights on the night side, the dimmer ones appearing over the eras.
    float city = data.g;
    float shown = smoothstep(mix(0.55, 0.0, uUrban), mix(0.75, 0.12, uUrban), city);
    vec3 lights = vec3(1.0, 0.68, 0.34) * city * shown * 1.7 * (1.0 - day) * land;

    // Thin blue haze towards the limb, on the lit side.
    float limb = pow(1.0 - max(dot(n0, v), 0.0), 2.5);
    vec3 haze = mix(vec3(0.42, 0.66, 1.0), vec3(1.0, 0.52, 0.28), smoothstep(0.15, 0.9, uWarm));

    // Water looks paler at grazing angles (sky reflection).
    col = mix(col, vec3(0.28, 0.54, 0.82), water * (1.0 - ice) * limb * 0.7);

    vec3 c = col * light + glint * vec3(1.0, 0.92, 0.78) + lights + haze * limb * 0.6 * day;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const cloudFragment = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSun;
  uniform float uWarm;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float a = texture2D(uClouds, vUv).r;
    a = smoothstep(0.2, 0.95, a) * 0.8;
    float d = dot(normalize(vNormal), uSun);
    float light = 0.02 + 1.0 * smoothstep(-0.1, 0.6, d);
    // Hazier, warmer-tinted sky as it heats up.
    vec3 c = mix(vec3(1.0), vec3(1.0, 0.86, 0.74), uWarm * 0.7);
    gl_FragColor = vec4(c * light, a * (0.25 + 0.75 * smoothstep(-0.2, 0.2, d)));
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform float uWarm;
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Back faces of a slightly larger sphere: brightest just outside the
    // Earth's limb, fading to nothing at the outer edge; lit side only.
    vec3 n = normalize(vNormal);
    float d = abs(dot(n, normalize(vView)));
    float i = pow(smoothstep(0.0, 0.42, d), 2.5);
    float lit = 0.15 + 0.85 * smoothstep(-0.35, 0.5, dot(n, uSun));
    vec3 cool = vec3(0.4, 0.66, 1.0);
    vec3 hot = vec3(1.0, 0.45, 0.18);
    gl_FragColor = vec4(mix(cool, hot, smoothstep(0.15, 0.9, uWarm)), i * 0.7 * lit);
  }
`;

export function EarthGlobe({ world }: { world: World }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef(world);
  worldRef.current = world;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    host.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    // Side light: about a third of the disc is night, to show the city lights.
    const sun = new THREE.Vector3(-0.75, 0.3, 0.45).normalize();

    const loader = new THREE.TextureLoader();
    const day = loader.load(dayUrl);
    const data = loader.load(dataUrl);
    const normal = loader.load(normalUrl);
    const clouds = loader.load(cloudsUrl);
    const textures = [day, data, normal, clouds];
    for (const t of textures) {
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.colorSpace = THREE.NoColorSpace;
    }

    const now = targets(worldRef.current);
    const uniforms = {
      uDay: { value: day },
      uData: { value: data },
      uNormal: { value: normal },
      uClouds: { value: clouds },
      uSun: { value: sun },
      uWarm: { value: now.warm },
      uForestLoss: { value: now.forestLoss },
      uUrban: { value: now.urban },
      /** Cloud layer rotation relative to the ground, in texture u. */
      uCloudShift: { value: 0 },
    };

    const tilt = new THREE.Group();
    tilt.rotation.z = AXIAL_TILT;
    tilt.rotation.x = 0.25;
    scene.add(tilt);

    const geo = new THREE.SphereGeometry(1, 96, 64);
    const earth = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: surfaceVertex,
        fragmentShader: surfaceFragment,
      }),
    );
    tilt.add(earth);

    const cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, 96, 64),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: surfaceVertex,
        fragmentShader: cloudFragment,
        transparent: true,
        depthWrite: false,
      }),
    );
    tilt.add(cloudMesh);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.09, 64, 48),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: surfaceVertex,
        fragmentShader: atmosphereFragment,
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(atmosphere);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Back off until the globe and its glow fit the shorter side.
      camera.position.set(0, 0, 1.16 / (Math.tan((FOV / 2) * RAD) * Math.min(1, camera.aspect)));
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const markerEls = () => Array.from(markersRef.current?.children ?? []) as HTMLElement[];
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const camDir = new THREE.Vector3();

    let last = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      earth.rotation.y += SPIN_RAD_PER_S * dt;
      cloudMesh.rotation.y += (SPIN_RAD_PER_S + CLOUD_DRIFT_RAD_PER_S) * dt;
      uniforms.uCloudShift.value =
        (((cloudMesh.rotation.y - earth.rotation.y) / (2 * Math.PI)) % 1 + 1) % 1;

      // Ease shader inputs towards the current world state.
      const target = targets(worldRef.current);
      const k = 1 - Math.exp(-dt / EASE_S);
      uniforms.uWarm.value += (target.warm - uniforms.uWarm.value) * k;
      uniforms.uForestLoss.value += (target.forestLoss - uniforms.uForestLoss.value) * k;
      uniforms.uUrban.value += (target.urban - uniforms.uUrban.value) * k;

      renderer.render(scene, camera);

      // Pin tipping-point markers to the surface; hide them on the far side.
      tilt.updateMatrixWorld();
      const w = host.clientWidth;
      const h = host.clientHeight;
      for (const el of markerEls()) {
        const lon = Number(el.dataset.lon);
        const lat = Number(el.dataset.lat);
        // Same convention as three's SphereGeometry UVs.
        const phi = (lon + 180) * RAD;
        const theta = (90 - lat) * RAD;
        v.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
        earth.localToWorld(v.multiplyScalar(1.02));
        n.copy(v).normalize();
        camDir.copy(camera.position).sub(v).normalize();
        const facing = n.dot(camDir);
        v.project(camera);
        el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
        el.style.opacity = String(Math.max(0, Math.min(1, (facing - 0.05) * 5)));
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.dispose();
      geo.dispose();
      textures.forEach((t) => t.dispose());
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={hostRef} className="earth-globe">
      <div ref={markersRef} className="earth-markers">
        {world.tippingPoints.map((id) => (
          <Marker key={id} id={id} />
        ))}
      </div>
    </div>
  );
}

function Marker({ id }: { id: TippingPointId }) {
  const { label, icon: Icon, lonLat } = TIPPING[id];
  return (
    <div className="earth-marker" data-lon={lonLat[0]} data-lat={lonLat[1]}>
      <span className="earth-marker-dot">
        <Icon size={26} strokeWidth={2.4} />
      </span>
      <span className="earth-marker-label">{label}</span>
    </div>
  );
}
