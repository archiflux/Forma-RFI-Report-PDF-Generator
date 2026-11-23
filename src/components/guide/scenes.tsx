"use client";

import { SiteboardMark } from "@/components/ui/siteboard-mark";
import { Cursor, H, ramp, Reveal, Tick, W, type Waypoint } from "./kit";

// The eight scenes of "How to use Siteboard". Each draws a miniature of the
// real screen on a 640 x 400 stage and is driven by `t` (ms).

const TEAL = "#006881";
const DEEP = "#00394a";
const CITRON = "#d1c800";
const DESK = "#eef1f2";
const INK = "#2b3033";
const SLATE = "#5c666b";

type SceneProps = { t: number };

export interface Scene {
  id: string;
  name: string;
  title: string;
  body: string;
  tip: string;
  duration: number;
  dark?: boolean;
  Stage: (p: SceneProps) => React.JSX.Element;
}

// ---- shared pieces

function Chrome({ active, dark = false }: { active: string; dark?: boolean }) {
  return (
    <div
      className="absolute inset-x-0 top-0 flex h-[28px] items-center justify-between border-t-[3px] px-3"
      style={{ borderColor: CITRON, background: dark ? "#061a24" : "rgba(255,255,255,0.95)", boxShadow: "0 1px 2px rgba(0,40,50,0.06)" }}
    >
      <span className="flex items-center gap-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: dark ? "#fff" : TEAL }}>
        <SiteboardMark size={13} tone={dark ? "white" : "colour"} />
        Siteboard
      </span>
      <span className="flex gap-3 text-[8.5px] font-semibold" style={{ color: dark ? "rgba(255,255,255,0.7)" : "#474f53" }}>
        {["Templates", "Issues", "Forms", "Reviews", "RFIs"].map((n) => (
          <span key={n} className="relative" style={n === active ? { color: dark ? "#fff" : TEAL } : undefined}>
            {n}
            {n === active ? <span className="absolute inset-x-0 -bottom-[7px] h-[2px]" style={{ background: CITRON }} /> : null}
          </span>
        ))}
      </span>
    </div>
  );
}

function Hero({ x, y, w, lead, rest, kicker = "Siteboard dashboard" }: { x: number; y: number; w: number; lead: string; rest: string; kicker?: string }) {
  return (
    <div className="absolute px-3 py-2 text-white" style={{ left: x, top: y, width: w, background: DEEP }}>
      <p className="text-[6.5px] font-semibold uppercase tracking-[0.14em] text-white/70">{kicker}</p>
      <p className="mt-0.5 font-display text-[17px] font-semibold leading-5">
        <span style={{ color: CITRON }}>{lead}</span> {rest}
      </p>
    </div>
  );
}

function Bar({ x, y, w, children }: { x: number; y: number; w: number; children: React.ReactNode }) {
  return (
    <div className="bp-bar absolute flex h-[16px] items-center justify-between px-2 text-[7px] text-white" style={{ left: x, top: y, width: w, background: TEAL }}>
      {children}
    </div>
  );
}

function Card({ x, y, w, h, children, className = "" }: { x: number; y: number; w: number; h: number; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`absolute bg-white ${className}`} style={{ left: x, top: y, width: w, height: h, boxShadow: "0 1px 2px rgba(0,40,50,0.08)" }}>
      {children}
    </div>
  );
}

function Lines({ n, x, y, w }: { n: number; x: number; y: number; w: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="absolute h-[4px]" style={{ left: x, top: y + i * 8, width: i === n - 1 ? w * 0.6 : w, background: "#dde3e6" }} />
      ))}
    </>
  );
}

function Stat({ x, y, label, value, tone = TEAL }: { x: number; y: number; label: string; value: string; tone?: string }) {
  return (
    <Card x={x} y={y} w={96} h={50}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: tone }} />
      <p className="absolute left-2 top-2 text-[6.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#7c8a90" }}>
        {label}
      </p>
      <p className="absolute left-2 top-[17px] font-display text-[19px] font-semibold tabular-nums" style={{ color: tone === CITRON ? "#2b2900" : tone }}>
        {value}
      </p>
    </Card>
  );
}

// ---- 1. Pick a dashboard

const TEMPLATES = [
  { name: "Issues", x: 16, y: 120 },
  { name: "RFI", x: 324, y: 120 },
  { name: "Forms", x: 16, y: 252 },
  { name: "Reviews", x: 324, y: 252 },
];

function PickDashboard({ t }: SceneProps) {
  const path: Waypoint[] = [
    { t: 0, x: 560, y: 380 },
    { t: 1700, x: 96, y: 228, click: true },
    { t: 3200, x: 96, y: 228 },
  ];
  const go = ramp(t, 2000, 900);
  return (
    <>
      <Chrome active="Templates" />
      <Hero x={16} y={40} w={608} lead="Dashboard" rest="templates" kicker="Keep your projects in sight" />
      <Bar x={16} y={96} w={608}>
        <span>Dashboards</span>
        <span className="font-medium">4</span>
      </Bar>
      {TEMPLATES.map((c) => (
        <Card key={c.name} x={c.x} y={c.y} w={300} h={124}>
          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: TEAL }} />
          <span className="absolute left-3 top-3 h-[18px] w-[18px]" style={{ background: TEAL }} />
          <p className="absolute left-[38px] top-[14px] text-[10px] font-semibold" style={{ color: INK }}>
            {c.name} Dashboard
          </p>
          <span className="absolute right-3 top-3 px-1 text-[6px] font-semibold uppercase leading-[11px] text-white" style={{ background: TEAL }}>
            Available
          </span>
          <Lines n={3} x={12} y={44} w={260} />
          <span className="absolute bottom-3 left-3 flex h-[18px] items-center px-2 text-[7.5px] font-semibold text-white" style={{ background: TEAL }}>
            Open {c.name} dashboard →
          </span>
        </Card>
      ))}
      {t >= 1700 ? <span className="absolute border-2" style={{ left: 14, top: 118, width: 304, height: 128, borderColor: CITRON }} /> : null}
      {/* The page changes: a citron line runs along the top, then the dashboard. */}
      {t >= 2000 && t < 3000 ? <span className="absolute left-0 top-0 h-[3px] origin-left" style={{ width: W, background: TEAL, transform: `scaleX(${go})` }} /> : null}
      <Reveal t={t} at={2900} className="absolute inset-x-0 bottom-0 top-[28px]" curtain={DESK} style={{ background: DESK }}>
        <Hero x={16} y={12} w={608} lead="Issues" rest="dashboard" />
        <Card x={16} y={72} w={150} h={290}>
          <Lines n={8} x={10} y={14} w={120} />
        </Card>
        <Card x={178} y={72} w={446} h={60}>
          <Lines n={3} x={10} y={14} w={400} />
        </Card>
        <Card x={178} y={142} w={446} h={220}>
          <Lines n={6} x={10} y={14} w={400} />
        </Card>
      </Reveal>
      <Cursor t={t} path={path} />
    </>
  );
}

