"use client";

// three.js engine for the 3D dashboard. Every record is one instance of a
// single cube mesh; arrange() sends each cube on a curved, staggered flight
// to its slot in the chosen shape while the camera glides to frame it.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { geoEquirectangular, geoGraticule, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature, mesh } from "topojson-client";
import {
  globeRadius,
  groupThings,
  hash01,
  layout,
  type Group,
  type Grouping,
  type Layout,
  type Shape,
  type Thing3D,
  type Universe3D,
} from "@/lib/three-d/universe";

export interface PickInfo {
  thing: Thing3D;
  group: Group;
  // Location summary on the globe, shown instead of the record itself.
  note?: { title: string; subtitle: string };
  x: number;
  y: number;
}

export interface UniverseHandle {
  arrange(dimId: string, shape: Shape): Grouping;
  highlightGroup(index: number | null): void;
  clearSelection(): void;
  resetView(): void;
  setAutoRotate(on: boolean): void;
  dispose(): void;
}

// ---------------------------------------------------------------- shaders

// Records: per-instance colour, a soft key light and fresnel rim. uRound
// morphs every cube into a sphere (globe and galaxy views), where it also
// glows. Hovering lights one record and its group and dims the rest; the
// selected record stays lit.
const CUBE_VERT = /* glsl */ `
  attribute float aGroup;
  uniform float uHoverId;
  uniform float uSelId;
  uniform float uHoverGroup;
  uniform float uRound;
  uniform float uTime;
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vHi;
  varying float vSel;
  varying float vDim;
  void main() {
    float id = float(gl_InstanceID);
    vSel = abs(id - uSelId) < 0.5 ? 1.0 : 0.0;
    vHi = abs(id - uHoverId) < 0.5 ? 1.0 : 0.0;
    vec3 sp = normalize(position) * 0.5;
    // Selected record swells and pulses; hovered one swells a little.
    float grow = 1.0 + vSel * (0.22 + 0.08 * sin(uTime * 4.0)) + vHi * (1.0 - vSel) * 0.12;
    vec3 p = mix(position, sp, uRound) * grow;
    vec3 nn = normalize(mix(normal, normalize(position), uRound));
    mat4 m = modelMatrix * instanceMatrix;
    vec4 w = m * vec4(p, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(m) * nn);
    vColor = instanceColor;
    bool groupOn = uHoverGroup >= 0.0;
    vDim = groupOn && abs(aGroup - uHoverGroup) > 0.5 ? 1.0 : 0.0;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const CUBE_FRAG = /* glsl */ `
  uniform float uRound;
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vHi;
  varying float vSel;
  varying float vDim;
  uniform float uTime;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 l = normalize(vec3(0.4, 1.0, 0.55));
    float diff = 0.5 + 0.5 * max(dot(n, l), 0.0);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
    vec3 col = vColor * diff * 0.9 + vColor * fres * 0.35;
    // Dots glow from the centre outwards.
    col = mix(col, vColor * (1.1 + fres * 0.9) + 0.04, uRound * 0.7);
    col *= mix(1.0, 0.15, vDim);
    // White-based highlights so every colour (pale grey and yellow included)
    // visibly changes: hover brightens, selection pulses towards white.
    col = mix(col, vec3(1.0), vHi * (1.0 - vSel) * 0.35);
    col = mix(col, vec3(1.0), vSel * (0.45 + 0.25 * sin(uTime * 4.0)));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  void main() {
    float y = normalize(vDir).y;
    vec3 top = vec3(0.012, 0.035, 0.075);
    vec3 mid = vec3(0.035, 0.09, 0.16);
    vec3 col = mix(mid, top, smoothstep(-0.05, 0.7, y));
    col = mix(col, vec3(0.004, 0.01, 0.025), smoothstep(0.0, -0.6, y));
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const FLOOR_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FLOOR_FRAG = /* glsl */ `
  uniform float uRadius;
  uniform float uFade;
  uniform float uCell;
  varying vec3 vWorld;
  float grid(vec2 p, float size) {
    vec2 g = abs(fract(p / size - 0.5) - 0.5) / fwidth(p / size);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    vec2 p = vWorld.xz;
    float d = length(p) / uRadius;
    float fade = smoothstep(1.0, 0.1, d) * uFade;
    float fine = grid(p, uCell) * 0.16;
    float coarse = grid(p, uCell * 5.0) * 0.4;
    vec3 col = vec3(0.16, 0.45, 0.8) * (fine + coarse);
    col += vec3(0.04, 0.1, 0.18) * smoothstep(0.7, 0.0, d) * 0.3;
    gl_FragColor = vec4(col, fade * 0.9);
  }
`;

const DUST_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixel;
  uniform float uScale;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.25 + aSeed * 6.2831) * uScale * 0.08;
    p.x += cos(uTime * 0.18 + aSeed * 12.0) * uScale * 0.05;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(6.0, uPixel * (1.5 + aSeed * 2.5) * (uScale * 0.6 / -mv.z));
    vAlpha = 0.25 + 0.5 * fract(aSeed * 7.0);
  }
`;

const DOT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.15, length(c));
    gl_FragColor = vec4(uColor * a * vAlpha * uFade, 1.0);
  }
`;

