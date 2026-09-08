"use client";

// The Lesson: tonight's picks, taught star by star. Tracked as SAK-306 to
// SAK-310.
//
// One call from the route, given the items, what is learned, the picks and
// what each star teaches. The heading stays put with "Step n of N" and the
// fixed Back and Next beside it; under it the lesson sky, then the card for
// the selected star, "Tonight, in order" and, under that, "References".
// Stars are the navigation: a step opens once the one before it has been
// opened, a known star is open from the start for reference, and a star
// opened stays lit. Order and locking come from src/sky/lib/lesson.ts over
// the graph.
//
// The order is what tonight TEACHES. What it rests on is the references
// (SAK-416): the stars already in the sky under tonight's items, and the
// terms and intros that apply to what is in the order. A reference opens
// on the constellation the way a taught star does and never moves the
// lesson on, because it is not one of the steps.

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
import { isUnlocked, lessonSteps, starState, type LessonReference, type LessonTeach } from "@/sky/lib/lesson";
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
  /** What tonight rests on and does not teach: the stars already in the
   * sky under tonight's items, and the terms and intros behind them. */
  references?: readonly LessonReference[];
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

/** One row of either list beside the card: a button that opens what it
 * names. A star is its glyph with its gloss beside it; a page is its name.
 * An eyebrow at the far end says what the row is, for a reference.
 *
 * items-center, not items-baseline (SAK-415). A row holds two sizes at
 * once, a 13px label with a 10.5px eyebrow or a 17px glyph with a 12.5px
 * gloss, and sharing a baseline hangs both of them off the taller one,
 * which left the whole row sitting high in its pill. Both parts centre on
 * the row instead. One component for both lists so there is one row to
 * measure and one to keep centred. */
