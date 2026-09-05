"use client";

// The Lesson: tonight's picks, taught star by star. Tracked as SAK-306 to
// SAK-310.
//
// One call from the route, given the items, what is learned, the picks and
// what each star teaches. The heading stays put with "Step n of N" and the
// fixed Back and Next beside it; under it the lesson sky, then the card for
// the selected star and "Tonight, in order". Stars are the navigation: a
// step opens once the one before it has been opened, a known star is open
// from the start for reference, and a star opened stays lit. Order and
// locking come from src/sky/lib/lesson.ts over the graph.

import { useMemo, useState, type ReactNode } from "react";

import type { StarLook } from "@/sky/components/constellation";
import { LessonCard, LessonPageCard, type HearComponent } from "@/sky/components/lesson-card";
import { SkyField } from "@/sky/components/sky-field";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { buildGraph } from "@/sky/lib/graph";
import { japaneseFont } from "@/sky/lib/japanese";
import { isUnlocked, lessonSteps, starState, type LessonPage, type LessonTeach } from "@/sky/lib/lesson";
import type { SkyItem } from "@/sky/lib/types";

export interface SkyLessonData {
  /** Every pick and everything under it, plus what the learner has. */
  items: readonly SkyItem[];
  /** What is already in the sky: open for reference, never a step. */
  learned: readonly string[];
  /** Tonight's picks, in the order they were picked. */
  picks: readonly string[];
  /** What the card teaches, by star. */
  teach: Readonly<Record<string, LessonTeach>>;
  /** The pages read between the stars: intros, terms, sound shifts. */
  pages?: readonly LessonPage[];
}

export interface SkyLessonProps {
  data: SkyLessonData;
  /** Where Next goes after the last step: the drill. */
  drillHref?: string;
  /** "How it's written" per star, from whoever has the stroke order. */
  written?: Readonly<Record<string, ReactNode>>;
  /** A button that speaks a reading, from whoever has the voice. */
  hear?: HearComponent;
  height?: string;
}

const BTN = "rounded-[10px] px-3.5 py-2 text-[13px] font-semibold";

