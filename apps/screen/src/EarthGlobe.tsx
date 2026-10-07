// Realistic spinning Earth (three.js) whose look follows the world state:
// sea ice melts with temperature, forests brown as they disappear, the
// atmosphere glow turns from blue to orange. Textures: NASA Blue Marble
// (public domain), bundled so the game works offline.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { TippingPointId, World } from '@jdlt/shared';
import dayUrl from './assets/earth_day.jpg';
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
  };
}

const surfaceVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const surfaceFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform vec3 uSun;
  uniform float uWarm;
  uniform float uForestLoss;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    vec3 col = texture2D(uDay, vUv).rgb;
    float lat = (vUv.y - 0.5) * 180.0;
    float lon = (vUv.x - 0.5) * 360.0;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float minc = min(col.r, min(col.g, col.b));
    float isIce = smoothstep(0.5, 0.75, minc);
    float isWater = smoothstep(0.02, 0.1, col.b - max(col.r, col.g));
    vec3 ocean = vec3(0.02, 0.06, 0.22);

    // Sea ice retreats poleward as it warms (ragged edge from noise).
    // Greenland and the Antarctic continent are land ice and stay.
    float melt = smoothstep(0.2, 0.85, uWarm);
    float edge = noise(vec2(lon, lat) * 0.18) * 6.0;
    float greenland = step(-75.0, lon) * step(lon, -10.0) * step(59.0, lat);
    float arcticLimit = mix(62.0, 90.0, melt) + edge;
    float arcticSea = isIce * step(55.0, lat) * (1.0 - greenland) * (1.0 - smoothstep(arcticLimit - 3.0, arcticLimit + 3.0, lat));
    float antarcticLimit = mix(-56.0, -68.0, melt) - edge;
    float antarcticSea = isIce * step(lat, -50.0) * step(-70.0, lat) * smoothstep(antarcticLimit - 3.0, antarcticLimit + 3.0, lat);
    col = mix(col, ocean, clamp(arcticSea + antarcticSea, 0.0, 1.0));

    // Vegetation browns with deforestation (tropics first) and heat.
    float green = col.g - max(col.r, col.b);
    float veg = smoothstep(0.0, 0.05, green) * (1.0 - isWater);
    float tropics = 1.0 - smoothstep(20.0, 40.0, abs(lat));
    float brown = clamp(uForestLoss * (0.7 + 0.6 * tropics) + uWarm * 0.3, 0.0, 0.9);
    vec3 dry = vec3(0.50, 0.38, 0.22) * (0.6 + lum);
    col = mix(col, dry, veg * brown);

    // Bare land and deserts redden; oceans turn slightly murkier.
    float land = (1.0 - isWater) * (1.0 - isIce);
    col = mix(col, col * vec3(1.15, 0.88, 0.7), land * uWarm * 0.6);
    col = mix(col, col * vec3(1.0, 1.15, 0.85), isWater * uWarm * 0.4);

    // Lighting: soft terminator, sun glint on water.
    vec3 n = normalize(vNormal);
    float d = dot(n, uSun);
    float light = 0.16 + 0.95 * smoothstep(-0.15, 0.55, d);
    vec3 h = normalize(uSun + vView);
    float spec = pow(max(dot(n, h), 0.0), 90.0) * 0.3 * isWater * step(0.0, d);
    // Thin atmospheric haze towards the limb.
    float limb = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 3.0);
    vec3 haze = mix(vec3(0.35, 0.65, 1.0), vec3(1.0, 0.5, 0.25), smoothstep(0.15, 0.9, uWarm));
    gl_FragColor = vec4(col * light + spec * vec3(1.0, 0.95, 0.85) + haze * limb * 0.55 * light, 1.0);
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
    a = smoothstep(0.15, 0.9, a) * 0.85;
    float d = dot(normalize(vNormal), uSun);
    float light = 0.12 + 0.95 * smoothstep(-0.15, 0.55, d);
    // Hazier, warmer-tinted sky as it heats up.
    vec3 c = mix(vec3(1.0), vec3(1.0, 0.86, 0.74), uWarm * 0.7);
    gl_FragColor = vec4(c * light, a);
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform float uWarm;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Back faces of a slightly larger sphere: brightest just outside the
    // Earth's limb, fading to nothing at the outer edge.
    float d = abs(dot(normalize(vNormal), normalize(vView)));
    float i = pow(smoothstep(0.0, 0.42, d), 2.5);
    vec3 cool = vec3(0.35, 0.68, 1.0);
    vec3 hot = vec3(1.0, 0.45, 0.18);
    gl_FragColor = vec4(mix(cool, hot, smoothstep(0.15, 0.9, uWarm)), i * 0.75);
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
    const sun = new THREE.Vector3(-0.55, 0.35, 0.75).normalize();

    const loader = new THREE.TextureLoader();
    const day = loader.load(dayUrl);
    const clouds = loader.load(cloudsUrl);
    for (const t of [day, clouds]) {
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.colorSpace = THREE.NoColorSpace;
    }

    const now = targets(worldRef.current);
    const uniforms = {
      uDay: { value: day },
      uClouds: { value: clouds },
      uSun: { value: sun },
      uWarm: { value: now.warm },
      uForestLoss: { value: now.forestLoss },
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

      // Ease shader inputs towards the current world state.
      const target = targets(worldRef.current);
      const k = 1 - Math.exp(-dt / EASE_S);
      uniforms.uWarm.value += (target.warm - uniforms.uWarm.value) * k;
      uniforms.uForestLoss.value += (target.forestLoss - uniforms.uForestLoss.value) * k;

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
      day.dispose();
      clouds.dispose();
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
