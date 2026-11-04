"use client";

// three.js renderer for the full-screen 3D views. One engine per open view:
// it owns the WebGL context, the bloom pipeline, orbit controls, HTML labels
// and hover picking, and frees all of it on dispose().

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { geoEquirectangular, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import { squarify } from "@/lib/charts/treemap";
import { heightScale, latLonToXYZ, type Scene3D } from "@/lib/three-d/spec";

export interface HoverInfo {
  label: string;
  detail: string;
  x: number;
  y: number;
}

export interface EngineHandle {
  dispose(): void;
  resetView(): void;
  setAutoRotate(on: boolean): void;
}

interface Pickable {
  label: string;
  detail: string;
}

const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-GB") : v.toLocaleString("en-GB", { maximumFractionDigits: 1 }));

// CSS custom properties (var(--series-1)) resolve against the page so the 3D
// colours always match the 2D charts.
function resolveColour(c: string): THREE.Color {
  const m = /^var\((--[\w-]+)\)$/.exec(c.trim());
  const raw = m ? getComputedStyle(document.documentElement).getPropertyValue(m[1] as string).trim() : c;
  try {
    return new THREE.Color(raw || "#2a78d6");
  } catch {
    return new THREE.Color("#2a78d6");
  }
}

// ---------------------------------------------------------------- shaders

// Solid data marks: vertical gradient (dark base, bright top), soft key
// light, fresnel rim and a bright top edge that the bloom pass picks up.
const MARK_VERT = /* glsl */ `
  uniform float uMaxH;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vH;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vH = clamp(position.y / uMaxH, 0.0, 1.0);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const MARK_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uHover;
  uniform float uDim;
  uniform float uTime;
  uniform float uGradient;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vH;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 l = normalize(vec3(0.45, 1.0, 0.6));
    float diff = 0.5 + 0.5 * max(dot(n, l), 0.0);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
    float h = mix(1.0, vH, uGradient);
    vec3 col = uColor * mix(0.28, 1.0, h) * diff;
    // A thin line of light travelling up the mark.
    float d = fract(vH - uTime * 0.12);
    float band = smoothstep(0.05, 0.0, abs(d - 0.05)) * uGradient * step(0.02, vH);
    col += uColor * band * 0.45;
    col += uColor * fres * 0.5;
    col += uColor * step(0.85, n.y) * 0.22 * uGradient;
    col += (uColor * 0.45 + 0.1) * uHover;
    col *= mix(1.0, 0.35, uDim);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function markMaterial(colour: THREE.Color, maxH = 1, gradient = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: colour },
      uHover: { value: 0 },
      uDim: { value: 0 },
      uTime: { value: 0 },
      uMaxH: { value: maxH },
      uGradient: { value: gradient },
    },
    vertexShader: MARK_VERT,
    fragmentShader: MARK_FRAG,
  });
}

// Deep navy backdrop with a faint horizon glow; dithered to avoid banding.
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

// Ground plane: fine and coarse grid lines fading out radially.
const FLOOR_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  varying vec3 vWorld;
  float grid(vec2 p, float size) {
    vec2 g = abs(fract(p / size - 0.5) - 0.5) / fwidth(p / size);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    vec2 p = vWorld.xz;
    float d = length(p) / uRadius;
    float fade = smoothstep(1.0, 0.1, d);
    float fine = grid(p, 1.0) * 0.18;
    float coarse = grid(p, 5.0) * 0.45;
    vec3 col = vec3(0.16, 0.45, 0.8) * (fine + coarse);
    col += vec3(0.04, 0.1, 0.18) * smoothstep(0.7, 0.0, d) * 0.3;
    gl_FragColor = vec4(col, fade * 0.9);
  }
`;

// Soft coloured pool of light under each mark.
const GLOW_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uHover;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    gl_FragColor = vec4(uColor * a * (0.35 + uHover * 0.5), 1.0);
  }
`;

const UV_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// Drifting dust motes for depth.
const DUST_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixel;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.25 + aSeed * 6.2831) * 0.6;
    p.x += cos(uTime * 0.18 + aSeed * 12.0) * 0.4;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPixel * (1.5 + aSeed * 2.5) * (30.0 / -mv.z);
    vAlpha = 0.25 + 0.5 * fract(aSeed * 7.0);
  }
`;

const DOT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.15, length(c));
    gl_FragColor = vec4(uColor * a * vAlpha, 1.0);
  }