// ---- 2. Choose your projects

const PROJECTS = ["Riverside School", "Harbour Offices", "Mill Lane Housing", "Northgate Library", "Kingsway Depot", "Park Road Clinic"];
const TICKED = [{ row: 0, at: 1300 }, { row: 2, at: 2100 }, { row: 3, at: 2800 }];
const SET_NAME = "Midlands sites";

function ChooseProjects({ t }: SceneProps) {
  const rowY = (i: number) => 170 + i * 26;
  const path: Waypoint[] = [
    { t: 0, x: 420, y: 330 },
    ...TICKED.map((r) => ({ t: r.at, x: 33, y: rowY(r.row) + 7, click: true })),
    { t: 3600, x: 80, y: 89, click: true },
    { t: 5000, x: 167, y: 89, click: true },
    { t: 6200, x: 300, y: 300 },
  ];
  const ticked = TICKED.filter((r) => t >= r.at).length;
  const typed = SET_NAME.slice(0, Math.max(0, Math.floor((t - 3800) / 70)));
  return (
    <>
      <Chrome active="Issues" />
      <Card x={16} y={40} w={196} h={344}>
        <p className="absolute left-3 top-3 text-[6.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: TEAL }}>
          My project sets
        </p>
        <span className="absolute left-3 top-[40px] flex h-[18px] w-[118px] items-center border px-1.5 text-[8px]" style={{ borderColor: t >= 3600 && t < 5000 ? TEAL : "#c9d2d6", color: typed ? INK : "#8a9398" }}>
          {typed || "Name this selection"}
          {t >= 3600 && t < 5000 && Math.floor(t / 400) % 2 ? <span className="ml-px inline-block h-[10px] w-px" style={{ background: INK }} /> : null}
        </span>
        <span className="absolute right-3 top-[40px] flex h-[18px] items-center px-2 text-[7.5px] font-semibold text-white" style={{ background: TEAL }}>
          Save set
        </span>
        <Reveal t={t} at={5300} curtain="#ffffff" className="absolute left-3 top-[66px]">
          <span className="block px-1.5 text-[7px] font-semibold uppercase leading-[13px]" style={{ background: "#f7f5c9", color: "#2b2900", boxShadow: `inset 0 0 0 1px ${CITRON}` }}>
            {SET_NAME} · 3 projects
          </span>
        </Reveal>
        <p className="absolute left-3 top-[100px] text-[6.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: TEAL }}>
          Projects ({ticked}/6)
        </p>
        <span className="absolute left-3 top-[114px] flex h-[16px] w-[170px] items-center border px-1.5 text-[7.5px]" style={{ borderColor: "#c9d2d6", color: "#8a9398" }}>
          Filter projects
        </span>
      </Card>
      {PROJECTS.map((p, i) => {
        const tick = TICKED.find((r) => r.row === i);
        return (
          <div key={p}>
            <Tick t={t} at={tick ? tick.at : null} x={28} y={rowY(i)} />
            <p className="absolute text-[8.5px]" style={{ left: 48, top: rowY(i) - 1, color: INK }}>
              {p}
            </p>
          </div>
        );
      })}
      <Hero x={224} y={40} w={400} lead="Issues" rest="dashboard" />
      <Card x={224} y={100} w={400} h={284}>
        {ticked ? (
          <p className="absolute left-3 top-3 text-[8px]" style={{ color: SLATE }}>
            {ticked} project{ticked === 1 ? "" : "s"} selected: the dashboard builds as you tick.
          </p>
        ) : (
          <p className="absolute inset-x-6 top-[120px] border border-dashed p-3 text-center text-[8.5px]" style={{ borderColor: "#c9d2d6", color: SLATE }}>
            Tick one or more projects, or load a saved set, to build the dashboard.
          </p>
        )}
        {ticked ? <Lines n={Math.min(9, ticked * 3)} x={12} y={28} w={370} /> : null}
      </Card>
      <Cursor t={t} path={path} />
    </>
  );
}

// ---- 3. Watch it load

