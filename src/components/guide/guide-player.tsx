"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWidth } from "@/components/charts/use-width";
import { H, useClock, W } from "./kit";
import { SCENES } from "./scenes";

const GAP = 700; // pause at the end of each scene before the next starts

// "How to use Siteboard": eight short animated scenes with a step track.
// Plays through on its own; click a step, use the arrows or press the
// arrow keys and space to drive it yourself.
export function GuidePlayer() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [run, setRun] = useState(0); // bumps to replay the current scene
  const scene = SCENES[step]!;
  const t = useClock(playing, `${step}:${run}`);
  const last = step === SCENES.length - 1;
  const finished = last && t >= scene.duration;

  const go = useCallback((i: number) => {
    setStep(Math.max(0, Math.min(SCENES.length - 1, i)));
    setRun((r) => r + 1);
    setPlaying(true);
  }, []);

  // Move on when a scene ends; stop after the last one.
  useEffect(() => {
    if (!playing) return;
    if (t < scene.duration + (last ? 0 : GAP)) return;
    if (last) setPlaying(false);
    else go(step + 1);
  }, [t, playing, scene.duration, last, step, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, select, textarea")) return;
      if (e.key === "ArrowRight") go(step + 1);
      else if (e.key === "ArrowLeft") go(step - 1);
      else if (e.key === " ") {
        e.preventDefault();
        if (finished) go(0);
        else setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, go, finished]);

  const [boxRef, width] = useWidth<HTMLDivElement>();
  const scale = width ? width / W : 1;
  const progress = Math.min(1, t / scene.duration);
  const Stage = scene.Stage;

  return (
    <section>
      {/* Hero band with the step track. */}
      <div className="sb-enter relative bg-[color:var(--bp-teal-deep)] px-5 pb-0 pt-5 text-white sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Guide</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-10 tracking-[0.01em] text-white sm:text-4xl">
              <span className="text-[color:var(--bp-citron)]">How to use</span> Siteboard
            </h2>
            <p className="mt-1.5 text-sm text-white/75">Eight short steps, about a minute in all.</p>
          </div>
          <Link href="/templates" className="text-sm font-semibold text-white underline decoration-white/40 underline-offset-4">
            Back to dashboards
          </Link>
        </div>
        <ol className="mt-5 grid gap-1" style={{ gridTemplateColumns: `repeat(${SCENES.length}, minmax(0, 1fr))` }}>
          {SCENES.map((s, i) => (
            <li key={s.id} className="min-w-0">
              <button type="button" onClick={() => go(i)} className="group block w-full pb-3 text-left" aria-current={i === step ? "step" : undefined} aria-label={`Step ${i + 1}: ${s.title}`}>
                <span className="block h-1.5 bg-white/15">
                  <span
                    className="block h-full origin-left"
                    style={{
                      background: i === step ? "var(--bp-citron)" : "rgba(255,255,255,0.55)",
                      transform: `scaleX(${i < step ? 1 : i === step ? progress : 0})`,
                    }}
                  />
                </span>
                <span className={`mt-1 hidden truncate text-[11px] leading-4 sm:block ${i === step ? "font-semibold text-white" : "text-white/55 group-hover:text-white/80"}`}>{s.name}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* The stage: a 640 x 400 miniature, scaled to fit. */}
        <div>
          <div ref={boxRef} className="relative w-full overflow-hidden bg-[color:var(--bp-desk)] shadow-hp-lg ring-1 ring-[color:var(--bp-rule)]" style={{ aspectRatio: `${W} / ${H}` }}>
            <div
              key={`${step}:${run}`}
              className={`absolute left-0 top-0 origin-top-left select-none ${playing ? "" : "sb-paused"}`}
              style={{ width: W, height: H, transform: `scale(${scale})`, background: "var(--bp-desk)" }}
              aria-hidden
            >
              <Stage t={t} />
            </div>
            {finished ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,57,74,0.82)] backdrop-blur-[2px]">
                <div className="sb-enter relative bg-white p-6 text-center shadow-hp-xl" style={{ ["--curtain" as string]: "#00394a" }}>
                  <p className="bp-label">That&apos;s it</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-[color:var(--bp-ink)]">You&apos;re ready to go</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Link href="/templates" className="sb-sheen inline-flex items-center bg-[color:var(--bp-teal)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[color:var(--bp-teal-dark)]">
                      Open the dashboards →
                    </Link>
                    <button type="button" onClick={() => go(0)} className="border border-[color:var(--bp-rule)] bg-white px-3.5 py-2 text-sm font-semibold text-[color:var(--bp-ink)] hover:bg-[color:var(--bp-fill)]">
                      Watch again
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className={CTRL}>
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => (finished ? go(0) : setPlaying((p) => !p))}
              className="sb-sheen inline-flex min-h-9 items-center gap-2 bg-[color:var(--bp-teal)] px-3.5 text-sm font-semibold text-white shadow-hp-sm transition-[background-color,transform] duration-150 hover:bg-[color:var(--bp-teal-dark)] active:scale-[0.97]"
            >
              {finished ? "Watch again" : playing ? (
                <>
                  <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
                    <path d="M1 0h3v12H1zM6 0h3v12H6z" fill="currentColor" />
                  </svg>
                  Pause
                </>
              ) : (
                <>
                  <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
                    <path d="M0 0l10 6-10 6z" fill="currentColor" />
                  </svg>
                  Play
                </>
              )}
            </button>
            <button type="button" onClick={() => go(step)} className={CTRL}>
              Replay step
            </button>
            <button type="button" onClick={() => go(step + 1)} disabled={last} className={CTRL}>
              Next →
            </button>
            <span className="ml-auto hidden text-xs text-[color:var(--slate-600)] sm:inline">Arrow keys move between steps; space pauses.</span>
          </div>
        </div>

        {/* What this step shows. Revealed afresh for each step. */}
        <div key={step} className="sb-enter relative self-start border-l-4 border-[color:var(--bp-teal)] bg-white p-5 shadow-hp-sm">
          <p className="bp-label">
            Step {step + 1} of {SCENES.length}
          </p>
          <h3 className="mt-1 font-display text-2xl font-semibold leading-8 text-[color:var(--bp-ink)]">{scene.title}</h3>
          <p className="mt-3 text-sm leading-6 text-[color:var(--slate-700)]">{scene.body}</p>
          <p className="mt-4 bg-[color:var(--bp-citron-tint)] px-3 py-2 text-sm text-[color:var(--bp-citron-ink)] shadow-[inset_3px_0_0_var(--bp-citron)]">{scene.tip}</p>
        </div>
      </div>
    </section>
  );
}

const CTRL =
  "inline-flex min-h-9 items-center border border-[color:var(--bp-rule)] bg-white px-3 text-sm font-semibold text-[color:var(--bp-ink)] transition-[background-color,transform] duration-150 hover:bg-[color:var(--bp-fill)] active:scale-[0.97] disabled:opacity-40";
