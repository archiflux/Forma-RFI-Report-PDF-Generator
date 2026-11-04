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
import { geoEquirectangular, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import {
  globeRadius,
  groupThings,
  hash01,
  latLonToXYZ,
  layout,
  type Group,
  type Grouping,
  type Shape,
  type Thing3D,
  type Universe3D,
} from "@/lib/three-d/universe";

export interface PickInfo {
  thing: Thing3D;
  group: Group;
  x: number;
  y: number;
}

export interface UniverseHandle {
  arrange(dimId: string, shape: Shape): Grouping;
  highlightGroup(index: number | null): void;
  resetView(): void;
  setAutoRotate(on: boolean): void;
  dispose(): void;
}

// ---------------------------------------------------------------- shaders

// Glassy bricks: per-instance colour, soft key light, fresnel rim and lit
// edges that the bloom pass turns into a glow. Hovering lights one cube and
// its group and dims the rest.
const CUBE_VERT = /* glsl */ `
  attribute float aGroup;
  uniform float uHoverId;
  uniform float uHoverGroup;
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying float vHi;
  varying float vDim;
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 w = m * vec4(position, 1.0);
    vWorld = w.xyz;
    vLocal = position;
    vN = normalize(mat3(m) * normal);
    vColor = instanceColor;
    bool groupOn = uHoverGroup >= 0.0;
    vDim = groupOn && abs(aGroup - uHoverGroup) > 0.5 ? 1.0 : 0.0;
    vHi = abs(float(gl_InstanceID) - uHoverId) < 0.5 ? 1.0 : 0.0;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const CUBE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying float vHi;
  varying float vDim;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 l = normalize(vec3(0.4, 1.0, 0.55));
    float diff = 0.45 + 0.55 * max(dot(n, l), 0.0);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
    vec3 a = abs(vLocal) * 2.0;
    vec3 e = smoothstep(0.78, 0.97, a);
    float edge = clamp(e.x * e.y + e.y * e.z + e.x * e.z, 0.0, 1.0);
    vec3 col = vColor * diff * 0.85;
    col += vColor * fres * 0.45;
    col += (vColor * 0.55 + 0.06) * edge;
    col += (vColor * 0.8 + 0.35) * vHi;
    col *= mix(1.0, 0.18, vDim);
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

const LAND_VERT = /* glsl */ `
  uniform float uPixel;
  uniform float uSize;
  varying float vAlpha;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(w.xyz);
    float facing = dot(n, normalize(cameraPosition));
    vAlpha = smoothstep(-0.2, 0.6, facing) * 0.9 + 0.1;
    vec4 mv = viewMatrix * w;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPixel * uSize / -mv.z;
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

const CORE_FRAG = /* glsl */ `
  uniform float uFade;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vec3 v = normalize(cameraPosition - vWorld);
    float f = max(dot(normalize(vN), v), 0.0);
    vec3 col = vec3(0.043, 0.153, 0.278) * (0.25 + 0.75 * f) + vec3(0.05, 0.18, 0.35) * pow(1.0 - f, 3.0);
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
  const coreMat = new THREE.ShaderMaterial({ transparent: true, uniforms: { uFade: globeFade }, vertexShader: NORMAL_VERT, fragmentShader: CORE_FRAG });
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
  let landLoaded = false;
  const loadLand = () => {
    if (landLoaded) return;
    landLoaded = true;
    import("world-atlas/land-110m.json")
      .then((mod) => {
        const topo = (mod.default ?? mod) as unknown as Parameters<typeof feature>[0] & { objects: { land: Parameters<typeof feature>[1] } };
        const land = feature(topo, topo.objects.land) as unknown as GeoPermissibleObjects;
        // Rasterise once to an equirectangular mask; a pixel test per dot is
        // far faster than spherical point-in-polygon.
        const MW = 1024;
        const MH = 512;
        const cv = document.createElement("canvas");
        cv.width = MW;
        cv.height = MH;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        geoPath(geoEquirectangular().scale(MW / (2 * Math.PI)).translate([MW / 2, MH / 2]), ctx)(land);
        ctx.fill();
        const mask = ctx.getImageData(0, 0, MW, MH).data;
        const pts: number[] = [];
        const M = 16000;
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < M; i++) {
          const lat = (Math.asin(1 - (i / (M - 1)) * 2) * 180) / Math.PI;
          const lon = (((((i * golden * 180) / Math.PI) % 360) + 540) % 360) - 180;
          const px = Math.min(MW - 1, Math.floor(((lon + 180) / 360) * MW));
          const py = Math.min(MH - 1, Math.floor(((90 - lat) / 180) * MH));
          if ((mask[(py * MW + px) * 4 + 3] ?? 0) > 0) pts.push(...latLonToXYZ(lat, lon, R * 1.002));
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        globe.add(
          new THREE.Points(
            g,
            new THREE.ShaderMaterial({
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
              uniforms: { uPixel: { value: pixel }, uSize: { value: R * 7 }, uColor: { value: new THREE.Color("#5fa8ff") }, uFade: globeFade },
              vertexShader: LAND_VERT,
              fragmentShader: DOT_FRAG,
            }),
          ),
        );
      })
      .catch(() => undefined);
  };

  // ---- the cubes
  const cubeMat = new THREE.ShaderMaterial({
    uniforms: { uHoverId: { value: -1 }, uHoverGroup: { value: -1 } },
    vertexShader: CUBE_VERT,
    fragmentShader: CUBE_FRAG,
  });
  const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cubeMat, Math.max(1, N));
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
  for (let i = 0; i < N; i++) writeInstance(i, 1);

  // ---- post-processing, controls
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixel);
  composer.setSize(width(), height());
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width(), height()), 0.6, 0.45, 0.72);
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

  const arrange = (dimId: string, shape: Shape): Grouping => {
    grouping = groupThings(u.things, dimId);
    const lay = layout(shape, u, grouping);
    from.set(cur);
    qFrom.set(qCur);
    cFrom.set(cCur);
    to.set(lay.pos);
    const groupColours = grouping.groups.map((g) => new THREE.Color(g.colour));
    const maxDelay = opts.reducedMotion ? 0 : Math.min(0.9, 0.35 + N / 20000);
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
      delay[i] = (hash01(key, 41) * 0.55 + heightRank * 0.45) * maxDelay * 1000;
      lift[i] = (0.15 + hash01(key, 42) * 0.35) * lay.radius;
    }
    aGroup.needsUpdate = true;
    anim = { active: true, t0: performance.now(), dur: opts.reducedMotion ? 1 : 1500, span: maxDelay * 1000 };
    floorTarget = lay.floor ? 1 : 0;
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
    frame(false);
    controls.autoRotate = wantSpin && lay.spin;
    cubeMat.uniforms.uHoverId!.value = -1;
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
    if (anim.active) return null;
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
    return { thing, group, x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  let downAt: { x: number; y: number } | null = null;
  const onMove = (ev: PointerEvent) => {
    if (ev.pointerType !== "mouse" || downAt) return;
    const now = performance.now();
    if (now - lastPick < 70) return;
    lastPick = now;
    opts.onHover(pickAt(ev));
  };
  const onDown = (ev: PointerEvent) => {
    downAt = { x: ev.clientX, y: ev.clientY };
  };
  const onUp = (ev: PointerEvent) => {
    if (downAt && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < 6) opts.onSelect(pickAt(ev));
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
        const fx = from[i * 3] as number;
        const fy = from[i * 3 + 1] as number;
        const fz = from[i * 3 + 2] as number;
        let x = fx + ((to[i * 3] as number) - fx) * e;
        const y = fy + ((to[i * 3 + 1] as number) - fy) * e + arc * (lift[i] as number);
        let z = fz + ((to[i * 3 + 2] as number) - fz) * e;
        // A gentle swirl about the vertical axis while in flight.
        const sw = arc * 0.5;
        const cs = Math.cos(sw);
        const sn = Math.sin(sw);
        const rx = x * cs - z * sn;
        z = x * sn + z * cs;
        x = rx;
        cur[i * 3] = x;
        cur[i * 3 + 1] = y;
        cur[i * 3 + 2] = z;
        q.set(qFrom[i * 4] as number, qFrom[i * 4 + 1] as number, qFrom[i * 4 + 2] as number, qFrom[i * 4 + 3] as number);
        q2.set(qTo[i * 4] as number, qTo[i * 4 + 1] as number, qTo[i * 4 + 2] as number, qTo[i * 4 + 3] as number);
        q.slerp(q2, e);
        if (arc > 0.001) {
          qs.setFromAxisAngle(axes[i] as THREE.Vector3, arc * Math.PI);
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
        writeInstance(i, 1 - arc * 0.35);
      }
      cubes.instanceMatrix.needsUpdate = true;
      if (cubes.instanceColor) cubes.instanceColor.needsUpdate = true;
      if (done) {
        anim.active = false;
        cubes.computeBoundingSphere();
      }
    }

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
      cubeMat.uniforms.uHoverGroup!.value = index ?? -1;
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
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      cubes.dispose();
      bloom.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}