export function SkyLesson({ data, drillHref, written, hear, height }: SkyLessonProps) {
  const graph = useMemo(() => buildGraph(data.items), [data.items]);
  const learned = useMemo(() => new Set(data.learned), [data.learned]);
  const steps = useMemo(() => lessonSteps(graph, data.picks, learned, data.pages ?? []), [graph, data.picks, learned, data.pages]);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set(steps.length ? [steps[0].id] : []));
  const [selected, setSelected] = useState<string | null>(steps[0]?.id ?? null);
  const stepIndex = Math.max(0, steps.findIndex((s) => s.id === selected));
  const stepOf = (id: string) => steps.findIndex((s) => s.id === id);

  /** Open a star: a step only when unlocked; a known star any time, without moving the lesson on. */
  const open = (id: string) => {
    const i = stepOf(id);
    if (i >= 0 && !isUnlocked(steps, i, opened)) return;
    setOpened((o) => new Set([...o, id]));
    setSelected(id);
  };
  const stateOf = (id: string) => starState(steps, id, opened, selected);
  // the selected star is simply lit: the rail and the card say which it is
  // (Sam's call, 2026-09-05: no accent on the constellation)
  const lookOf = (id: string, base: StarLook): StarLook => {
    switch (stateOf(id)) {
      case "selected":
      case "lit": return learned.has(id) ? base : { ...base, lit: true };
      case "open": return learned.has(id) ? base : { ...base, tonight: true };
      case "locked": return { ...base, standing: "not-seen", tonight: false };
    }
  };
  const noteOf = (id: string) => {
    const state = stateOf(id);
    if (state === "locked") { const i = stepOf(id); return `after ${graph.itemOf(steps[i - 1].id)?.english ?? ""}`; }
    if (learned.has(id) && state !== "lit") return "already in your sky";
    return undefined;
  };

  const currentStep = steps.find((s) => s.id === selected);
  const current = selected && !currentStep?.page ? graph.itemOf(selected) : undefined;
  const tonight = useMemo(() => new Set(steps.map((s) => s.id).concat(data.picks)), [steps, data.picks]);
  // only what is being taught is drawn: a pick with nothing left to teach stays off the sky
  const taught = useMemo(() => data.picks.filter((p) => steps.some((s) => s.pick === p)), [data.picks, steps]);
  const itemsOf = (ids: readonly string[]) => ids.map((id) => graph.itemOf(id)).filter((x): x is SkyItem => !!x && !x.group);
  const last = stepIndex === steps.length - 1;

  const nav = (
    <div className="flex items-center gap-2 font-sky-ui text-[13px] text-sky-muted">
      <span className="tabular-nums">Step {Math.min(stepIndex + 1, steps.length)} of {steps.length}</span>
      <button type="button" disabled={stepIndex === 0} onClick={() => open(steps[stepIndex - 1].id)} className={`${BTN} border border-sky-line text-sky-ink disabled:border-transparent disabled:text-sky-faint`}>Back</button>
      {last && drillHref ? (
        <a href={drillHref} className={`${BTN} bg-sky-accent text-sky-accent-ink`}>Drill</a>
      ) : (
        <button type="button" disabled={last} onClick={() => open(steps[stepIndex + 1].id)} className={`${BTN} bg-sky-accent text-sky-accent-ink disabled:bg-sky-card-strong disabled:text-sky-faint`}>Next</button>
      )}
    </div>
  );

  return (
    <SkyPageShell eyebrow="Lesson" title="Tonight's lesson" lede="Tonight's picks, taught piece by piece. Click a star to open it." aside={nav} height={height}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="relative h-[42%] min-h-[180px] shrink-0 overflow-hidden rounded-2xl border border-sky-line">
          <SkyField
            items={data.items}
            roots={taught}
            graph={graph}
            width={1120}
            height={400}
            pad={40}
            baseSize={56}
            fill
            lookOf={lookOf}
            briefTooltip
            tooltipNote={noteOf}
            onStarClick={open}
            starDisabled={(id) => stateOf(id) === "locked"}
            seed="lesson"
            label="Tonight's constellations, with a star for every piece, character and word"
          />
        </div>
        <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-h-0 self-stretch overflow-y-auto pr-1">
            {currentStep?.page ? (
              <LessonPageCard page={currentStep.page} className="min-h-full" />
            ) : current ? (
              <LessonCard
                className="min-h-full"
                item={current}
                teach={data.teach[current.id]}
                madeOf={itemsOf(graph.prerequisitesOf(current.id))}
                partOf={itemsOf(graph.dependentsOf(current.id).filter((d) => tonight.has(d)))}
                known={learned.has(current.id)}
                written={written?.[current.id]}
                hear={hear}
                onSelect={open}
              />
            ) : (
              <SkyPanel title="Nothing to teach"><p className="mt-2 text-[14px] text-sky-muted">Everything picked is already in your sky.</p></SkyPanel>
            )}
          </div>
          <SkyPanel title="Tonight, in order" className="flex min-h-0 flex-col self-stretch !p-4">
            <p className="mt-1 shrink-0 text-[12px] text-sky-muted">Pieces first, then the character, then the word. Stars already in your sky are not listed; they are open on the constellation for reference.</p>
            <ol className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {steps.map((s, i) => {
                const it = graph.itemOf(s.id);
                const locked = !isUnlocked(steps, i, opened);
                const state = stateOf(s.id);
                if (s.page) {
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-current={state === "selected" ? "step" : undefined}
                        aria-disabled={locked || undefined}
                        onClick={() => open(s.id)}
                        className={`flex w-full items-baseline gap-2 rounded-lg border px-2.5 py-1.5 text-left ${state === "selected" ? "border-sky-accent bg-sky-accent/10" : "border-transparent"} ${locked ? "cursor-not-allowed opacity-45" : "hover:bg-sky-card-strong"}`}
                      >
                        <span className={`text-[13px] ${state === "lit" || state === "selected" ? "text-sky-ink" : "text-sky-muted"}`}>{s.page.title}</span>
                        <span className="ml-auto text-[10.5px] uppercase tracking-[0.08em] text-sky-muted">{s.page.kind}</span>
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-current={state === "selected" ? "step" : undefined}
                      aria-disabled={locked || undefined}
                      onClick={() => open(s.id)}
                      className={`flex w-full items-baseline gap-2 rounded-lg border px-2.5 py-1.5 text-left ${state === "selected" ? "border-sky-accent bg-sky-accent/10" : "border-transparent"} ${locked ? "cursor-not-allowed opacity-45" : "hover:bg-sky-card-strong"}`}
                    >
                      <span className={`shrink-0 whitespace-nowrap font-sky-display text-[17px] leading-none ${state === "lit" || state === "selected" ? "text-sky-ink" : "text-sky-muted"} ${japaneseFont(it?.glyph ?? "")}`}>{it?.glyph}</span>
                      <span className="text-[12.5px] text-sky-muted">{it?.english}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </SkyPanel>
        </div>
      </div>
    </SkyPageShell>
  );
}