function RailRow({ current, locked = false, lit, glyph, label, eyebrow, onClick }: {
  /** What the row is current for: a step of the order, or a reference. */
  current?: "step" | "true";
  locked?: boolean;
  lit: boolean;
  glyph?: string;
  label?: string;
  eyebrow?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={current}
        aria-disabled={locked || undefined}
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left ${current ? "border-sky-accent bg-sky-accent/10" : "border-transparent"} ${locked ? "cursor-not-allowed opacity-45" : "hover:bg-sky-card-strong"}`}
      >
        {glyph !== undefined && (
          <span className={`shrink-0 whitespace-nowrap font-sky-display text-[17px] leading-none ${lit ? "text-sky-ink" : "text-sky-muted"} ${japaneseFont(glyph)}`}>{glyph}</span>
        )}
        {label !== undefined && (
          <span className={glyph !== undefined ? "text-[12.5px] text-sky-muted" : `text-[13px] ${lit ? "text-sky-ink" : "text-sky-muted"}`}>{label}</span>
        )}
        {/* !mb-0, and the bang is load-bearing: `Eyebrow` writes its own
            mb-1 into the same class list, and Tailwind orders mb-1 after
            mb-0, so a plain mb-0 here loses. Centring a row centres each
            child's MARGIN box, so those four pixels below the eyebrow
            lifted it two above the row's middle (SAK-415). */}
        {eyebrow && <Eyebrow className="ml-auto !mb-0 font-normal">{eyebrow}</Eyebrow>}
      </button>
    </li>
  );
}

export function SkyLesson({ data, drillHref, observatoryHref, written, hear, pitch, onOpen, height }: SkyLessonProps) {
  const graph = useMemo(() => buildGraph(data.items), [data.items]);
  const learned = useMemo(() => new Set(data.learned), [data.learned]);
  const steps = useMemo(() => lessonSteps(graph, data.picks, learned), [graph, data.picks, learned]);
  const references = useMemo(() => data.references ?? [], [data.references]);
  const referenceOf = useMemo(() => new Map(references.map((r) => [r.id, r])), [references]);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set(steps.length ? [steps[0].id] : []));
  const [selected, setSelected] = useState<string | null>(steps[0]?.id ?? null);
  // where the lesson stands. Apart from `selected` because a reference is
  // shown without being stepped to: reading one used to reset "Step n of N"
  // to the first step, since the count was read off whatever was showing.
  const [stepAt, setStepAt] = useState<string | null>(steps[0]?.id ?? null);
  // which page of the selected star is showing, for a star taught over several
  const [page, setPage] = useState(0);
  const stepIndex = Math.max(0, steps.findIndex((s) => s.id === stepAt));
  const stepOf = (id: string) => steps.findIndex((s) => s.id === id);
  const pagesOf = (id: string) => (referenceOf.get(id)?.page?.teach ?? data.teach[id])?.pages?.length ?? 1;

  /** Open a star: a step only when unlocked; a reference any time, without
   * moving the lesson on. Opens on its first page unless told otherwise. */
  const open = (id: string, at = 0) => {
    const i = stepOf(id);
    if (i >= 0 && !isUnlocked(steps, i, opened)) return;
    if (i >= 0 && !opened.has(id) && !learned.has(id)) onOpen?.(id);
    setOpened((o) => new Set([...o, id]));
    setSelected(id);
    if (i >= 0) setStepAt(id);
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

  // a reference that is a page has no star and no item, so it carries its
  // own card; a reference that is a known star is an item like any other
  const openPage = selected ? referenceOf.get(selected)?.page : undefined;
  const current = selected && !openPage ? graph.itemOf(selected) : undefined;
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
            {openPage ? (
              // a page is the same card a star gets (Sam, 2026-09-05), with
              // nothing under it and nothing to hear of its own
              <LessonCard className="min-h-full" item={openPage.item} teach={openPage.teach} madeOf={[]} partOf={[]} hear={hear} pitch={pitch} page={page} onPage={setPage} onSelect={open} />
            ) : current ? (
              <LessonCard
                className="min-h-full"
                item={current}
                teach={data.teach[current.id]}
                madeOf={itemsOf(graph.prerequisitesOf(current.id))}
                partOf={itemsOf(graph.dependentsOf(current.id).filter((d) => tonight.has(d)))}
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
          {/* one scroller for both lists, not one inside each: two panels
              each scrolling in its own third of the column hid the end of
              the order behind a list of references (SAK-416). Each panel is
              as tall as its content, as SAK-359 left it. */}
          <div className="flex min-h-0 flex-col gap-4 self-stretch overflow-y-auto pr-1">
            <SkyPanel title="Tonight, in order" className="!p-4 shrink-0">
              <p className="mt-1 text-[12px] text-sky-muted">Pieces first, then the character, then the word.</p>
              <ol ref={rail} className="mt-3 flex flex-col gap-1">
                {steps.map((s, i) => {
                  const it = graph.itemOf(s.id);
                  const state = stateOf(s.id);
                  return (
                    <RailRow
                      key={s.id}
                      current={state === "selected" ? "step" : undefined}
                      locked={!isUnlocked(steps, i, opened)}
                      lit={state === "lit" || state === "selected"}
                      glyph={it?.glyph}
                      label={it?.english !== it?.glyph ? it?.english : undefined}
                      onClick={() => open(s.id)}
                    />
                  );
                })}
              </ol>
            </SkyPanel>
            {/* what tonight rests on. Nothing here is a step, so a row wears
                no lock and opening one leaves "Step n of N" where it was. An
                empty list is not a panel (SAK-416). */}
            {references.length > 0 && (
              <SkyPanel title="References" className="!p-4 shrink-0">
                <ul className="mt-3 flex flex-col gap-1">
                  {references.map((r) => {
                    const it = r.page ? undefined : graph.itemOf(r.id);
                    const state = stateOf(r.id);
                    return (
                      <RailRow
                        key={r.id}
                        current={state === "selected" ? "true" : undefined}
                        lit={state === "lit" || state === "selected"}
                        glyph={it?.glyph}
                        label={it ? (it.english !== it.glyph ? it.english : undefined) : r.label}
                        eyebrow={r.page ? r.page.kind : "In your sky"}
                        onClick={() => open(r.id)}
                      />
                    );
                  })}
                </ul>
              </SkyPanel>
            )}
          </div>
        </div>
      </div>
    </SkyPageShell>
  );
}