const NORMAL_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const CORE_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// Earth texture with a soft day-side light and a blue rim. The 0.25 offset
// lines the equirectangular map up with latLonToXYZ (Greenwich facing +Z).
const CORE_FRAG = /* glsl */ `
  uniform float uFade;
  uniform sampler2D uMap;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vec3 v = normalize(cameraPosition - vWorld);
    float f = max(dot(normalize(vN), v), 0.0);
    vec3 tex = texture(uMap, vec2(fract(vUv.x + 0.25), vUv.y)).rgb;
    vec3 col = tex * (0.35 + 0.75 * f) + vec3(0.05, 0.18, 0.35) * pow(1.0 - f, 3.0);
    gl_FragColor = vec4(col * uFade, uFade);
  }
`;

const ATMOS_FRAG = /* glsl */ `
  uniform float uFade;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vec3 v = normalize(cameraPosition - vWorld);
    // Back faces: dot runs from about -0.45 at the globe's edge to 0 at the
    // halo's rim, so the glow hugs the globe and fades outwards.
    float f = pow(clamp(-dot(normalize(vN), v) * 2.2, 0.0, 1.0), 2.2);
    gl_FragColor = vec4(vec3(0.24, 0.545, 1.0) * f * 1.4 * uFade, 1.0);
  }
`;

// ---------------------------------------------------------------- helpers

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const UP = new THREE.Vector3(0, 1, 0);

function labelEl(text: string, sub: string, colour?: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = colour === "" ? "sb3d-label sb3d-big" : "sb3d-label sb3d-group";
  if (colour) {
    const dot = document.createElement("span");
    dot.className = "sb3d-dot";
    dot.style.background = colour;
    dot.style.color = colour;
    el.appendChild(dot);
  }
  const t = document.createElement("span");
  t.textContent = text.length > 26 ? `${text.slice(0, 25)}…` : text;
  el.appendChild(t);
  if (sub) {
    const s = document.createElement("span");
    s.className = "sb3d-sub";
    s.textContent = sub;
    el.appendChild(s);
  }
  return el;
}

// ---------------------------------------------------------------- engine