function WatchItLoad({ t }: SceneProps) {
  const k = ramp(t, 300, 4000);
  const done = t >= 4400;
  const projects = done ? 3 : Math.min(2, Math.floor(k * 3));
  const issues = Math.round(342 * Math.min(1, k * 1.05));
  const bars = [62, 88, 40, 74, 55, 30, 68];
  return (
    <>
      <Chrome active="Issues" />
      <Hero x={16} y={40} w={608} lead="Issues" rest="dashboard" />
      <Card x={16} y={100} w={608} h={58}>
        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: done ? "#10b981" : CITRON }} />
        <span className="absolute left-3 top-[10px]">
          {done ? (
            <span className="flex h-[26px] w-[26px] items-center justify-center" style={{ background: "#047857" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#fff" strokeWidth="2.4" />
              </svg>
            </span>
          ) : (
            <SiteboardMark size={26} loading />
          )}
        </span>
        <p className="absolute left-[46px] top-[10px] text-[9.5px] font-semibold" style={{ color: INK }}>
          {done ? "All 3 projects loaded" : "Fetching from Autodesk Forma"}
        </p>
        <p className="absolute left-[46px] top-[24px] text-[8px] tabular-nums" style={{ color: SLATE }}>
          {done ? `${issues} issues` : `${projects} of 3 projects · ${issues} issues so far`}
        </p>
        <p className="absolute right-3 top-[8px] font-display text-[20px] font-semibold tabular-nums" style={{ color: TEAL }}>
          {Math.round(k * 100)}%
        </p>
        <span className="absolute bottom-[8px] left-3 right-3 h-[4px]" style={{ background: "#dde3e6" }}>
          <span className="block h-full origin-left" style={{ background: done ? "#10b981" : CITRON, transform: `scaleX(${Math.max(0.03, k)})` }} />
        </span>
      </Card>
      {[
        ["Issues", String(issues), TEAL],
        ["Outstanding", String(Math.round(issues * 0.6)), TEAL],
        ["Overdue", String(Math.round(issues * 0.08)), CITRON],
        ["Closed", String(Math.round(issues * 0.4)), "#10b981"],
      ].map(([label, value, tone], i) => (
        <Reveal key={label} t={t} at={1400 + i * 120} className="absolute" style={{ left: 16 + i * 104, top: 170 }}>
          <Stat x={0} y={0} label={label as string} value={value as string} tone={tone as string} />
        </Reveal>
      ))}
      <Reveal t={t} at={2000} className="absolute" style={{ left: 432, top: 170, width: 192, height: 214 }}>
        <Bar x={0} y={0} w={192}>
          <span>Issues by status</span>
        </Bar>
        <Card x={0} y={16} w={192} h={198}>
          {[0.42, 0.25, 0.18, 0.1].map((v, i) => (
            <span key={i} className="absolute left-3 h-[10px] origin-left" style={{ top: 16 + i * 22, width: 160, background: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"][i], transform: `scaleX(${v * 2 * ramp(t, 2300 + i * 150, 700)})` }} />
          ))}
        </Card>
      </Reveal>
      <Reveal t={t} at={2400} className="absolute" style={{ left: 16, top: 232, width: 404, height: 152 }}>
        <Bar x={0} y={0} w={404}>
          <span>Issues raised per month</span>
        </Bar>
        <Card x={0} y={16} w={404} h={136}>
          {bars.map((b, i) => (
            <span key={i} className="absolute bottom-3 w-[36px] origin-bottom" style={{ left: 16 + i * 54, height: b * 1.2, background: TEAL, transform: `scaleY(${ramp(t, 2700 + i * 110, 650)})` }} />
          ))}
        </Card>
      </Reveal>
    </>
  );
}

// ---- 4. Filter in a click

const STATUS = [
  { label: "Open", n: 120, colour: "#2a78d6" },
  { label: "In review", n: 64, colour: "#eb6834" },
  { label: "Overdue", n: 27, colour: CITRON },
  { label: "Closed", n: 131, colour: "#1baf7a" },
];

function FilterInAClick({ t }: SceneProps) {
  const filtered = t >= 2100 && t < 5300;
  const path: Waypoint[] = [
    { t: 0, x: 560, y: 360 },
    { t: 2000, x: 380, y: 292, click: true },
    { t: 3600, x: 470, y: 160 },
    { t: 5100, x: 238, y: 102, click: true },
    { t: 6400, x: 520, y: 360 },
  ];
  return (
    <>
      <Chrome active="Issues" />
      <div className="absolute flex gap-2" style={{ left: 16, top: 40 }}>
        {["Project All", "Status All", "Type All", "Assignee All"].map((f, i) => (
          <span key={f} className="flex h-[18px] items-center border bg-white px-2 text-[7.5px]" style={{ borderColor: "#c9d2d6", color: SLATE }}>
            {i === 1 && filtered ? (
              <>
                Status <b className="ml-1" style={{ color: TEAL }}>Overdue</b>
              </>
            ) : (
              <>
                {f.split(" ")[0]} <b className="ml-1" style={{ color: TEAL }}>All</b>
              </>
            )}
          </span>
        ))}
      </div>
      <Reveal t={t} at={2200} until={5300} className="absolute" style={{ left: 16, top: 94 }}>
        <span className="flex items-center gap-3 text-[8px]">
          <span className="px-1.5 font-semibold uppercase leading-[14px]" style={{ background: "#f7f5c9", color: "#2b2900", boxShadow: `inset 0 0 0 1px ${CITRON}` }}>
            Status: Overdue ×
          </span>
          <span className="underline" style={{ color: TEAL }}>
            Reset filters (27 of 342)
          </span>
        </span>
      </Reveal>
      <Stat x={16} y={120} label="Issues" value={filtered ? "27" : "342"} />
      <Stat x={120} y={120} label="Outstanding" value={filtered ? "27" : "211"} />
      <Stat x={224} y={120} label="Overdue" value="27" tone={CITRON} />
      <Stat x={328} y={120} label="Closed" value={filtered ? "0" : "131"} tone="#10b981" />
      <Bar x={16} y={186} w={420}>
        <span>Issues by status (click to filter)</span>
      </Bar>
      <Card x={16} y={202} w={420} h={182}>
        {STATUS.map((s, i) => {
          const dim = filtered && s.label !== "Overdue";
          return (
            <div key={s.label}>
              <p className="absolute left-3 text-[8.5px]" style={{ top: 18 + i * 36, color: INK }}>
                {s.label}
              </p>
              <span
                className="absolute h-[14px] origin-left"
                style={{ left: 80, top: 18 + i * 36, width: (s.n / 131) * 290, background: s.colour, opacity: dim ? 0.22 : 1, transition: "opacity 300ms" }}
              />
              <p className="absolute right-3 text-[8.5px] font-semibold tabular-nums" style={{ top: 18 + i * 36, color: INK }}>
                {s.n}
              </p>
            </div>
          );
        })}
      </Card>
      <Bar x={448} y={186} w={176}>
        <span>Register</span>
      </Bar>
      <Card x={448} y={202} w={176} h={182}>
        {Array.from({ length: filtered ? 4 : 9 }, (_, i) => (
          <span key={i} className="absolute left-2 right-2 h-[5px]" style={{ top: 12 + i * 18, background: filtered ? "#f7f5c9" : "#dde3e6" }} />
        ))}
      </Card>
      <Cursor t={t} path={path} />
    </>
  );
}

// ---- 5. See it on the map

const PINS = [
  { n: 12, x: 250, y: 220, colour: "#00394a" },
  { n: 7, x: 360, y: 200, colour: "#2a8aa0" },
  { n: 5, x: 318, y: 290, colour: "#5ea9ba" },
];

function SeeItOnTheMap({ t }: SceneProps) {
  const z = ramp(t, 1700, 1300);
  const split = t >= 1700;
  const settled = t >= 3000;
  const centre = { x: 305, y: 240 };
  const path: Waypoint[] = [
    { t: 0, x: 540, y: 360 },
    { t: 1500, x: 37, y: 86, click: true },
    { t: 4200, x: 252, y: 222, click: true },
    { t: 6400, x: 300, y: 360 },
  ];
  return (
    <>
      <Chrome active="Issues" />
      <Bar x={16} y={40} w={608}>
        <span>Projects on the map</span>
      </Bar>
      <div className="absolute overflow-hidden" style={{ left: 16, top: 56, width: 608, height: 328, background: "#f3f5f7" }}>
        {/* Roads and water grow as you zoom in: shapes only. */}
        <svg width="608" height="328" className="absolute inset-0" style={{ transform: `scale(${1 + z * 0.6})`, transformOrigin: "290px 184px" }} aria-hidden>
          <path d="M0 250 C120 230 180 300 300 290 S480 230 608 270 L608 328 L0 328Z" fill="#d6e4f1" />
          {[40, 110, 190, 260].map((y) => (
            <path key={y} d={`M0 ${y} C150 ${y + 20} 400 ${y - 25} 608 ${y + 10}`} stroke="#fff" strokeWidth="5" fill="none" />
          ))}
          {[90, 230, 380, 520].map((x) => (
            <path key={x} d={`M${x} 0 C${x + 20} 120 ${x - 15} 220 ${x + 10} 328`} stroke="#fff" strokeWidth="4" fill="none" />
          ))}
        </svg>
        <span className="absolute left-2 top-2 flex flex-col border bg-white text-[10px] font-semibold leading-[14px]" style={{ borderColor: "#c9d2d6", color: INK }}>
          <span className="px-1.5">+</span>
          <span className="border-t px-1.5" style={{ borderColor: "#c9d2d6" }}>
            −
          </span>
        </span>
      </div>
      {!split ? (
        <span className="absolute flex items-center justify-center rounded-full border-[3px] border-white font-semibold text-white" style={{ left: centre.x - 26, top: centre.y - 26, width: 52, height: 52, fontSize: 12, background: DEEP }}>
          24
        </span>
      ) : (
        PINS.map((p) => {
          const k = ramp(t, 1700, 1300);
          const x = centre.x + (p.x - centre.x) * k;
          const y = centre.y + (p.y - centre.y) * k;
          const r = 12 + p.n;
          return (
            <span
              key={p.n}
              className="absolute flex items-center justify-center rounded-full border-2 border-white font-semibold text-white"
              style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, background: p.colour, fontSize: 10 }}
            >
              {settled ? p.n : ""}
            </span>
          );
        })
      )}
      <Reveal t={t} at={4400} curtain="#f3f5f7" className="absolute" style={{ left: 40, top: 110, width: 170 }}>
        <div className="bg-white p-2.5 text-[8px]" style={{ boxShadow: "0 18px 40px -12px rgba(0,40,50,0.3)", color: INK }}>
          <p className="text-[9px] font-semibold" style={{ color: TEAL }}>
            Riverside School
          </p>
          <p className="mt-1 flex justify-between">
            <span>Issues</span>
            <span>12</span>
          </p>
          <p className="flex justify-between">
            <span>Open</span>
            <span>4</span>
          </p>
          <p className="mt-2 flex gap-1.5">
            <span className="border px-1.5 py-0.5 font-semibold" style={{ borderColor: "#c9d2d6", color: TEAL }}>
              Filter to this project
            </span>
            <span className="border px-1.5 py-0.5 font-semibold" style={{ borderColor: "#c9d2d6", color: TEAL }}>
              Zoom in
            </span>
          </p>
        </div>
      </Reveal>
      <Cursor t={t} path={path} />
    </>
  );
}

