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

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { StarLook } from "@/sky/components/constellation";
import { LessonCard, type HearComponent, type PitchComponent } from "@/sky/components/lesson-card";
import { SkyField } from "@/sky/components/sky-field";
import { SkyButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
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
  /** Where to send someone whose picks are all already learned, since there
   * is no lesson to walk them through (SAK-351). */
  observatoryHref?: string;
  /** "How it's written" per star, from whoever has the stroke order. */
  written?: Readonly<Record<string, ReactNode>>;
  /** A button that speaks a reading, from whoever has the voice. */
  hear?: HearComponent;
  /** A reading with its pitch drawn over it, from whoever draws it. */
  pitch?: PitchComponent;
  /** A star opened for the first time this lesson: it enters rotation now. */
  onOpen?: (id: string) => void;
  height?: string;
}

export function SkyLesson({ data, drillHref, observatoryHref, written, hear, pitch, onOpen, height }: SkyLessonProps) {
  const graph = useMemo(() => buildGraph(data.items), [data.items]);
  const learned = useMemo(() => new Set(data.learned), [data.learned]);
  const steps = useMemo(() => lessonSteps(graph, data.picks, learned, data.pages ?? []), [graph, data.picks, learned, data.pages]);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set(steps.length ? [steps[0].id] : []));
  const [selected, setSelected] = useState<string | null>(steps[0]?.id ?? null);
  // which page of the selected star is showing, for a star taught over several
  const [page, setPage] = useState(0);
  const stepIndex = Math.max(0, steps.findIndex((s) => s.id === selected));
  const stepOf = (id: string) => steps.findIndex((s) => s.id === id);
  const pagesOf = (id: string) => data.teach[id]?.pages?.length ?? 1;

  /** Open a star: a step only when unlocked; a known star any time, without
   * moving the lesson on. Opens on its first page unless told otherwise. */
  const open = (id: string, at = 0) => {
    const i = stepOf(id);
    if (i >= 0 && !isUnlocked(steps, i, opened)) return;
    if (i >= 0 && !opened.has(id) && !learned.has(id)) onOpen?.(id);
    setOpened((o) => new Set([...o, id]));
    setSelected(id);
    setPage(at);
  };
  const stateOf = (id: string) => starState(steps, id, opened, selected);
  // the selected star wears the accent (Sam's call, 2026-09-05)
  const lookOf = (id: string, base: StarLook): StarLook => {
    switch (stateOf(id)) {
      case "selected": return { ...base, emphasis: true };
      case "lit": return learned.has(id) ? base : { ...base, lit: true };
      case "open": return learned.has(id) ? base : { ...base, tonight: true };
      case "locked": return { ...base, standing: "not-seen", tonight: false };
    }
  };

  // the card scrolls back to its top for each star and each page, and the
  // order keeps the selected row in view
  const cardBox = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  useEffect(() => { cardBox.current?.scrollTo({ top: 0 }); }, [selected, page]);
  useEffect(() => { rail.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest" }); }, [selected]);

  const currentStep = steps.find((s) => s.id === selected);
  const current = selected && !currentStep?.page ? graph.itemOf(selected) : undefined;
  const tonight = useMemo(() => new Set(steps.map((s) => s.id).concat(data.picks)), [steps, data.picks]);
  // only what is being taught is drawn: a pick with nothing left to teach stays off the sky
  const taught = useMemo(() => data.picks.filter((p) => steps.some((s) => s.pick === p)), [data.picks, steps]);
  const itemsOf = (ids: readonly string[]) => ids.map((id) => graph.itemOf(id)).filter((x): x is SkyItem => !!x && !x.group);
  // Next and Back walk a star's pages before they move between stars, so a
  // rule taught over five pages is read through; Back into such a star
  // lands on its last page. The lesson ends on the last page of the last star.
  const pageCount = selected ? pagesOf(selected) : 1;
  const lastPage = page >= pageCount - 1;
  // Nothing to teach is a state of its own, not step zero of zero (SAK-351).
  // Every pick was already in the sky, so there is no first step to be on and
  // no next one to walk to: `next` used to index past the end of an empty list
  // and throw, because `last` was false when there was no last.
  const nothing = steps.length === 0;
  const last = nothing || (stepIndex === steps.length - 1 && lastPage);
  const back = () => (page > 0 ? setPage(page - 1) : open(steps[stepIndex - 1].id, pagesOf(steps[stepIndex - 1].id) - 1));
  const next = () => (lastPage ? open(steps[stepIndex + 1].id) : setPage(page + 1));

  // the arrow keys page too: left is Back, right is Next (Sam's ask), unless
  // the keys are typing into something
  const canBack = !nothing && !(stepIndex === 0 && page === 0);
  // ONE subscription, for the life of the lesson. This effect had no
  // dependency list, so it re-ran on every render: each page turn, each star
  // opened, each keystroke tore the window listener off and put a new one
  // back, and the handler that was reading `canBack` and `last` was a
  // different closure every time. The handler goes in a ref that each render
  // refreshes, and the listener reads the ref, so what runs is always the
  // latest and nothing is added or removed after mount. SAK-370 gave the
  // Quiz's keys the same shape; this is the copy it left behind.
  const pressed = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
    if (e.key === "ArrowLeft" && canBack) { e.preventDefault(); back(); }
    if (e.key === "ArrowRight" && !last) { e.preventDefault(); next(); }
  };
  const onKey = useRef(pressed);
  useEffect(() => { onKey.current = pressed; });
  useEffect(() => {
    const key = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const nav = nothing ? (
    <div className="flex items-center gap-2 font-sky-ui text-[13px] text-sky-muted">
      {observatoryHref && <SkyButton href={observatoryHref}>Pick something to learn</SkyButton>}
    </div>
  ) : (
    <div className="flex items-center gap-2 font-sky-ui text-[13px] text-sky-muted">
      <span className="tabular-nums">Step {Math.min(stepIndex + 1, steps.length)} of {steps.length}</span>
      <SkyButton variant="outline" disabled={!canBack} onClick={back}>Back</SkyButton>
      {last && drillHref ? (
        <SkyButton href={drillHref}>Drill</SkyButton>
      ) : (
        <SkyButton disabled={last} onClick={next}>Next</SkyButton>
      )}
    </div>
  );

  return (
    <SkyPageShell eyebrow="Lesson" title="Tonight's lesson" aside={nav} height={height}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="relative h-[28%] min-h-[150px] shrink-0 overflow-hidden rounded-2xl border border-sky-line md:h-[42%] md:min-h-[180px]">
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
            briefTooltip={(id) => stateOf(id) === "locked"}
            onStarClick={open}
            starDisabled={(id) => stateOf(id) === "locked"}
            fog
            seed="lesson"
            label="Tonight's constellations, with a star for every piece, character and word"
          />
        </div>
        <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div ref={cardBox} className="min-h-0 self-stretch overflow-y-auto pr-1">
            {currentStep?.page ? (
              // a page is the same card a star gets (Sam, 2026-09-05), with
              // nothing under it and nothing to hear of its own
              <LessonCard className="min-h-full" item={currentStep.page.item} teach={currentStep.page.teach} madeOf={[]} partOf={[]} known={false} hear={hear} pitch={pitch} page={page} onPage={setPage} onSelect={open} />
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
                pitch={pitch}
                page={page}
                onPage={setPage}
                onSelect={open}
              />
            ) : (
              <SkyPanel title="Nothing to teach">
                <p className="mt-2 text-[14px] text-sky-muted">Everything picked is already in your sky. There is no lesson to walk through, so pick something new, or practise what you have.</p>
              </SkyPanel>
            )}
          </div>
          <SkyPanel title="Tonight, in order" fit className="!p-4">
            <p className="mt-1 shrink-0 text-[12px] text-sky-muted">Pieces first, then the character, then the word. Stars already in your sky are not listed; they are open on the constellation for reference.</p>
            <ol ref={rail} className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {steps.map((s, i) => {
                const it = graph.itemOf(s.id);
                const locked = !isUnlocked(steps, i, opened);
                const state = stateOf(s.id);
                const row = (children: ReactNode) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-current={state === "selected" ? "step" : undefined}
                      aria-disabled={locked || undefined}
                      onClick={() => open(s.id)}
                      className={`flex w-full items-baseline gap-2 rounded-lg border px-2.5 py-1.5 text-left ${state === "selected" ? "border-sky-accent bg-sky-accent/10" : "border-transparent"} ${locked ? "cursor-not-allowed opacity-45" : "hover:bg-sky-card-strong"}`}
                    >
                      {children}
                    </button>
                  </li>
                );
                const lit = state === "lit" || state === "selected";
                if (s.page) {
                  return row(<>
                    <span className={`text-[13px] ${lit ? "text-sky-ink" : "text-sky-muted"}`}>{s.page.item.english}</span>
                    <Eyebrow className="ml-auto mb-0 font-normal">{s.page.kind}</Eyebrow>
                  </>);
                }
                return row(<>
                  <span className={`shrink-0 whitespace-nowrap font-sky-display text-[17px] leading-none ${lit ? "text-sky-ink" : "text-sky-muted"} ${japaneseFont(it?.glyph ?? "")}`}>{it?.glyph}</span>
                  {it?.english !== it?.glyph && <span className="text-[12.5px] text-sky-muted">{it?.english}</span>}
                </>);
              })}
            </ol>
          </SkyPanel>
        </div>
      </div>
    </SkyPageShell>
  );
}