export function createUniverse(
  container: HTMLElement,
  u: Universe3D,
  opts: { reducedMotion: boolean; onHover: (p: PickInfo | null) => void; onSelect: (p: PickInfo | null) => void },
): UniverseHandle {
  const N = u.things.length;
  const width = () => Math.max(1, container.clientWidth);
  const height = () => Math.max(1, container.clientHeight);
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.setSize(width(), height());
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);
  const pixel = renderer.getPixelRatio();

  const labels = new CSS2DRenderer();
  labels.setSize(width(), height());
  labels.domElement.style.position = "absolute";
  labels.domElement.style.inset = "0";
  labels.domElement.style.pointerEvents = "none";
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, width() / height(), 0.5, 8000);

  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(4000, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: SKY_FRAG,
      }),
    ),
  );

  // Floor.
  const floorMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uRadius: { value: 60 }, uFade: { value: 0 }, uCell: { value: 1.25 } },
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.renderOrder = -1;
  scene.add(floor);

  // Dust, scaled to the scene.
  const dustScale = Math.max(30, globeRadius(N) * 2.5);
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: pixel }, uScale: { value: dustScale }, uColor: { value: new THREE.Color("#6fb4ff") }, uFade: { value: 1 } },
    vertexShader: DUST_VERT,
    fragmentShader: DOT_FRAG,
  });
  {
    const n = 700;
    const p = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() - 0.5) * dustScale * 6;
      p[i * 3 + 1] = (Math.random() - 0.3) * dustScale * 2.5;
      p[i * 3 + 2] = (Math.random() - 0.5) * dustScale * 6;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    scene.add(new THREE.Points(g, dustMat));
  }

  // Globe backdrop, faded in only for the globe shape.
  const R = globeRadius(N);
  const globe = new THREE.Group();
  const globeFade = { value: 0 };
  const blank = new THREE.DataTexture(new Uint8Array([8, 34, 63, 255]), 1, 1);
  blank.needsUpdate = true;
  const coreMat = new THREE.ShaderMaterial({ transparent: true, uniforms: { uFade: globeFade, uMap: { value: blank } }, vertexShader: CORE_VERT, fragmentShader: CORE_FRAG });
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 72, 48), coreMat));
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.12, 72, 48),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uFade: globeFade },
        vertexShader: NORMAL_VERT,
        fragmentShader: ATMOS_FRAG,
      }),
    ),
  );
  globe.visible = false;
  scene.add(globe);
  // Earth map painted onto the sphere: ocean, land, country borders and a
  // 15-degree graticule, drawn once to an equirectangular canvas.
  let landLoaded = false;
  const loadLand = () => {
    if (landLoaded) return;
    landLoaded = true;
    import("world-atlas/countries-50m.json")
      .then((mod) => {
        type Topo = Parameters<typeof feature>[0] & { objects: { countries: Parameters<typeof feature>[1]; land: Parameters<typeof feature>[1] } };
        const topo = (mod.default ?? mod) as unknown as Topo;
        const countries = feature(topo, topo.objects.countries) as unknown as GeoPermissibleObjects;
        const borders = mesh(topo, topo.objects.countries as Parameters<typeof mesh>[1], (a, b) => a !== b) as unknown as GeoPermissibleObjects;
        // Sharper map on desktops; phones keep a lighter texture.
        const W = coarse ? 2048 : 4096;
        const H = W / 2;
        const cv = document.createElement("canvas");
        cv.width = W;
        cv.height = H;
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        const path = geoPath(geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]), ctx);
        ctx.fillStyle = "#08223f";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(95, 168, 255, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        path(geoGraticule().step([15, 15])());
        ctx.stroke();
        ctx.fillStyle = "#1f5e9c";
        ctx.beginPath();
        path(countries);
        ctx.fill();
        ctx.strokeStyle = "rgba(160, 205, 255, 0.55)";
        ctx.lineWidth = W / 1700;
        ctx.beginPath();
        path(borders);
        ctx.stroke();
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.wrapS = THREE.RepeatWrapping;
        coreMat.uniforms.uMap!.value = tex;
      })
      .catch(() => undefined);
  };


  // ---- the cubes
  const cubeMat = new THREE.ShaderMaterial({
    uniforms: { uHoverId: { value: -1 }, uSelId: { value: -1 }, uHoverGroup: { value: -1 }, uRound: { value: 0 }, uTime: { value: 0 } },
    vertexShader: CUBE_VERT,
    fragmentShader: CUBE_FRAG,
  });
  const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1, 3, 3, 3), cubeMat, Math.max(1, N));
  cubes.count = N;
  cubes.frustumCulled = false;
  cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const aGroup = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, N)), 1);
  cubes.geometry.setAttribute("aGroup", aGroup);
  scene.add(cubes);

  const cur = new Float32Array(N * 3);
  const from = new Float32Array(N * 3);
  const to = new Float32Array(N * 3);
  const qCur = new Float32Array(N * 4);
  const qFrom = new Float32Array(N * 4);
  const qTo = new Float32Array(N * 4);
  const cCur = new Float32Array(N * 3);
  const cFrom = new Float32Array(N * 3);
  const cTo = new Float32Array(N * 3);
  const delay = new Float32Array(N);
  const lift = new Float32Array(N);
  const axes: THREE.Vector3[] = [];

  // Start scattered in a wide shell, so the first arrangement flies in.
  const shell = Math.max(40, R * 3);
  u.things.forEach((t, i) => {
    const a = hash01(t.key, 21) * Math.PI * 2;
    const b = Math.acos(2 * hash01(t.key, 22) - 1);
    const r = shell * (0.7 + hash01(t.key, 23) * 0.6);
    cur[i * 3] = Math.sin(b) * Math.cos(a) * r;
    cur[i * 3 + 1] = Math.cos(b) * r * 0.6 + shell * 0.3;
    cur[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
    qCur[i * 4 + 3] = 1;
    cCur[i * 3] = 0.3;
    cCur[i * 3 + 1] = 0.5;
    cCur[i * 3 + 2] = 0.8;
    axes.push(new THREE.Vector3(hash01(t.key, 31) - 0.5, hash01(t.key, 32) - 0.5, hash01(t.key, 33) - 0.5).normalize());
  });
  const colour = new THREE.Color();
  for (let i = 0; i < N; i++) {
    colour.setRGB(cCur[i * 3] as number, cCur[i * 3 + 1] as number, cCur[i * 3 + 2] as number);
    cubes.setColorAt(i, colour);
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const qs = new THREE.Quaternion();
  const vp = new THREE.Vector3();
  const vs = new THREE.Vector3();
  const writeInstance = (i: number, scale: number) => {
    vp.set(cur[i * 3] as number, cur[i * 3 + 1] as number, cur[i * 3 + 2] as number);
    q.set(qCur[i * 4] as number, qCur[i * 4 + 1] as number, qCur[i * 4 + 2] as number, qCur[i * 4 + 3] as number);
    vs.setScalar(scale);
    m4.compose(vp, q, vs);
    cubes.setMatrixAt(i, m4);
  };
  // Per-record size: cubes sit slightly under their 1-unit slot (a hairline
  // gap); dots are smaller, and on the globe one dot per location grows
  // with its count while the rest shrink away inside it.
  const CUBE_SIZE = 0.92;
  const DOT_SIZE = 0.6;
  const sCur = new Float32Array(N).fill(CUBE_SIZE);
  const sFrom = new Float32Array(N);
  const sTo = new Float32Array(N);
  let roundTarget = 0;
  for (let i = 0; i < N; i++) writeInstance(i, CUBE_SIZE);

  // ---- galaxy: a live force-directed graph (like Obsidian's graph view).
  // Each group is a hub; every record is linked to its hub, hubs are linked
  // to a central node, records push each other apart and hubs repel.
  const galaxy = new THREE.Group();
  galaxy.visible = false;
  scene.add(galaxy);
  const linkGeo = new THREE.BufferGeometry();
  const linkPos = new Float32Array((N + 16) * 6);
  const linkCol = new Float32Array((N + 16) * 6);
  linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPos, 3).setUsage(THREE.DynamicDrawUsage));
  linkGeo.setAttribute("color", new THREE.BufferAttribute(linkCol, 3));
  const linkMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  galaxy.add(new THREE.LineSegments(linkGeo, linkMat));
  const hubMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hubs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 24, 16), hubMat, 17);
  hubs.frustumCulled = false;
  galaxy.add(hubs);
  const hubLabels = new THREE.Group();
  galaxy.add(hubLabels);
  interface Sim {
    alpha: number;
    vel: Float32Array;
    hub: Float32Array;
    hubVel: Float32Array;
    rest: Float32Array;
    mass: Float32Array;
    G: number;
    time: number;
  }
  // Each record's own spot in its group's cloud: a random direction (a
  // slightly flattened sphere, like a galaxy's disc), a random distance
  // that fills the cloud rather than a shell, and an orbit speed that is
  // faster near the hub. Fixed per record so the shape is stable.
  const gDir = new Float32Array(N * 3);
  const gDist = new Float32Array(N);
  const gSpin = new Float32Array(N);
  u.things.forEach((t, i) => {
    const a = hash01(t.key, 61) * Math.PI * 2;
    const b = Math.acos(2 * hash01(t.key, 62) - 1);
    gDir[i * 3] = Math.sin(b) * Math.cos(a);
    gDir[i * 3 + 1] = Math.cos(b) * 0.55;
    gDir[i * 3 + 2] = Math.sin(b) * Math.sin(a);
    const d = 0.18 + 0.9 * Math.cbrt(hash01(t.key, 63));
    gDist[i] = d;
    gSpin[i] = (0.12 + hash01(t.key, 64) * 0.06) / (0.4 + d);
  });
  let sim: Sim | null = null;
  let simClock = 0;
  const HT = 1 << 15;
  const head = new Int32Array(HT);
  const next = new Int32Array(Math.max(1, N));
  const CELL = 2.2;
  const cellKey = (x: number, y: number, z: number) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & (HT - 1);

  const startGalaxy = () => {
    const G = grouping.groups.length;
    const hub = new Float32Array((G + 1) * 3);
    const spreadR = 4 + Math.sqrt(N) * 0.5;
    grouping.groups.forEach((g, gi) => {
      const a = hash01(g.label, 51) * Math.PI * 2;
      const b = Math.acos(2 * hash01(g.label, 52) - 1);
      hub[gi * 3] = Math.sin(b) * Math.cos(a) * spreadR;
      hub[gi * 3 + 1] = Math.cos(b) * spreadR * 0.6;
      hub[gi * 3 + 2] = Math.sin(b) * Math.sin(a) * spreadR;
    });
    const vel = sim?.vel ?? new Float32Array(N * 3);
    // A random kick so records burst loose before settling.
    for (let i = 0; i < N * 3; i++) vel[i] = (vel[i] as number) + (Math.random() - 0.5) * 0.8;
    sim = {
      alpha: 1,
      vel,
      hub,
      hubVel: new Float32Array((G + 1) * 3),
      rest: Float32Array.from(grouping.groups, (g) => 2.5 + Math.cbrt(g.count) * 1.6),
      mass: Float32Array.from(grouping.groups, (g) => Math.sqrt(g.count)),
      G,
      time: 0,
    };
    // Settle the few hubs straight away; the records then visibly fall
    // into orbit around them.
    for (let it = 0; it < 400; it++) stepHubs(sim, 1, 1 / 60);
    sim.hubVel.fill(0);
    const cols = grouping.groups.map((g) => new THREE.Color(g.colour));
    for (let i = 0; i < N; i++) {
      const c = cols[grouping.groupOf[i] as number] as THREE.Color;
      for (let k = 0; k < 2; k++) {
        linkCol[i * 6 + k * 3] = c.r;
        linkCol[i * 6 + k * 3 + 1] = c.g;
        linkCol[i * 6 + k * 3 + 2] = c.b;
      }
    }
    grouping.groups.forEach((g, gi) => {
      const c = cols[gi] as THREE.Color;
      const o = (N + gi) * 6;
      linkCol.set([c.r, c.g, c.b, 0.6, 0.7, 0.85], o);
      hubs.setColorAt(gi, c.clone().multiplyScalar(1.6));
    });
    hubs.setColorAt(G, new THREE.Color(1.6, 1.6, 1.6));
    hubs.count = G + 1;
    if (hubs.instanceColor) hubs.instanceColor.needsUpdate = true;
    linkGeo.setDrawRange(0, (N + G) * 2);
    (linkGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    for (const o of [...hubLabels.children]) {
      if (o instanceof CSS2DObject) o.element.remove();
      hubLabels.remove(o);
    }
    grouping.groups.forEach((g) => {
      const o = new CSS2DObject(labelEl(g.label, g.count.toLocaleString("en-GB"), g.colour));
      o.center.set(0.5, 1.4);
      hubLabels.add(o);
    });
    const centre = new CSS2DObject(labelEl(N.toLocaleString("en-GB"), u.noun, ""));
    centre.center.set(0.5, 1.2);
    hubLabels.add(centre);
    galaxy.visible = true;
  };

  // Hubs: pulled to the centre, pushed apart from each other.
  const stepHubs = (s0: Sim, a: number, dt: number) => {
    const { hub, hubVel, rest, mass, G } = s0;
    for (let h = 0; h < G; h++) {
      // Heavier groups are pulled harder to the centre, so the biggest sit
      // in the middle and small ones drift to the edges, as in Obsidian.
      const pull = 0.02 * (1 + (mass[h] as number) / 12);
      let fx = -(hub[h * 3] as number) * pull;
      let fy = -(hub[h * 3 + 1] as number) * pull * 1.6;
      let fz = -(hub[h * 3 + 2] as number) * pull;
      for (let o = 0; o < G; o++) {
        if (o === h) continue;
        const dx = (hub[h * 3] as number) - (hub[o * 3] as number);
        const dy = (hub[h * 3 + 1] as number) - (hub[o * 3 + 1] as number);
        const dz = (hub[h * 3 + 2] as number) - (hub[o * 3 + 2] as number);
        const d2 = Math.max(4, dx * dx + dy * dy + dz * dz);
        const want = (rest[h] as number) + (rest[o] as number);
        const f = Math.min(0.5, (want * want * 0.06) / d2);
        fx += dx * f;
        fy += dy * f;
        fz += dz * f;
      }
      for (let k = 0; k < 3; k++) {
        const v = Math.max(-0.8, Math.min(0.8, ((hubVel[h * 3 + k] as number) + [fx, fy, fz][k]! * a * dt * 60) * 0.85));
        hubVel[h * 3 + k] = v;
        hub[h * 3 + k] = (hub[h * 3 + k] as number) + v;
      }
    }
  };

  const stepGalaxy = (dt: number) => {
    if (!sim) return;
    const { vel, hub, rest, G } = sim;
    const a = sim.alpha;
    sim.time += opts.reducedMotion ? 0 : dt;
    const time = sim.time;
    stepHubs(sim, a, dt);
    // Spatial hash so each record only repels its near neighbours.
    head.fill(-1);
    for (let i = 0; i < N; i++) {
      const c = cellKey(Math.floor((cur[i * 3] as number) / CELL), Math.floor((cur[i * 3 + 1] as number) / CELL), Math.floor((cur[i * 3 + 2] as number) / CELL));
      next[i] = head[c] as number;
      head[c] = i;
    }
    // The pull to each spot always acts (so clouds keep turning); alpha
    // only adds the extra energy of the opening burst.
    const step = (0.5 + 0.5 * a) * dt * 60;
    for (let i = 0; i < N; i++) {
      const px = cur[i * 3] as number;
      const py = cur[i * 3 + 1] as number;
      const pz = cur[i * 3 + 2] as number;
      const gi = grouping.groupOf[i] as number;
      // Spring towards this record's own orbiting spot in its group's cloud.
      const r = (rest[gi] as number) * (gDist[i] as number);
      const th = time * (gSpin[i] as number);
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const dx0 = gDir[i * 3] as number;
      const dz0 = gDir[i * 3 + 2] as number;
      const tx = (hub[gi * 3] as number) + (dx0 * c - dz0 * sn) * r;
      const ty = (hub[gi * 3 + 1] as number) + (gDir[i * 3 + 1] as number) * r;
      const tz = (hub[gi * 3 + 2] as number) + (dx0 * sn + dz0 * c) * r;
      let fx = (tx - px) * 0.035;
      let fy = (ty - py) * 0.035;
      let fz = (tz - pz) * 0.035;
      const cx = Math.floor(px / CELL);
      const cy = Math.floor(py / CELL);
      const cz = Math.floor(pz / CELL);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++)
          for (let oz = -1; oz <= 1; oz++) {
            for (let j = head[cellKey(cx + ox, cy + oy, cz + oz)] as number; j >= 0; j = next[j] as number) {
              if (j === i) continue;
              const dx = px - (cur[j * 3] as number);
              const dy = py - (cur[j * 3 + 1] as number);
              const dz = pz - (cur[j * 3 + 2] as number);
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 > CELL * CELL || d2 < 1e-6) continue;
              const f = 0.06 / d2;
              fx += dx * f;
              fy += dy * f;
              fz += dz * f;
            }
          }
      let vx = ((vel[i * 3] as number) + fx * step) * 0.8;
      let vy = ((vel[i * 3 + 1] as number) + fy * step) * 0.8;
      let vz = ((vel[i * 3 + 2] as number) + fz * step) * 0.8;
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (sp > 1.2) {
        vx *= 1.2 / sp;
        vy *= 1.2 / sp;
        vz *= 1.2 / sp;
      }
      vel[i * 3] = vx;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = vz;
      cur[i * 3] = px + vx;
      cur[i * 3 + 1] = py + vy;
      cur[i * 3 + 2] = pz + vz;
      linkPos.set([cur[i * 3] as number, cur[i * 3 + 1] as number, cur[i * 3 + 2] as number, hub[gi * 3] as number, hub[gi * 3 + 1] as number, hub[gi * 3 + 2] as number], i * 6);
    }
    // Cool down, but never fully freeze, so the graph keeps breathing.
    sim.alpha = Math.max(0, sim.alpha * Math.pow(0.99, dt * 60));
    for (let h = 0; h < G; h++) {
      const o = (N + h) * 6;
      linkPos.set([hub[h * 3] as number, hub[h * 3 + 1] as number, hub[h * 3 + 2] as number, 0, 0, 0], o);
      vp.set(hub[h * 3] as number, hub[h * 3 + 1] as number, hub[h * 3 + 2] as number);
      const g = grouping.groups[h] as Group;
      vs.setScalar(1.2 + Math.sqrt(g.count) * 0.12);
      m4.compose(vp, q.identity(), vs);
      hubs.setMatrixAt(h, m4);
      hubLabels.children[h]?.position.copy(vp);
    }
    vs.setScalar(1.8);
    m4.compose(vp.set(0, 0, 0), q.identity(), vs);
    hubs.setMatrixAt(G, m4);
    hubLabels.children[G]?.position.set(0, 0, 0);
    hubs.instanceMatrix.needsUpdate = true;
    (linkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  };

  // ---- post-processing, controls
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixel);
  composer.setSize(width(), height());
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width(), height()), 0.32, 0.35, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.zoomToCursor = true;
  let wantSpin = !opts.reducedMotion;
  controls.autoRotateSpeed = 0.5;
  camera.position.set(0, shell * 0.8, shell * 2);

  // Camera glide between framings.
  const camAnim = { active: false, t0: 0, dur: 1800, fromT: new THREE.Vector3(), toT: new THREE.Vector3(), fromP: new THREE.Vector3(), toP: new THREE.Vector3() };
  let framing = { centre: new THREE.Vector3(), dir: new THREE.Vector3(0, 0.4, 1), dist: 50, radius: 20, floor: true };
  const frame = (instant: boolean) => {
    // Fit the framing radius inside the narrower of the two fields of view,
    // so portrait phones back off far enough to see the whole width.
    const vf = (camera.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * (width() / height()));
    const dist = (framing.radius * (hf < vf ? 1.08 : 0.9)) / Math.tan(Math.min(vf, hf) / 2);
    framing.dist = dist;
    const toP = framing.centre.clone().addScaledVector(framing.dir.clone().normalize(), dist);
    controls.minDistance = framing.radius * 0.15;
    controls.maxDistance = framing.radius * 6;
    controls.maxPolarAngle = framing.floor ? Math.PI * 0.495 : Math.PI;
    if (instant || opts.reducedMotion) {
      camera.position.copy(toP);
      controls.target.copy(framing.centre);
      camAnim.active = false;
      return;
    }
    camAnim.fromT.copy(controls.target);
    camAnim.toT.copy(framing.centre);
    camAnim.fromP.copy(camera.position);
    camAnim.toP.copy(toP);
    camAnim.t0 = performance.now();
    camAnim.active = true;
  };
  const onStart = () => {
    camAnim.active = false;
    controls.autoRotate = false;
  };
  controls.addEventListener("start", onStart);

  // ---- labels
  const labelGroup = new THREE.Group();
  scene.add(labelGroup);
  let labelTimer: ReturnType<typeof setTimeout> | undefined;
  const clearLabels = () => {
    for (const o of [...labelGroup.children]) {
      if (o instanceof CSS2DObject) o.element.remove();
      labelGroup.remove(o);
    }
  };

  // ---- arrange
  let grouping: Grouping = groupThings(u.things, u.dims[0]?.id ?? "");
  let anim = { active: false, t0: 0, dur: opts.reducedMotion ? 1 : 1500, span: 0 };
  let floorTarget = 0;
  let globeTarget = 0;
  let galaxyTarget = 0;
  let notes: Layout["notes"] = null;
  let legendGroup = -1;

  const arrange = (dimId: string, shape: Shape): Grouping => {
    grouping = groupThings(u.things, dimId);
    const lay = layout(shape, u, grouping);
    roundTarget = lay.dots ? 1 : 0;
    sFrom.set(sCur);
    for (let i = 0; i < N; i++) sTo[i] = lay.sizes ? (lay.sizes[i] as number) : lay.dots ? DOT_SIZE : CUBE_SIZE;
    notes = lay.notes;
    if (shape === "galaxy") startGalaxy();
    else {
      sim = null;
      hubs.count = 0;
      for (const o of [...hubLabels.children]) {
        if (o instanceof CSS2DObject) o.element.remove();
        hubLabels.remove(o);
      }
    }
    legendGroup = -1;
    cubeMat.uniforms.uHoverGroup!.value = -1;
    from.set(cur);
    qFrom.set(qCur);
    cFrom.set(cCur);
    to.set(lay.pos);
    const groupColours = grouping.groups.map((g) => new THREE.Color(g.colour));
    const maxDelay = opts.reducedMotion ? 0 : Math.min(1, 0.5 + N / 20000);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < N; i++) {
      minX = Math.min(minX, to[i * 3] as number);
      maxX = Math.max(maxX, to[i * 3] as number);
    }
    for (let i = 0; i < N; i++) {
      const gi = grouping.groupOf[i] as number;
      aGroup.setX(i, gi);
      const c = groupColours[gi] as THREE.Color;
      cTo[i * 3] = c.r;
      cTo[i * 3 + 1] = c.g;
      cTo[i * 3 + 2] = c.b;
      if (lay.up) {
        vp.set(lay.up[i * 3] as number, lay.up[i * 3 + 1] as number, lay.up[i * 3 + 2] as number);
        if (vp.lengthSq() < 1e-6) vp.copy(UP);
        q.setFromUnitVectors(UP, vp.normalize());
      } else q.identity();
      qTo[i * 4] = q.x;
      qTo[i * 4 + 1] = q.y;
      qTo[i * 4 + 2] = q.z;
      qTo[i * 4 + 3] = q.w;
      // Lower cubes leave first so stacks build from the ground up.
      const key = (u.things[i] as Thing3D).key;
      const heightRank = Math.min(1, Math.max(0, (to[i * 3 + 1] as number) / Math.max(1, lay.radius)));
      // A wave sweeping left to right across the new shape, lower slots
      // first, with a little jitter so it feels organic.
      const sweep = Math.min(1, Math.max(0, ((to[i * 3] as number) - minX) / Math.max(1e-6, maxX - minX)));
      delay[i] = (sweep * 0.6 + heightRank * 0.25 + hash01(key, 41) * 0.15) * maxDelay * 1000;
      const dist = Math.hypot((to[i * 3] as number) - (from[i * 3] as number), (to[i * 3 + 1] as number) - (from[i * 3 + 1] as number), (to[i * 3 + 2] as number) - (from[i * 3 + 2] as number));
      lift[i] = Math.min(lay.radius * 0.25, dist * 0.3) * (0.6 + hash01(key, 42) * 0.4);
    }
    aGroup.needsUpdate = true;
    anim = { active: true, t0: performance.now(), dur: opts.reducedMotion ? 1 : 1800, span: maxDelay * 1000 };
    floorTarget = lay.floor ? 1 : 0;
    galaxyTarget = shape === "galaxy" ? 1 : 0;
    globeTarget = shape === "globe" ? 1 : 0;
    if (shape === "globe") {
      globe.visible = true;
      loadLand();
    }
    floorMat.uniforms.uRadius!.value = lay.radius * 2.6;
    framing = {
      centre: new THREE.Vector3(...lay.centre),
      dir: new THREE.Vector3(...lay.camDir),
      dist: framing.dist,
      radius: lay.radius,
      floor: lay.floor,
    };
    if (sim) {
      // Frame the graph as it will settle: the furthest hub plus its cloud.
      let ext = 6;
      for (let h = 0; h < sim.G; h++) {
        const d = Math.hypot(sim.hub[h * 3] as number, sim.hub[h * 3 + 1] as number, sim.hub[h * 3 + 2] as number);
        ext = Math.max(ext, d + (sim.rest[h] as number) * 1.3);
      }
      framing.radius = ext;
      framing.centre.set(0, 0, 0);
    }
    frame(false);
    controls.autoRotate = wantSpin && lay.spin;
    cubeMat.uniforms.uHoverId!.value = -1;
    cubeMat.uniforms.uSelId!.value = -1;
    opts.onHover(null);

    clearLabels();
    if (labelTimer) clearTimeout(labelTimer);
    for (const l of lay.labels) {
      const el = labelEl(l.text, l.sub, l.colour);
      el.style.opacity = "0";
      const o = new CSS2DObject(el);
      o.position.set(l.x, l.y, l.z);
      o.center.set(0.5, 1);
      labelGroup.add(o);
    }
    labelTimer = setTimeout(
      () => {
        for (const o of labelGroup.children) if (o instanceof CSS2DObject) o.element.style.opacity = "1";
      },
      opts.reducedMotion ? 0 : anim.dur * 0.8 + anim.span,
    );
    return grouping;
  };

  // ---- picking
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let lastPick = 0;
  const pickAt = (ev: PointerEvent): PickInfo | null => {
    if (anim.active && !sim) return null;
    if (sim) cubes.computeBoundingSphere();
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(cubes, false)[0];
    const id = hit?.instanceId ?? -1;
    cubeMat.uniforms.uHoverId!.value = id;
    renderer.domElement.style.cursor = id >= 0 ? "pointer" : "grab";
    if (id < 0) return null;
    const thing = u.things[id] as Thing3D;
    const group = grouping.groups[grouping.groupOf[id] as number] as Group;
    const note = notes?.[id];
    return { thing, group, ...(note ? { note } : {}), x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  let downAt: { x: number; y: number } | null = null;
  const onMove = (ev: PointerEvent) => {
    if (ev.pointerType !== "mouse" || downAt) return;
    const now = performance.now();
    if (now - lastPick < 70) return;
    lastPick = now;
    const hit = pickAt(ev);
    if (sim) cubeMat.uniforms.uHoverGroup!.value = hit ? (grouping.groupOf[u.things.indexOf(hit.thing)] as number) : legendGroup;
    opts.onHover(hit);
  };
  const onDown = (ev: PointerEvent) => {
    downAt = { x: ev.clientX, y: ev.clientY };
  };
  const onUp = (ev: PointerEvent) => {
    if (downAt && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < 6) {
      const hit = pickAt(ev);
      cubeMat.uniforms.uSelId!.value = hit ? u.things.indexOf(hit.thing) : -1;
      opts.onSelect(hit);
    }
    downAt = null;
  };
  const onLeave = () => {
    if (downAt) return;
    cubeMat.uniforms.uHoverId!.value = -1;
    opts.onHover(null);
  };
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointerleave", onLeave);
  renderer.domElement.style.cursor = "grab";

  const ro = new ResizeObserver(() => {
    camera.aspect = width() / height();
    camera.updateProjectionMatrix();
    renderer.setSize(width(), height());
    composer.setSize(width(), height());
    labels.setSize(width(), height());
  });
  ro.observe(container);

  // Adaptive quality: drop to 1x pixels, then bloom off, if frames are slow.
  let last = performance.now();
  let slowSum = 0;
  let slowN = 0;
  let quality = 2;
  const adapt = (now: number) => {
    slowSum += now - last;
    slowN += 1;
    last = now;
    if (slowN < 45 || quality === 0) return;
    const avg = slowSum / slowN;
    slowSum = 0;
    slowN = 0;
    if (avg < 34) return;
    quality -= 1;
    if (quality === 1) {
      renderer.setPixelRatio(1);
      composer.setPixelRatio(1);
      composer.setSize(width(), height());
    } else bloom.enabled = false;
  };

  // ---- loop
  const start = performance.now();
  let lastTick = start;
  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    adapt(now);
    dustMat.uniforms.uTime!.value = opts.reducedMotion ? 0 : (now - start) / 1000;

    if (anim.active) {
      let done = true;
      for (let i = 0; i < N; i++) {
        const raw = (now - anim.t0 - (delay[i] as number)) / anim.dur;
        const t = raw <= 0 ? 0 : raw >= 1 ? 1 : raw;
        if (t < 1) done = false;
        const e = ease(t);
        const arc = Math.sin(Math.PI * e);
        if (!sim) {
          // Straight, eased flight from the old slot to the new one, lifted
          // in a low arc so cubes pass over the stacks instead of through.
          const fx = from[i * 3] as number;
          const fy = from[i * 3 + 1] as number;
          const fz = from[i * 3 + 2] as number;
          cur[i * 3] = fx + ((to[i * 3] as number) - fx) * e;
          cur[i * 3 + 1] = fy + ((to[i * 3 + 1] as number) - fy) * e + arc * (lift[i] as number);
          cur[i * 3 + 2] = fz + ((to[i * 3 + 2] as number) - fz) * e;
        }
        q.set(qFrom[i * 4] as number, qFrom[i * 4 + 1] as number, qFrom[i * 4 + 2] as number, qFrom[i * 4 + 3] as number);
        q2.set(qTo[i * 4] as number, qTo[i * 4 + 1] as number, qTo[i * 4 + 2] as number, qTo[i * 4 + 3] as number);
        q.slerp(q2, e);
        if (arc > 0.001) {
          // A slight wobble in flight; level again on landing.
          qs.setFromAxisAngle(axes[i] as THREE.Vector3, arc * 0.6);
          q.multiply(qs);
        }
        qCur[i * 4] = q.x;
        qCur[i * 4 + 1] = q.y;
        qCur[i * 4 + 2] = q.z;
        qCur[i * 4 + 3] = q.w;
        for (let k = 0; k < 3; k++) {
          const f = cFrom[i * 3 + k] as number;
          cCur[i * 3 + k] = f + ((cTo[i * 3 + k] as number) - f) * e;
        }
        colour.setRGB(cCur[i * 3] as number, cCur[i * 3 + 1] as number, cCur[i * 3 + 2] as number);
        cubes.setColorAt(i, colour);
        const sf = sFrom[i] as number;
        sCur[i] = sf + ((sTo[i] as number) - sf) * e;
        writeInstance(i, (sCur[i] as number) * (1 - arc * 0.15));
      }
      cubes.instanceMatrix.needsUpdate = true;
      if (cubes.instanceColor) cubes.instanceColor.needsUpdate = true;
      if (done) {
        anim.active = false;
        cubes.computeBoundingSphere();
      }
    }

    const dt = Math.min(0.05, (now - lastTick) / 1000);
    // Ease the cube-to-dot morph towards the current view's.
    const kk = 1 - Math.exp(-dt * 3);
    const ru = cubeMat.uniforms.uRound as { value: number };
    ru.value += (roundTarget - ru.value) * kk;
    (cubeMat.uniforms.uTime as { value: number }).value = (now - start) / 1000;
    if (sim) {
      // Fixed 60 Hz steps so the graph settles in real time on any device.
      simClock += dt;
      let steps = 0;
      const maxSteps = N > 6000 ? 2 : 4;
      while (simClock >= 1 / 60 && steps < maxSteps) {
        stepGalaxy(1 / 60);
        simClock -= 1 / 60;
        steps++;
      }
      if (steps === maxSteps) simClock = 0;
      if (!anim.active) {
        for (let i = 0; i < N; i++) writeInstance(i, sCur[i] as number);
        cubes.instanceMatrix.needsUpdate = true;
      }
    }
    linkMat.opacity += (galaxyTarget * 0.22 - linkMat.opacity) * kk;
    if (!sim && linkMat.opacity < 0.01) galaxy.visible = false;

    if (camAnim.active) {
      const t = Math.min(1, (now - camAnim.t0) / camAnim.dur);
      const e = ease(t);
      controls.target.lerpVectors(camAnim.fromT, camAnim.toT, e);
      camera.position.lerpVectors(camAnim.fromP, camAnim.toP, e);
      if (t >= 1) camAnim.active = false;
    }

    // Time-based fades so they finish at the same pace on any frame rate.
    const k = 1 - Math.exp(-Math.min(0.25, (now - lastTick) / 1000) * 3.5);
    lastTick = now;
    const fu = floorMat.uniforms.uFade as { value: number };
    fu.value += (floorTarget - fu.value) * k;
    globeFade.value += (globeTarget - globeFade.value) * k;
    if (globeTarget === 0 && globeFade.value < 0.01) globe.visible = false;

    controls.update();
    composer.render();
    labels.render(scene, camera);
  };
  tick();

  return {
    arrange,
    highlightGroup(index) {
      legendGroup = index ?? -1;
      cubeMat.uniforms.uHoverGroup!.value = legendGroup;
    },
    clearSelection() {
      cubeMat.uniforms.uSelId!.value = -1;
    },
    resetView() {
      frame(false);
    },
    setAutoRotate(on) {
      wantSpin = on;
      controls.autoRotate = on;
    },
    dispose() {
      cancelAnimationFrame(raf);
      if (labelTimer) clearTimeout(labelTimer);
      ro.disconnect();
      controls.removeEventListener("start", onStart);
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      clearLabels();
      for (const o of hubLabels.children) if (o instanceof CSS2DObject) o.element.remove();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      cubes.dispose();
      hubs.dispose();
      bloom.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}