// ---- 6. Explore in 3D

const TOWERS = [
  { label: "Open", n: 9, colour: "#2a78d6" },
  { label: "In review", n: 6, colour: "#eb6834" },
  { label: "Closed", n: 11, colour: "#1baf7a" },
  { label: "Draft", n: 4, colour: "#e87ba4" },
];

function IsoCube({ x, y, colour, s = 14, glow = false }: { x: number; y: number; colour: string; s?: number; glow?: boolean }) {
  const h = s * 0.58;
  return (
    <svg className="absolute" width={s * 2 + 2} height={s * 2 + 2} style={{ left: x - s, top: y - s, filter: glow ? "drop-shadow(0 0 6px #fff)" : undefined }} aria-hidden>
      <g transform={`translate(${s + 1} ${s + 1})`}>
        <path d={`M0 ${-h} L${s} 0 L0 ${h} L${-s} 0Z`} fill={colour} />
        <path d={`M${-s} 0 L0 ${h} L0 ${h + s} L${-s} ${s}Z`} fill={colour} style={{ filter: "brightness(0.75)" }} />
        <path d={`M${s} 0 L0 ${h} L0 ${h + s} L${s} ${s}Z`} fill={colour} style={{ filter: "brightness(0.58)" }} />
      </g>
    </svg>
  );
}