`;

// Land dots on the globe, brighter on the side facing the camera.
const LAND_VERT = /* glsl */ `
  uniform float uPixel;
  varying float vAlpha;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(w.xyz);
    float facing = dot(n, normalize(cameraPosition));
    vAlpha = smoothstep(-0.2, 0.6, facing) * 0.9 + 0.1;
    vec4 mv = viewMatrix * w;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPixel * 2.4 * (16.0 / -mv.z);
  }
`;

const ATMOS_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// ---------------------------------------------------------------- labels

function label(text: string, cls: string): CSS2DObject {
  const el = document.createElement("div");
  el.className = cls;
  el.textContent = text;
  return new CSS2DObject(el);
}

const LABEL_VALUE = "sb3d-label sb3d-value";
const LABEL_NAME = "sb3d-label sb3d-name";
const LABEL_BIG = "sb3d-label sb3d-big";

function short(s: string, n = 22): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// ---------------------------------------------------------------- engine

interface Built {
  root: THREE.Group;
  radius: number;
  target: THREE.Vector3;
  floor: boolean;
  camDir: THREE.Vector3;
  // Called each frame with grow progress 0..1 (eased) and time in seconds.
  tick?: (grow: number, time: number) => void;
}

export function createEngine(
  container: HTMLElement,
  spec: Scene3D,
  opts: { onHover: (h: HoverInfo | null) => void; reducedMotion: boolean; onReady?: () => void },
): EngineHandle {
  const width = () => Math.max(1, container.clientWidth);
  const height = () => Math.max(1, container.clientHeight);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia?.("(pointer: coarse)").matches ? 1.5 : 2));
  renderer.setSize(width(), height());
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.setSize(width(), height());
  labels.domElement.style.position = "absolute";
  labels.domElement.style.inset = "0";
  labels.domElement.style.pointerEvents = "none";
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, width() / height(), 0.1, 2000);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const timeUniforms: Array<{ value: number }> = [];
  const pixel = renderer.getPixelRatio();

  // Sky sphere.
  const skyGeo = track(new THREE.SphereGeometry(900, 32, 16));
  const skyMat = track(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: SKY_FRAG,
    }),
  );
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  const built = build(spec);
  scene.add(built.root);

  // Ground grid for the bar-style scenes.
  if (built.floor) {
    const fr = built.radius * 2.6;
    const floorMat = track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uRadius: { value: fr } },
        vertexShader: UV_VERT,
        fragmentShader: FLOOR_FRAG,
      }),
    );
    timeUniforms.push(floorMat.uniforms.uTime as { value: number });
    const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(fr * 2, fr * 2)), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    floor.renderOrder = -1;
    scene.add(floor);
  }

  // Dust.
  {
    const n = 600;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const R = built.radius * 3;
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * R * 2;
      pos[i * 3 + 1] = Math.random() * R * 0.9 - (built.floor ? 0 : R * 0.45);
      pos[i * 3 + 2] = (Math.random() - 0.5) * R * 2;
      seed[i] = Math.random();
    }
    const g = track(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uPixel: { value: pixel }, uColor: { value: new THREE.Color("#6fb4ff") } },
        vertexShader: DUST_VERT,
        fragmentShader: DOT_FRAG,
      }),
    );
    timeUniforms.push(m.uniforms.uTime as { value: number });
    scene.add(new THREE.Points(g, m));
  }

  // Post-processing: bloom on bright edges, then tone mapping + sRGB.
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width(), height());
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width(), height()), 0.55, 0.45, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.autoRotate = !opts.reducedMotion;
  controls.autoRotateSpeed = 0.55;
  controls.minDistance = built.radius * 0.5;
  controls.maxDistance = built.radius * 5;
  if (built.floor) controls.maxPolarAngle = Math.PI * 0.49;
  controls.zoomToCursor = true;

  const home = () => {
    const dist = built.radius * (width() < height() ? 3.4 : 2.4);
    camera.position.copy(built.target).addScaledVector(built.camDir.clone().normalize(), dist);
    controls.target.copy(built.target);
    camera.updateProjectionMatrix();
    controls.update();
  };
  home();

  const stopAuto = () => {
    controls.autoRotate = false;
  };
  controls.addEventListener("start", stopAuto);

  // ---- picking
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered: THREE.Mesh | null = null;
  const pickables: THREE.Object3D[] = [];
  built.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.userData.pick) pickables.push(o);
  });

  const setHover = (m: THREE.Mesh | null, ev?: PointerEvent) => {
    if (hovered !== m) {
      hovered = m;
      for (const p of pickables) {
        const mat = (p as THREE.Mesh).material as THREE.ShaderMaterial;
        if (mat.uniforms?.uDim) mat.uniforms.uDim.value = m && p !== m ? 1 : 0;
      }
      renderer.domElement.style.cursor = m ? "pointer" : "grab";
    }
    if (m && ev) {
      const r = container.getBoundingClientRect();
      const info = m.userData.pick as Pickable;
      opts.onHover({ label: info.label, detail: info.detail, x: ev.clientX - r.left, y: ev.clientY - r.top });
    } else if (!m) opts.onHover(null);
  };

  const pick = (ev: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    setHover(hit ? (hit.object as THREE.Mesh) : null, ev);
  };

  let downAt: { x: number; y: number } | null = null;
  const onMove = (ev: PointerEvent) => {
    if (ev.pointerType === "mouse" && !downAt) pick(ev);
  };
  const onDown = (ev: PointerEvent) => {
    downAt = { x: ev.clientX, y: ev.clientY };
  };
  const onUp = (ev: PointerEvent) => {
    // A tap (no drag) picks on touch screens and re-picks after a mouse drag.
    if (downAt && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < 6) pick(ev);
    downAt = null;
  };
  const onLeave = () => {
    if (!downAt) setHover(null);
  };
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointerleave", onLeave);
  renderer.domElement.style.cursor = "grab";

  // ---- resize
  const ro = new ResizeObserver(() => {
    const w = width();
    const h = height();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    labels.setSize(w, h);
  });
  ro.observe(container);

  // ---- loop
  const growMs = opts.reducedMotion ? 0 : 1600;
  const start = performance.now();
  let raf = 0;
  let readySent = false;
  const markTimes: Array<{ value: number }> = [];
  built.root.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    if (mat?.uniforms?.uTime && mat.uniforms.uHover) markTimes.push(mat.uniforms.uTime as { value: number });
  });

  // Adaptive quality: if frames run slow (older phones, software GL), drop
  // to 1x pixels, then turn bloom off, rather than stutter.
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

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    adapt(now);
    const t = (now - start) / 1000;
    const p = growMs ? Math.min(1, (performance.now() - start) / growMs) : 1;
    const eased = 1 - (1 - p) ** 3;
    for (const u of timeUniforms) u.value = t;
    for (const u of markTimes) u.value = opts.reducedMotion ? 0 : t;
    for (const p2 of pickables) {
      const mat = (p2 as THREE.Mesh).material as THREE.ShaderMaterial;
      const target = p2 === hovered ? 1 : 0;
      if (mat.uniforms?.uHover) mat.uniforms.uHover.value += (target - mat.uniforms.uHover.value) * 0.18;
    }
    built.tick?.(eased, t);
    controls.update();
    composer.render();
    labels.render(scene, camera);
    if (!readySent) {
      readySent = true;
      opts.onReady?.();
    }
  };
  frame();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.removeEventListener("start", stopAuto);
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
        if (o instanceof CSS2DObject) o.element.remove();
      });
      for (const d of disposables) d.dispose();
      bloom.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
    resetView() {
      home();
    },
    setAutoRotate(on: boolean) {
      controls.autoRotate = on;
    },
  };

  // ---------------------------------------------------------- builders

  function build(s: Scene3D): Built {
    switch (s.kind) {
      case "bars":
        return buildBars(s.items, s.unit);
      case "ring":
        return buildRing(s.items, s.unit);
      case "blocks":
        return buildBlocks(s.items, s.unit);
      case "series":
        return buildSeries(s.x, s.series, s.unit);
      case "grid":
        return buildGrid(s.rows, s.cols, s.values, s.unit);
      case "gauge":
        return buildGauge(s.value, s.max, s.unit);
      case "globe":
        return buildGlobe(s.spots, s.unit);
    }
  }

  function glowUnder(root: THREE.Group, colour: THREE.Color, x: number, z: number, size: number, mark: THREE.Mesh) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: colour }, uHover: (mark.material as THREE.ShaderMaterial).uniforms.uHover as THREE.IUniform },
      vertexShader: UV_VERT,
      fragmentShader: GLOW_FRAG,
    });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    g.rotation.x = -Math.PI / 2;
    g.position.set(x, 0.005, z);
    root.add(g);
  }

  // Unit-height box with its base at y = 0, scaled per mark.
  function unitBox(): THREE.BoxGeometry {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }

  function buildBars(items: Array<{ label: string; value: number; colour: string; note?: string }>, unit: string): Built {
    const root = new THREE.Group();
    const H = 8;
    const hOf = heightScale(items.map((d) => d.value), H);
    const n = items.length;
    const step = 1.6;
    const showAll = n <= 14;
    // Gentle arc (ends recede) so the row reads like an amphitheatre.
    const span = (n - 1) * step;
    const bend = n > 3 ? 0.3 : 0;
    const total = items.reduce((s, d) => s + d.value, 0);
    const marks: Array<{ m: THREE.Mesh; h: number; delay: number }> = [];
    items.forEach((d, i) => {
      const u = n === 1 ? 0 : i / (n - 1) - 0.5;
      const x = u * span;
      const z = -(u * u) * span * bend;
      const h = hOf(d.value);
      const c = resolveColour(d.colour);
      const m = new THREE.Mesh(unitBox(), markMaterial(c));
      m.position.set(x, 0, z);
      m.scale.set(1, 0.0001, 1);
      const share = total && !d.note ? ` (${Math.round((d.value / total) * 100)}%)` : "";
      m.userData.pick = { label: d.note ? `${d.label} ${d.note}` : d.label, detail: `${fmt(d.value)} ${unit}${share}` } satisfies Pickable;
      root.add(m);
      glowUnder(root, c, x, z, 3, m);
      marks.push({ m, h, delay: (i / Math.max(1, n)) * 0.35 });
      if (showAll || i < 5) {
        const v = label(fmt(d.value), LABEL_VALUE);
        v.position.set(0, 1, 0);
        v.center.set(0.5, 1.2);
        m.add(v);
        const nm = label(short(d.label, n > 6 ? 14 : 22), LABEL_NAME);
        // Stagger names front and back when the row is crowded.
        nm.position.set(x, 0, z + 0.9 + (n > 6 && i % 2 ? 0.9 : 0));
        nm.center.set(0.5, 0);
        root.add(nm);
      }
    });
    return {
      root,
      radius: Math.max(9, span * 0.62),
      target: new THREE.Vector3(0, H * 0.42, -span * bend * 0.12),
      floor: true,
      camDir: new THREE.Vector3(0, 0.45, 1),
      tick: (g) => {
        for (const { m, h, delay } of marks) {
          const k = Math.min(1, Math.max(0, (g - delay) / (1 - delay)));
          m.scale.y = Math.max(0.0001, h * k);
        }
      },
    };
  }

  function buildRing(items: Array<{ label: string; value: number; colour: string }>, unit: string): Built {
    const root = new THREE.Group();
    const total = items.reduce((s, d) => s + d.value, 0) || 1;
    const R = 6;
    const r = 3.4;
    const H = 3.2;
    const hOf = heightScale(items.map((d) => d.value), H);
    const gap = items.length > 1 ? 0.025 : 0;
    let a0 = Math.PI / 2;
    const marks: Array<{ m: THREE.Mesh; h: number }> = [];
    for (const d of items) {
      const span = (d.value / total) * Math.PI * 2;
      const s0 = a0 - gap / 2;
      const s1 = a0 - span + gap / 2;
      a0 -= span;
      if (s0 <= s1) continue;
      const shape = new THREE.Shape();
      shape.absarc(0, 0, R, s0, s1, true);
      shape.absarc(0, 0, r, s1, s0, false);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: Math.max(8, Math.ceil(span * 24)) });
      // Extrusion runs along +z; rotating about X stands it up along +y
      // (shape y becomes -z).
      g.rotateX(-Math.PI / 2);
      const c = resolveColour(d.colour);
      const m = new THREE.Mesh(g, markMaterial(c));
      m.scale.y = 0.0001;
      m.userData.pick = { label: d.label, detail: `${fmt(d.value)} ${unit} (${Math.round((d.value / total) * 100)}%)` } satisfies Pickable;
      root.add(m);
      marks.push({ m, h: hOf(d.value) });
      const mid = s1 + (s0 - s1) / 2;
      const lr = R + 1.2;
      const lbl = label(`${short(d.label, 18)} · ${Math.round((d.value / total) * 100)}%`, LABEL_NAME);
      lbl.position.set(Math.cos(mid) * lr, 0.3, -Math.sin(mid) * lr);
      root.add(lbl);
    }
    const centre = label(fmt(items.reduce((s, d) => s + d.value, 0)), LABEL_BIG);
    centre.position.set(0, 1.2, 0);
    root.add(centre);
    const sub = label(unit, LABEL_NAME);
    sub.position.set(0, 0.2, 0);
    root.add(sub);
    return {
      root,
      radius: 8,
      target: new THREE.Vector3(0, 0.8, 0),
      floor: true,
      camDir: new THREE.Vector3(0, 0.8, 1),
      tick: (g, t) => {
        marks.forEach(({ m, h }, i) => {
          const k = Math.min(1, Math.max(0, g * 1.3 - i * 0.06));
          m.scale.y = Math.max(0.0001, h * k);
          m.position.y = opts.reducedMotion ? 0 : Math.sin(t * 0.8 + i) * 0.04;
        });
      },
    };
  }

  function buildBlocks(items: Array<{ label: string; value: number; colour: string }>, unit: string): Built {
    const root = new THREE.Group();
    const W = 18;
    const D = 12;
    const rects = squarify(items, (d) => d.value, W, D);
    const max = Math.max(1, ...items.map((d) => d.value));
    const total = items.reduce((s, d) => s + d.value, 0) || 1;
    const marks: Array<{ m: THREE.Mesh; h: number; delay: number }> = [];
    rects.forEach((rc, i) => {
      const gap = 0.12;
      const w = Math.max(0.05, rc.w - gap);
      const d = Math.max(0.05, rc.h - gap);
      const h = 0.4 + Math.sqrt(rc.item.value / max) * 5;
      const c = resolveColour(rc.item.colour);
      const m = new THREE.Mesh(unitBox(), markMaterial(c));
      const x = rc.x + rc.w / 2 - W / 2;
      const z = rc.y + rc.h / 2 - D / 2;
      m.position.set(x, 0, z);
      m.scale.set(w, 0.0001, d);
      m.userData.pick = { label: rc.item.label, detail: `${fmt(rc.item.value)} ${unit} (${Math.round((rc.item.value / total) * 100)}%)` } satisfies Pickable;
      root.add(m);
      marks.push({ m, h, delay: Math.min(0.5, i * 0.03) });
      if (rc.w * rc.h > (W * D) / 40) {
        const l = label(`${short(rc.item.label, 18)}\n${fmt(rc.item.value)}`, LABEL_VALUE);
        l.position.set(0, 1, 0);
        l.center.set(0.5, 1.1);
        m.add(l);
      }
    });
    return {
      root,
      radius: 11,
      target: new THREE.Vector3(0, 1, 0),
      floor: true,
      camDir: new THREE.Vector3(0.35, 0.9, 1),
      tick: (g) => {
        for (const { m, h, delay } of marks) {
          const k = Math.min(1, Math.max(0, (g - delay) / (1 - delay)));
          m.scale.y = Math.max(0.0001, h * k);
        }
      },
    };
  }

  function monthLabel(m: string): string {
    const [y, mo] = m.split("-");
    const d = new Date(Number(y), Number(mo) - 1, 1);
    return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  }

  function buildSeries(x: string[], series: Array<{ label: string; colour: string; values: number[] }>, unit: string): Built {
    const root = new THREE.Group();
    const H = 6;
    const all = series.flatMap((s) => s.values);
    const max = Math.max(1, ...all);
    const dx = Math.min(0.9, 26 / Math.max(1, x.length));
    const width = (x.length - 1) * dx;
    const depth = 0.7;
    const gapZ = 1.6;
    // Largest series at the back so smaller ones aren't hidden behind it.
    const order = series.map((s, i) => ({ i, sum: s.values.reduce((a, b) => a + b, 0) })).sort((a, b) => b.sum - a.sum);
    const zs: number[] = [];
    order.forEach((o, rank) => {
      zs[o.i] = (rank - (series.length - 1) / 2) * gapZ;
    });
    const marks: THREE.Mesh[] = [];
    series.forEach((s, si) => {
      if (x.length < 2) return;
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2, 0);
      s.values.forEach((v, i) => shape.lineTo(-width / 2 + i * dx, Math.max(0.02, (v / max) * H)));
      shape.lineTo(width / 2, 0);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      g.translate(0, 0, (zs[si] as number) - depth / 2);
      const c = resolveColour(s.colour);
      const m = new THREE.Mesh(g, markMaterial(c, H));
      m.scale.y = 0.0001;
      const peak = Math.max(...s.values);
      const sum = s.values.reduce((a, b) => a + b, 0);
      m.userData.pick = { label: s.label, detail: `${fmt(sum)} ${unit} in ${x.length} months, peak ${fmt(peak)}` } satisfies Pickable;
      root.add(m);
      marks.push(m);
      const nm = label(s.label, LABEL_NAME);
      nm.position.set(width / 2 + 0.8, 0.3, zs[si] as number);
      nm.center.set(0, 0.5);
      root.add(nm);
      // Light thread along the ridge.
      const pts = s.values.map((v, i) => new THREE.Vector3(-width / 2 + i * dx, Math.max(0.02, (v / max) * H) + 0.02, (zs[si] as number) + depth / 2 + 0.01));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: c.clone().multiplyScalar(2.2), transparent: true, opacity: 0.95 }),
      );
      line.scale.y = 0.0001;
      m.userData.ridge = line;
      root.add(line);
    });
    const every = Math.max(1, Math.ceil(x.length / 10));
    const frontZ = Math.max(0, ...zs) + depth + 0.6;
    x.forEach((m, i) => {
      if (i % every !== 0 && i !== x.length - 1) return;
      const l = label(monthLabel(m), LABEL_NAME);
      l.position.set(-width / 2 + i * dx, 0, frontZ);
      l.center.set(0.5, 0);
      root.add(l);
    });
    const peakLbl = label(`Peak ${fmt(max)} ${unit}`, LABEL_VALUE);
    peakLbl.position.set(-width / 2 - 0.6, H, Math.min(0, ...zs));
    peakLbl.center.set(1, 0.5);
    root.add(peakLbl);
    return {
      root,
      radius: Math.max(8, width * 0.6),
      target: new THREE.Vector3(0, H * 0.3, 0),
      floor: true,
      camDir: new THREE.Vector3(0.25, 0.5, 1),
      tick: (g) => {
        marks.forEach((m, i) => {
          const k = Math.min(1, Math.max(0, g * 1.25 - i * 0.12));
          m.scale.y = Math.max(0.0001, k);
          const ridge = m.userData.ridge as THREE.Line | undefined;
          if (ridge) ridge.scale.y = Math.max(0.0001, k);
        });
      },
    };
  }

  function buildGrid(rows: string[], cols: Array<{ label: string; colour: string }>, values: number[][], unit: string): Built {
    const root = new THREE.Group();
    const H = 6;
    const hOf = heightScale(values.flat(), H);
    const sx = 1.5;
    const sz = 1.25;
    const w = (cols.length - 1) * sx;
    const d = (rows.length - 1) * sz;
    const marks: Array<{ m: THREE.Mesh; h: number; delay: number }> = [];
    const colours = cols.map((c) => resolveColour(c.colour));
    rows.forEach((row, ri) => {
      const z = -d / 2 + ri * sz;
      const rl = label(short(row, 26), LABEL_NAME);
      rl.position.set(-w / 2 - 0.9, 0, z);
      rl.center.set(1, 0.5);
      root.add(rl);
      cols.forEach((col, ci) => {
        const v = values[ri]?.[ci] ?? 0;
        if (v <= 0) return;
        const x = -w / 2 + ci * sx;
        const m = new THREE.Mesh(unitBox(), markMaterial(colours[ci] as THREE.Color));
        m.position.set(x, 0, z);
        m.scale.set(0.9, 0.0001, 0.8);
        m.userData.pick = { label: row, detail: `${col.label}: ${fmt(v)} ${unit}` } satisfies Pickable;
        root.add(m);
        marks.push({ m, h: hOf(v), delay: Math.min(0.5, (ri / Math.max(1, rows.length)) * 0.5 + ci * 0.03) });
      });
    });
    cols.forEach((col, ci) => {
      const l = label(col.label, LABEL_NAME);
      l.position.set(-w / 2 + ci * sx, 0, d / 2 + 1);
      l.center.set(0.5, 0);
      root.add(l);
    });
    return {
      root,
      radius: Math.max(7, Math.hypot(w, d) * 0.55, H),
      target: new THREE.Vector3(0, H * 0.25, 0),
      floor: true,
      camDir: new THREE.Vector3(0.9, 0.85, 1),
      tick: (g) => {
        for (const { m, h, delay } of marks) {
          const k = Math.min(1, Math.max(0, (g - delay) / (1 - delay)));
          m.scale.y = Math.max(0.0001, h * k);
        }
      },
    };
  }

  function buildGauge(value: number, max: number, unit: string): Built {
    const root = new THREE.Group();
    const R = 5;
    const tube = 0.55;
    const tFinal = Math.min(1, value / max);
    const track2 = new THREE.Mesh(
      new THREE.TorusGeometry(R, tube * 0.75, 24, 160, Math.PI),
      markMaterial(new THREE.Color("#1d3a5c"), 1, 0),
    );
    root.add(track2);
    const fillColour = resolveColour("var(--series-1)");
    const fillMat = markMaterial(fillColour, 1, 0);
    const fill = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 24, 4, 0.0001), fillMat);
    fill.userData.pick = { label: "Value", detail: `${fmt(value)} ${unit} (scale 0 to ${fmt(max)})` } satisfies Pickable;
    root.add(fill);
    const big = label(value.toFixed(1), LABEL_BIG);
    big.position.set(0, 1.4, 0);
    root.add(big);
    const sub = label(unit, LABEL_NAME);
    sub.position.set(0, 0.3, 0);
    root.add(sub);
    const zero = label("0", LABEL_NAME);
    zero.position.set(-R, -1, 0);
    root.add(zero);
    const top = label(fmt(max), LABEL_NAME);
    top.position.set(R, -1, 0);
    root.add(top);
    // Orbiting sparks along the filled arc.
    const sparkN = 160;
    const sparkPos = new Float32Array(sparkN * 3);
    const sparkSeed = new Float32Array(sparkN);
    for (let i = 0; i < sparkN; i++) sparkSeed[i] = Math.random();
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute("aSeed", new THREE.BufferAttribute(sparkSeed, 1));
    const sparkMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixel: { value: pixel * 0.6 }, uColor: { value: fillColour.clone().multiplyScalar(1.6) } },
      vertexShader: DUST_VERT,
      fragmentShader: DOT_FRAG,
    });
    root.add(new THREE.Points(sparkGeo, sparkMat));
    let shown = -1;
    return {
      root,
      radius: 6.5,
      target: new THREE.Vector3(0, 1.8, 0),
      floor: false,
      camDir: new THREE.Vector3(0, 0.15, 1),
      tick: (g, t) => {
        const tt = tFinal * g;
        if (Math.abs(tt - shown) > 0.002) {
          shown = tt;
          const arc = Math.max(0.0001, tt * Math.PI);
          const geo = new THREE.TorusGeometry(R, tube, 24, Math.max(4, Math.ceil(arc * 50)), arc);
          fill.geometry.dispose();
          fill.geometry = geo;
          fill.rotation.z = Math.PI - arc;
        }
        sparkMat.uniforms.uTime!.value = t;
        for (let i = 0; i < sparkN; i++) {
          const s = sparkSeed[i] as number;
          const a = Math.PI - ((s + t * 0.05 * (0.5 + s)) % 1) * tt * Math.PI;
          const rr = R + (Math.sin(s * 50 + t) * 0.5 + 0.5) * tube * 1.6 - tube * 0.8;
          sparkPos[i * 3] = Math.cos(a) * rr;
          sparkPos[i * 3 + 1] = Math.sin(a) * rr;
          sparkPos[i * 3 + 2] = Math.sin(s * 90 + t * 2) * tube;
        }
        sparkGeo.attributes.position!.needsUpdate = true;
      },
    };
  }

  function buildGlobe(spots: Array<{ label: string; lat: number; lon: number; value: number; open: number }>, unit: string): Built {
    const root = new THREE.Group();
    const R = 5;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.995, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color("#0b2747") }, uPower: { value: 1.6 }, uStrength: { value: 1.0 } },
        vertexShader: ATMOS_VERT,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying vec3 vN;
          varying vec3 vWorld;
          void main() {
            vec3 v = normalize(cameraPosition - vWorld);
            float f = max(dot(normalize(vN), v), 0.0);
            gl_FragColor = vec4(uColor * (0.25 + 0.75 * f) + vec3(0.05, 0.18, 0.35) * pow(1.0 - f, 3.0), 1.0);
          }
        `,
      }),
    );
    root.add(core);
    const atmos = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.12, 64, 48),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color("#3d8bff") }, uPower: { value: 2.2 }, uStrength: { value: 1.4 } },
        vertexShader: ATMOS_VERT,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uPower;
          uniform float uStrength;
          varying vec3 vN;
          varying vec3 vWorld;
          void main() {
            vec3 v = normalize(cameraPosition - vWorld);
            // Back faces: dot runs from about -0.45 at the globe's edge to 0
            // at the halo's rim, so the glow hugs the globe and fades out.
            float f = pow(clamp(-dot(normalize(vN), v) * 2.2, 0.0, 1.0), uPower);
            gl_FragColor = vec4(uColor * f * uStrength, 1.0);
          }
        `,
      }),
    );
    root.add(atmos);

    // Land as a field of dots, sampled on a Fibonacci sphere once the
    // outlines arrive.
    import("world-atlas/land-110m.json").then((mod) => {
      const topo = (mod.default ?? mod) as unknown as Parameters<typeof feature>[0] & { objects: { land: Parameters<typeof feature>[1] } };
      const land = feature(topo, topo.objects.land) as unknown as GeoPermissibleObjects;
      // Rasterise the land once to an equirectangular mask; testing pixels is
      // thousands of times faster than a spherical point-in-polygon per dot.
      const MW = 1024;
      const MH = 512;
      const cv = document.createElement("canvas");
      cv.width = MW;
      cv.height = MH;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const proj = geoEquirectangular().scale(MW / (2 * Math.PI)).translate([MW / 2, MH / 2]);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      geoPath(proj, ctx)(land);
      ctx.fill();
      const mask = ctx.getImageData(0, 0, MW, MH).data;
      const N = 16000;
      const pts: number[] = [];
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const lat = (Math.asin(y) * 180) / Math.PI;
        const lon = ((((i * golden * 180) / Math.PI) % 360) + 540) % 360 - 180;
        const px = Math.min(MW - 1, Math.floor(((lon + 180) / 360) * MW));
        const py = Math.min(MH - 1, Math.floor(((90 - lat) / 180) * MH));
        if ((mask[(py * MW + px) * 4 + 3] ?? 0) > 0) pts.push(...latLonToXYZ(lat, lon, R * 1.002));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uPixel: { value: pixel }, uColor: { value: new THREE.Color("#5fa8ff") } },
        vertexShader: LAND_VERT,
        fragmentShader: DOT_FRAG,
      });
      root.add(new THREE.Points(g, m));
    }).catch(() => undefined);

    const hOf = heightScale(spots.map((s) => s.value), 3);
    const openC = resolveColour("var(--series-2)");
    const closedC = resolveColour("var(--series-3)");
    const up = new THREE.Vector3(0, 1, 0);
    const marks: Array<{ m: THREE.Mesh; h: number }> = [];
    const sorted = [...spots].sort((a, b) => b.value - a.value);
    for (const s of sorted) {
      const [x, y, z] = latLonToXYZ(s.lat, s.lon, R);
      const n = new THREE.Vector3(x, y, z).normalize();
      const share = s.value ? s.open / s.value : 0;
      const c = closedC.clone().lerp(openC, share);
      const g = new THREE.CylinderGeometry(0.06, 0.09, 1, 10, 1);
      g.translate(0, 0.5, 0);
      const m = new THREE.Mesh(g, markMaterial(c));
      m.position.set(x, y, z);
      m.quaternion.setFromUnitVectors(up, n);
      m.scale.set(1, 0.0001, 1);
      m.userData.pick = { label: s.label, detail: `${fmt(s.value)} ${unit}, ${fmt(s.open)} open` } satisfies Pickable;
      root.add(m);
      const h = hOf(s.value);
      marks.push({ m, h });
      // Wider invisible-ish halo so small spikes are easy to hover.
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 0.22, 24),
        new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.4), transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }),
      );
      halo.position.copy(n.clone().multiplyScalar(R * 1.003));
      halo.lookAt(n.clone().multiplyScalar(R * 2));
      halo.userData.pick = m.userData.pick;
      root.add(halo);
    }
    for (const s of sorted.slice(0, 6)) {
      const [x, y, z] = latLonToXYZ(s.lat, s.lon, R + hOf(s.value) + 0.25);
      const l = label(short(s.label, 20), LABEL_NAME);
      l.position.set(x, y, z);
      root.add(l);
    }
    // Face the camera towards the data's centre of mass.
    const c = new THREE.Vector3();
    for (const s of spots) c.add(new THREE.Vector3(...latLonToXYZ(s.lat, s.lon, 1)).multiplyScalar(s.value));
    const dir = c.lengthSq() > 0 ? c.normalize() : new THREE.Vector3(0, 0.3, 1);
    return {
      root,
      radius: 7,
      target: new THREE.Vector3(0, 0, 0),
      floor: false,
      camDir: dir.add(new THREE.Vector3(0, 0.25, 0)),
      tick: (g) => {
        marks.forEach(({ m, h }, i) => {
          const k = Math.min(1, Math.max(0, g * 1.4 - i * 0.01));
          m.scale.y = Math.max(0.0001, h * k);
        });
      },
    };
  }
}