function ExploreIn3D({ t }: SceneProps) {
  const path: Waypoint[] = [
    { t: 0, x: 560, y: 380 },
    { t: 4300, x: 152, y: 230, click: true },
    { t: 6600, x: 200, y: 360 },
  ];
  const picked = t >= 4300;
  return (
    <>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, #0b2a3c, #030a14 70%)" }} />
      <Chrome active="Issues" dark />
      <div className="absolute flex gap-1 border p-0.5 text-[7.5px]" style={{ left: 16, top: 40, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
        {["Towers", "Ring", "Blocks", "Timeline", "Map", "Galaxy"].map((s) => (
          <span key={s} className="px-2 py-0.5" style={s === "Towers" ? { background: CITRON, color: DEEP, fontWeight: 600 } : undefined}>
            {s}
          </span>
        ))}
      </div>
      {/* Floor grid. */}
      <svg className="absolute inset-0" width={W} height={H} aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1={60} y1={270 + i * 14} x2={580} y2={270 + i * 14} stroke="rgba(80,160,220,0.18)" />
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <line key={`v${i}`} x1={320 + (i - 6.5) * 18} y1={270} x2={320 + (i - 6.5) * 60} y2={400} stroke="rgba(80,160,220,0.18)" />
        ))}
      </svg>
      {TOWERS.map((tw, ti) =>
        Array.from({ length: tw.n }, (_, i) => {
          const start = 300 + ti * 260 + i * 120;
          const k = ramp(t, start, 600);
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = 150 + ti * 105 + col * 15;
          const y = 300 - row * 17 + col * 8;
          if (k <= 0) return null;
          return <IsoCube key={`${ti}-${i}`} x={x} y={y - (1 - k) * 260} colour={tw.colour} glow={picked && ti === 0 && i === tw.n - 1} />;
        }),
      )}
      {TOWERS.map((tw, ti) => (
        <Reveal key={tw.label} t={t} at={1600 + ti * 260} curtain="#061622" className="absolute text-center" style={{ left: 110 + ti * 105, top: 334, width: 90 }}>
          <p className="text-[8.5px] font-semibold text-white">{tw.label}</p>
          <p className="text-[7.5px] text-white/60">{tw.n}</p>
        </Reveal>
      ))}
      <Reveal t={t} at={4500} curtain="#071a26" className="absolute" style={{ left: 420, top: 72, width: 200 }}>
        <div className="border p-2.5 text-[7.5px] text-white" style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(11,27,46,0.92)" }}>
          <p className="text-[6.5px] font-semibold uppercase tracking-[0.14em] text-white/50">Properties</p>
          <p className="mt-1 text-[9px] font-semibold">Clash at level 5, grid E4</p>
          <p className="text-white/60">#58 · Riverside School</p>
          {[
            ["Status", "Open"],
            ["Assigned to", "Structures"],
            ["Due date", "12 Dec 2026"],
            ["Location", "Block C > Level 5"],
          ].map(([k, v]) => (
            <p key={k} className="mt-1 flex justify-between border-b pb-0.5" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <span className="text-white/55">{k}</span>
              <span>{v}</span>
            </p>
          ))}
          <span className="mt-2 inline-block px-2 py-0.5 font-semibold" style={{ background: CITRON, color: DEEP }}>
            Open in Forma
          </span>
        </div>
      </Reveal>
      <Cursor t={t} path={path} dark />
    </>
  );
}

// ---- 7. Share and report

function Toast({ children, tone = "#10b981", style }: { children: React.ReactNode; tone?: string; style?: React.CSSProperties }) {
  return (
    <p className="border-l-[3px] bg-white px-2.5 py-1.5 text-[8px]" style={{ borderColor: tone, color: INK, boxShadow: "0 18px 40px -12px rgba(0,40,50,0.3)", ...style }}>
      {children}
    </p>
  );
}

function Toolbar({ register = true }: { register?: boolean }) {
  return (
    <div className="absolute flex items-center gap-1.5" style={{ right: 16, top: 40 }}>
      <span className="flex h-[18px] items-center px-2 text-[7.5px] font-semibold text-white" style={{ background: DEEP }}>
        3D view
      </span>
      <span className="relative flex h-[18px] items-center gap-1 pl-4 pr-1 text-[7.5px]" style={{ color: INK }}>
        <Tick t={0} at={register ? -1 : null} x={0} y={3} />
        Include register
      </span>
      {["Download PDF report", "Download CSV"].map((b) => (
        <span key={b} className="flex h-[18px] items-center border bg-white px-2 text-[7.5px] font-semibold" style={{ borderColor: "#c9d2d6", color: INK }}>
          {b}
        </span>
      ))}
    </div>
  );
}

// ---- 7. PDF reports

function PdfReports({ t }: SceneProps) {
  const sheet = ramp(t, 1500, 900);
  const path: Waypoint[] = [
    { t: 0, x: 120, y: 370 },
    { t: 1300, x: 480, y: 49, click: true },
    { t: 3000, x: 600, y: 330 },
  ];
  return (
    <>
      <Chrome active="Issues" />
      <Toolbar />
      <Stat x={16} y={70} label="Issues" value="27" />
      <Stat x={120} y={70} label="Outstanding" value="27" />
      <Stat x={224} y={70} label="Overdue" value="27" tone={CITRON} />
      <span className="absolute px-1.5 text-[7px] font-semibold uppercase leading-[13px]" style={{ left: 336, top: 72, background: "#f7f5c9", color: "#2b2900", boxShadow: `inset 0 0 0 1px ${CITRON}` }}>
        Status: Overdue
      </span>
      <Bar x={16} y={132} w={608}>
        <span>Issue register (27)</span>
      </Bar>
      <Card x={16} y={148} w={608} h={236}>
        <Lines n={12} x={12} y={14} w={580} />
      </Card>
      {/* The report: A4 landscape, shapes only, so it can move. */}
      {t >= 1500 ? (
        <div
          className="absolute bg-white"
          style={{ left: 150, top: 92, width: 340, height: 240, boxShadow: "0 28px 60px -16px rgba(0,40,50,0.45)", transform: `translateY(${(1 - sheet) * 330}px)` }}
          aria-hidden
        >
          <span className="absolute left-4 top-4 h-[12px] w-[44px]" style={{ background: TEAL }} />
          <span className="absolute left-4 top-[32px] h-[7px] w-[120px]" style={{ background: INK }} />
          <span className="absolute left-4 right-4 top-[46px] h-[3px]" style={{ background: CITRON }} />
          {[TEAL, TEAL, CITRON, "#10b981", "#7c8a90", "#7c8a90"].map((c, i) => (
            <span key={i} className="absolute h-[24px] w-[46px] border-t-[3px]" style={{ left: 16 + i * 51, top: 56, borderColor: c, background: "#f4f7f8" }} />
          ))}
          {[0, 1].map((col) => (
            <div key={col}>
              <span className="absolute h-[7px]" style={{ left: 16 + col * 156, top: 92, width: 148, background: TEAL }} />
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="absolute h-[5px] origin-left" style={{ left: 16 + col * 156, top: 104 + i * 9, width: 130, background: "#2a78d6", transform: `scaleX(${[0.9, 0.62, 0.48, 0.3, 0.18][i]! * ramp(t, 2300 + i * 90, 500)})` }} />
              ))}
            </div>
          ))}
          <span className="absolute left-4 right-4 top-[156px] h-[7px]" style={{ background: TEAL }} />
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="absolute left-4 right-4 h-[3px]" style={{ top: 170 + i * 8, background: "#dde3e6" }} />
          ))}
        </div>
      ) : null}
      <Reveal t={t} at={2700} className="absolute" style={{ left: 506, top: 96, width: 118 }}>
        <div className="space-y-1 text-[7.5px]" style={{ color: INK }}>
          {["Bailey Partnership branding", "Your filters: Status Overdue", "Only the panels you show", "The register, if ticked"].map((x) => (
            <p key={x} className="border-l-2 bg-white px-1.5 py-1" style={{ borderColor: TEAL }}>
              {x}
            </p>
          ))}
        </div>
      </Reveal>
      <Reveal t={t} at={4000} className="absolute" style={{ left: 16, bottom: 16 }}>
        <Toast>
          <b>Issues dashboard.pdf</b> downloaded · A4 landscape
        </Toast>
      </Reveal>
      <Reveal t={t} at={4700} className="absolute" style={{ right: 16, bottom: 16, width: 250 }}>
        <Toast tone={CITRON}>PDFs show full names and details: keep them inside Bailey, or share a redacted link instead.</Toast>
      </Reveal>
      <Cursor t={t} path={path} />
    </>
  );
}

// ---- 8. Public links and redaction

const PEOPLE = [
  ["Clash at level 5, grid E4", "Jane Hughes"],
  ["Fire door missing closer", "Amir Patel"],
  ["Ceiling void not sealed", "Jane Hughes"],
  ["Handrail height", "Tom Reid"],
];

function ShareALink({ t }: SceneProps) {
  const open = t >= 1100;
  const typed = "Riverside monthly".slice(0, Math.max(0, Math.floor((t - 1500) / 60)));
  const created = t >= 3600;
  const path: Waypoint[] = [
    { t: 0, x: 500, y: 380 },
    { t: 1000, x: 90, y: 68, click: true },
    { t: 1400, x: 150, y: 120, click: true },
    { t: 2600, x: 33, y: 151 },
    { t: 3500, x: 44, y: 206, click: true },
    { t: 5800, x: 600, y: 380 },
  ];
  return (
    <>
      <Chrome active="Issues" />
      <Card x={16} y={40} w={300} h={open ? 344 : 40}>
        <p className="absolute left-3 top-[12px] text-[9px] font-semibold" style={{ color: TEAL }}>
          {open ? "▾" : "▸"} Share a link (no Forma sign-in needed to view)
        </p>
        {open ? (
          <Reveal t={t} at={1100} curtain="#ffffff" className="absolute inset-x-3 top-[34px]">
            <p className="text-[7.5px]" style={{ color: SLATE }}>
              Publishes the 342 loaded records as they are now. The link does not update itself and stops working when it expires.
            </p>
            <span className="mt-2 flex h-[18px] items-center border px-1.5 text-[8px]" style={{ borderColor: t >= 1400 && t < 2600 ? TEAL : "#c9d2d6", color: typed ? INK : "#8a9398" }}>
              {typed || "Issues dashboard"}
            </span>
            <p className="relative mt-2 pl-5 text-[7.5px]" style={{ color: INK }}>
              <Tick t={t} at={-1} x={0} y={1} />
              <b>Redact:</b> replace people&apos;s names with Person 1, Person 2 and leave out descriptions and custom fields.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[7.5px]" style={{ color: INK }}>
              Expires after
              <span className="border px-1.5 py-0.5" style={{ borderColor: "#c9d2d6" }}>
                30 days ▾
              </span>
            </p>
            <span className="mt-2.5 inline-flex h-[18px] items-center px-2.5 text-[8px] font-semibold text-white" style={{ background: TEAL }}>
              {t >= 3600 && t < 4000 ? "Publishing…" : "Create link"}
            </span>
            {created ? (
              <Reveal t={t} at={4000} curtain="#ffffff" className="relative mt-4">
                <p className="text-[8px] font-semibold" style={{ color: TEAL }}>
                  My shared links
                </p>
                <p className="mt-1 border-t pt-1 text-[7.5px]" style={{ borderColor: "#dde3e6", color: INK }}>
                  <b className="underline">Riverside monthly</b>
                  <span style={{ color: SLATE }}> · 342 records, redacted, expires 23 Dec 2026</span>
                </p>
                <p className="mt-0.5 flex gap-3 text-[7.5px] underline" style={{ color: TEAL }}>
                  <span>Copy link</span>
                  <span style={{ color: "#b91c1c" }}>Delete</span>
                </p>
              </Reveal>
            ) : null}
          </Reveal>
        ) : null}
      </Card>

      {/* What someone outside Bailey sees: no sign-in, names replaced. */}
      <Reveal t={t} at={4300} className="absolute" style={{ left: 330, top: 40, width: 294, height: 344 }}>
        <div className="absolute inset-0 bg-white" style={{ boxShadow: "0 18px 40px -12px rgba(0,40,50,0.3)" }}>
          <div className="flex h-[16px] items-center gap-1 border-b px-2 text-[6.5px]" style={{ borderColor: "#dde3e6", background: "#f4f7f8", color: SLATE }}>
            <span className="h-[5px] w-[5px] rounded-full bg-[#c9d2d6]" />
            <span className="h-[5px] w-[5px] rounded-full bg-[#c9d2d6]" />
            <span className="ml-1 truncate">siteboard.baileypartnership.co.uk/view?s=4k2f9</span>
          </div>
          <div className="border-t-[2px] px-2 py-1.5" style={{ borderColor: CITRON }}>
            <p className="flex items-center gap-1 font-display text-[8px] font-semibold uppercase tracking-[0.12em]" style={{ color: TEAL }}>
              <SiteboardMark size={10} /> Siteboard · Riverside monthly
            </p>
            <p className="text-[6.5px]" style={{ color: SLATE }}>
              Data as of 23 Nov 2026. Link expires 23 Dec 2026
            </p>
          </div>
          <div className="mx-2 flex text-[6.5px] font-semibold" style={{ background: "#f4f7f8", color: SLATE }}>
            <span className="flex-[3] px-1 py-1">Title</span>
            <span className="flex-[2] px-1 py-1">Assigned to</span>
          </div>
          {PEOPLE.map(([title, who], i) => {
            const person = `Person ${["1", "2", "1", "3"][i]}`;
            const redactedNow = t >= 5200;
            return (
              <div key={title} className="mx-2 flex border-b text-[7.5px]" style={{ borderColor: "#dde3e6", color: INK }}>
                <span className="flex-[3] truncate px-1 py-1.5">{title}</span>
                <span className="relative flex-[2] px-1 py-1.5">
                  {redactedNow ? <b style={{ color: TEAL }}>{person}</b> : <span className="line-through decoration-[#b91c1c]">{who}</span>}
                </span>
              </div>
            );
          })}
          <p className="mx-2 mt-2 text-[6.5px]" style={{ color: SLATE }}>
            Descriptions and custom fields left out.
          </p>
        </div>
      </Reveal>
      <Reveal t={t} at={3900} until={6200} className="absolute" style={{ left: 330, bottom: 16 }}>
        <Toast>Link copied. Paste it in an email or chat.</Toast>
      </Reveal>
      <Reveal t={t} at={6000} className="absolute" style={{ left: 330, bottom: 16, width: 294 }}>
        <Toast tone={CITRON}>Untick Redact only for people who may see names. Delete a link to switch it off early.</Toast>
      </Reveal>
      <Cursor t={t} path={path} />
    </>
  );
}

// ---- 9. Make it yours

const COLUMNS = ["Project", "#", "Title", "Status", "Assigned to", "Due", "Created"];

function MakeItYours({ t }: SceneProps) {
  const hidden = t >= 1500;
  const pickerOpen = t >= 3500;
  const createdOff = t >= 4600;
  const path: Waypoint[] = [
    { t: 0, x: 540, y: 370 },
    { t: 1500, x: 306, y: 48, click: true },
    { t: 3500, x: 590, y: 136, click: true },
    { t: 4600, x: 470, y: 284, click: true },
    { t: 6600, x: 400, y: 370 },
  ];
  return (
    <>
      <Chrome active="Issues" />
      {hidden ? (
        <Reveal t={t} at={1500} className="absolute" style={{ left: 16, top: 40, width: 300 }}>
          <p className="flex justify-between border border-dashed bg-white/60 px-2 py-1.5 text-[7.5px]" style={{ borderColor: "#c9d2d6", color: SLATE }}>
            <span>
              <b style={{ color: INK }}>Issues by type</b> is hidden, and left out of the PDF and shared links.
            </span>
            <span className="underline" style={{ color: TEAL }}>
              Show
            </span>
          </p>
        </Reveal>
      ) : (
        <>
          <Bar x={16} y={40} w={300}>
            <span>Issues by type</span>
            <span className="text-[10px]">−</span>
          </Bar>
          <Card x={16} y={56} w={300} h={56}>
            <Lines n={4} x={10} y={12} w={270} />
          </Card>
        </>
      )}
      <Bar x={324} y={40} w={300}>
        <span>Age of outstanding issues</span>
        <span className="text-[10px]">−</span>
      </Bar>
      <Card x={324} y={56} w={300} h={56}>
        <Lines n={4} x={10} y={12} w={270} />
      </Card>
      <Bar x={16} y={124} w={608}>
        <span>Issue register (342)</span>
      </Bar>
      <Card x={16} y={140} w={608} h={244}>
        <span className="absolute right-3 top-2 flex h-[16px] items-center border px-2 text-[7.5px] font-semibold" style={{ borderColor: "#c9d2d6", color: TEAL }}>
          Columns ({createdOff ? 6 : 7})
        </span>
        <div className="absolute left-3 right-3 top-[26px] flex bg-[#f4f7f8] text-[7px] font-semibold" style={{ color: SLATE }}>
          {COLUMNS.filter((c) => !(createdOff && c === "Created")).map((c) => (
            <span key={c} className="flex-1 px-1 py-1">
              {c}
            </span>
          ))}
        </div>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="absolute left-3 right-3 h-[4px]" style={{ top: 48 + i * 18, background: "#dde3e6" }} />
        ))}
      </Card>
      {pickerOpen ? (
        <Reveal t={t} at={3500} curtain="#ffffff" className="absolute" style={{ right: 28, top: 162, width: 150 }}>
          <div className="border bg-white p-2 text-[8px]" style={{ borderColor: "#c9d2d6", boxShadow: "0 18px 40px -12px rgba(0,40,50,0.3)", color: INK }}>
            <p className="mb-1 text-[6.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#7c8a90" }}>
              Shown, in order
            </p>
            {COLUMNS.map((c, i) => (
              <p key={c} className="relative flex h-[16px] items-center pl-5">
                <Tick t={t} at={c === "Created" && createdOff ? null : -1} x={2} y={2} />
                {c}
                <span className="ml-auto text-[7px]" style={{ color: "#8a9398" }}>
                  {i ? "↑" : ""} ↓
                </span>
              </p>
            ))}
          </div>
        </Reveal>
      ) : null}
      <Reveal t={t} at={5600} className="absolute" style={{ left: 16, bottom: 16 }}>
        <p className="border-l-[3px] bg-white px-2.5 py-1.5 text-[8px]" style={{ borderColor: CITRON, color: INK, boxShadow: "0 18px 40px -12px rgba(0,40,50,0.3)" }}>
          <b>Layout saved.</b> Project sets remember it, and PDFs and links follow it.
        </p>
      </Reveal>
      <Cursor t={t} path={path} />
    </>
  );
}


export const SCENES: Scene[] = [
  {
    id: "pick",
    name: "Pick a dashboard",
    title: "Pick a dashboard",
    body: "Start on the templates page. Each dashboard covers one Forma tool: Issues, RFIs, Forms or Reviews.",
    tip: "The Siteboard mark in the header always brings you back here.",
    duration: 5200,
    Stage: PickDashboard,
  },
  {
    id: "projects",
    name: "Choose projects",
    title: "Choose your projects",
    body: "Tick the projects to include. Every hub you can access is listed together, so you can mix projects freely.",
    tip: "Name a selection and press Save set to reuse it later, layout and all.",
    duration: 7000,
    Stage: ChooseProjects,
  },
  {
    id: "load",
    name: "Watch it load",
    title: "Watch it load",
    body: "Siteboard reads your projects straight from Forma, so you only ever see what your own account can see. Big selections load in parallel.",
    tip: "Siteboard is read-only: it never changes anything in Forma.",
    duration: 5600,
    Stage: WatchItLoad,
  },
  {
    id: "filter",
    name: "Filter",
    title: "Filter in a click",
    body: "Click any bar, slice or name to filter the whole dashboard. The key figures, charts and register update together.",
    tip: "Reset filters clears everything in one go.",
    duration: 7000,
    Stage: FilterInAClick,
  },
  {
    id: "map",
    name: "Map",
    title: "See it on the map",
    body: "Pins close together merge into one. Zoom in and they split apart; tap a pin for its numbers, or to filter to that project.",
    tip: "Forms are placed by the postcode in their Forma location.",
    duration: 6800,
    Stage: SeeItOnTheMap,
  },
  {
    id: "3d",
    name: "3D view",
    title: "Explore in 3D",
    body: "3D view turns every record into a cube. Organise by any field, switch between towers, ring, timeline, map and galaxy, and click a cube for its details.",
    tip: "Drag to orbit, and scroll or pinch to zoom.",
    duration: 7000,
    dark: true,
    Stage: ExploreIn3D,
  },
  {
    id: "pdf",
    name: "PDF reports",
    title: "Download a PDF report",
    body: "Download PDF report turns what you're looking at into a branded A4 report: your filters, only the panels you show, and the register if Include register is ticked. Download CSV gives the register as a spreadsheet.",
    tip: "PDFs and CSVs carry full names and details, so keep them inside Bailey. To share outside, use a redacted link.",
    duration: 6400,
    Stage: PdfReports,
  },
  {
    id: "share",
    name: "Share a link",
    title: "Share a public link",
    body: "Share a link publishes a snapshot anyone can open without a Forma sign-in. Redact is on by default: names become Person 1, Person 2, and descriptions and custom fields are left out. Choose 7, 30 or 90 days before it expires.",
    tip: "A link is a snapshot of now and doesn't update. My shared links lists yours, so you can copy or delete them.",
    duration: 8200,
    Stage: ShareALink,
  },
  {
    id: "yours",
    name: "Make it yours",
    title: "Make it yours",
    body: "Hide the panels you don't need and choose the register's columns. Hidden panels are left out of PDFs and shared links.",
    tip: "Project sets remember your layout.",
    duration: 7400,
    Stage: MakeItYours,
  },
];
