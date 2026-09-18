"use client";

// The Lesson: tonight's picks, taught star by star. Tracked as SAK-306 to
// SAK-310.
//
// One call from the route, given the items, what is learned, the picks and
// what each star teaches. The heading stays put with "Step n of N" and the
// fixed Back and Next beside it; under it a two by two (SAK-446): the lesson
// sky with References beside it, and under those the card for the selected
// star with "Tonight, in order" beside it. Stars are the navigation: a step
// opens once the one before it has been opened, a known star is open from
// the start for reference, and a star opened stays lit. Order and locking
// come from src/sky/lib/lesson.ts over the graph.
//
// The order is what tonight TEACHES. What it rests on is the references
// (SAK-416): the stars already in the sky under tonight's items, and the
// terms and intros that apply to what is in the order. A reference opens
// on the constellation the way a taught star does and never moves the
// lesson on, because it is not one of the steps. Which of the two a star is
// in is settled when the lesson is built and does not change while it is
// open: see `beforeTonight` in src/app/(sky)/lesson.ts.
//
// A REFERENCE PAGE NOBODY HAS READ IS READ FIRST (SAK-467). The pages are
// what the order rests on, so a lesson holding pages this learner has never
// been shown opens on the first of them and Next walks the rest before step
// one. `openPages` is that list, worked out by the route from what it has
// shown before; the lesson itself only walks it. The counter does not move
// while a page is showing, the same as for any other reference opened: the
// lesson stands on step one the whole way through the lead, and the pages
// are never steps.

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
import { isUnlocked, lessonSteps, orderNote, starState, type LessonReference, type LessonTeach } from "@/sky/lib/lesson";
import { KIND_LABEL } from "@/sky/lib/tokens";
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

interface SkyLessonProps {
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
  /** Where a lesson left part way through is picked up (SAK-444): the star
   * the learner was on. A star the order no longer holds -- one opened last
   * time, which is in the sky now and so is not taught again -- opens the
   * lesson where it would have opened anyway, on the first step. */
  startAt?: string;
  /** The reference pages this lesson has never shown the learner, in the
   * order References lists them (SAK-467). The lesson opens on the first of
   * them and Next walks the rest before step one, so a page nobody has read
   * is read before the stars that rest on it. Empty for a lesson picked up
   * through Continue, which opens where it was left instead. */
  openPages?: readonly string[];
  /** Where the lesson stands: the step, how many steps the order holds, and
   * which star that step is. Said the moment the lesson opens and after every
   * step, because a lesson opened and left is a lesson to come back to (Sam,
   * 2026-09-17). Nothing here ever ends the lesson: the sitting runs on into
   * the drill's rounds, and the drill is what keeps it from there. */
  onPlace?: (place: { at: number; steps: number; star: string }) => void;
  height?: string;
}

/** One row of either list beside the card: a button that opens what it
 * names. A star is its glyph with its gloss beside it; a page is its name.
 * An eyebrow at the far end says what the row is, for a reference.
 *
 * items-center, not items-baseline (SAK-415). A row holds two sizes at
 * once, a 13px label with a 10.5px eyebrow or a 17px glyph with a 12.5px
 * gloss, and sharing a baseline hangs both of them off the taller one,
 * which left the whole row sitting high in its pill. Both parts center on
 * the row instead. One component for both lists so there is one row to
 * measure and one to keep centered. */
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
        {/* tight, and the margin it drops is load-bearing: centering a row
            centers each child's MARGIN box, so the four pixels below the
            eyebrow lifted it two above the row's middle (SAK-415). This was
            `!mb-0` until the prop learned to refuse an `mb-` class outright
            (SAK-432); `tight` says the same thing without the bang. */}
        {eyebrow && <Eyebrow tight className="ml-auto font-normal">{eyebrow}</Eyebrow>}
      </button>
    </li>
  );
}

export function SkyLesson({ data, drillHref, observatoryHref, written, hear, pitch, onOpen, startAt, openPages, onPlace, height }: SkyLessonProps) {
  const graph = useMemo(() => buildGraph(data.items), [data.items]);
  const learned = useMemo(() => new Set(data.learned), [data.learned]);
  const steps = useMemo(() => lessonSteps(graph, data.picks, learned), [graph, data.picks, learned]);
  const note = useMemo(() => orderNote(steps.map((s) => graph.itemOf(s.id)).filter((it): it is SkyItem => !!it)), [steps, graph]);
  const references = useMemo(() => data.references ?? [], [data.references]);
  const referenceOf = useMemo(() => new Map(references.map((r) => [r.id, r])), [references]);
  // Which step the lesson opens on: the one it was left on, when the order
  // still holds it, else the first. Everything up to it counts as opened,
  // since a step unlocks the one after it and a lesson resumed on step four
  // with three locked steps behind it could not be walked back through.
  const from = Math.max(0, startAt ? steps.findIndex((s) => s.id === startAt) : 0);
  // The pages to read before the order (SAK-467), kept to the ones this
  // lesson actually lists, so a stale id cannot strand the lesson on nothing.
  // A lesson picked up through Continue is handed none: it opens where it was
  // left (SAK-444), and its pages were shown the night it started.
  const lead = useMemo(() => (startAt ? [] : (openPages ?? []).filter((id) => referenceOf.get(id)?.page)), [openPages, referenceOf, startAt]);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set([...steps.slice(0, from + 1).map((s) => s.id), ...lead.slice(0, 1)]));
  const [selected, setSelected] = useState<string | null>(lead[0] ?? steps[from]?.id ?? null);
  // where the lesson stands. Apart from `selected` because a reference is
  // shown without being stepped to: reading one used to reset "Step n of N"
  // to the first step, since the count was read off whatever was showing.
  const [stepAt, setStepAt] = useState<string | null>(steps[from]?.id ?? null);
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
  // order keeps the selected row in view. Which box is the one that scrolls
  // depends on the width: the card's own cell beside the order, or, once the
  // four cells are a stack, the body around all of them (SAK-446).
  const body = useRef<HTMLDivElement>(null);
  const cardBox = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  useEffect(() => { cardBox.current?.scrollTo({ top: 0 }); body.current?.scrollTo({ top: 0 }); }, [selected, page]);
  useEffect(() => { rail.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest" }); }, [selected]);

  // Where the lesson stands, written down the moment it opens and after every
  // step (SAK-444), so the one Continue button can offer the lesson back the
  // way it offers a quiz. The OPENING step is reported too: a lesson opened
  // and left on step one is a lesson that was started, and leaving it out was
  // the reason such a lesson offered nothing at all (Sam, 2026-09-17). It is
  // safe to report now because the order no longer shrinks as stars are
  // opened (SAK-446), so a resumed lesson reports the same step of the same
  // order that sent the learner here rather than writing a shorter one over
  // it. The ref holds the star last reported, so what is reported is a MOVE
  // rather than a render, and an effect that re-ran because the data was
  // fetched again has nothing new to say.
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!stepAt || stepAt === reported.current) return;
    reported.current = stepAt;
    onPlace?.({ at: Math.max(0, steps.findIndex((s) => s.id === stepAt)), steps: steps.length, star: stepAt });
  }, [stepAt, steps, onPlace]);

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
  // Where in the lead the lesson is, or -1 once it is past it. Read off what
  // is showing rather than kept beside it: opening a lead page from
  // References puts the lesson back on the lead there and Next carries on
  // from it, and opening anything else leaves the lead for good.
  const leadAt = selected ? lead.indexOf(selected) : -1;
  // Nothing to teach is a state of its own, not step zero of zero (SAK-351).
  // Every pick was already in the sky, so there is no first step to be on and
  // no next one to walk to: `next` used to index past the end of an empty list
  // and throw, because `last` was false when there was no last.
  const nothing = steps.length === 0;
  // a lesson still in its lead is never on its last page, however short the
  // order is: the pages come first and the order still has to be walked
  const last = nothing || (leadAt < 0 && stepIndex === steps.length - 1 && lastPage);
  const back = () => {
    if (page > 0) return setPage(page - 1);
    const to = leadAt > 0 ? lead[leadAt - 1] : steps[stepIndex - 1].id;
    return open(to, pagesOf(to) - 1);
  };
  const next = () => {
    if (!lastPage) return setPage(page + 1);
    if (leadAt >= 0 && leadAt + 1 < lead.length) return open(lead[leadAt + 1]);
    // out of the lead and into the order, at the step the lesson is standing
    // on: step one for a lesson that opened on a page, which is what "Step 1
    // of N" has read the whole way through the lead
    return open(steps[leadAt >= 0 ? stepIndex : stepIndex + 1].id);
  };

  // the arrow keys page too: left is Back, right is Next (Sam's ask), unless
  // the keys are typing into something
  const canBack = !nothing && (page > 0 || leadAt > 0 || (leadAt < 0 && stepIndex > 0));
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
        // The drill is the next part of the same sitting, not the end of it
        // (SAK-444). Opening it used to throw the lesson away, which is what
        // left a learner mid-round with nothing to come back to; the drill
        // keeps the sitting from here.
        <SkyButton href={drillHref}>Drill</SkyButton>
      ) : (
        <SkyButton disabled={last} onClick={next}>Next</SkyButton>
      )}
    </div>
  );

  return (
    <SkyPageShell eyebrow="Lesson" title="Tonight's lesson" aside={nav} height={height}>
      {/* The two by two (SAK-446). The sky and References across the top, the
          card and "Tonight, in order" under them, in ONE grid with two rows,
          so each row's two panels are exactly as tall as each other rather
          than two columns agreeing by eye. The cells are placed by row and
          column, which leaves the DOM in the order the narrow stack wants:
          sky, details, Tonight, References. Below lg the grid is off, the
          four are that stack, and the body scrolls (it used to clip, so on a
          narrow window References was drawn past the bottom edge with no way
          to reach it). */}
      <div ref={body} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[minmax(180px,42%)_minmax(0,1fr)] lg:overflow-hidden">
        {/* nothing to rest on leaves no hole: the sky takes the whole top row */}
        <div data-lesson-cell="sky" className={`relative h-[28%] min-h-[150px] shrink-0 overflow-hidden rounded-2xl border border-sky-line md:h-[42%] md:min-h-[180px] lg:col-start-1 lg:row-start-1 lg:h-auto lg:min-h-0 lg:shrink ${references.length ? "" : "lg:col-span-2"}`}>
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
        {/* bottom left: the card, which scrolls inside its own cell beside
            the order. Below lg it is as tall as it is and the body scrolls. */}
        <div data-lesson-cell="card" ref={cardBox} className="min-h-0 shrink-0 lg:col-start-1 lg:row-start-2 lg:shrink lg:overflow-y-auto lg:pr-1">
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
              <p className="mt-2 text-[14px] text-sky-muted">Everything picked is already in your sky. There is no lesson to give you, so pick something new, or practice what you have.</p>
            </SkyPanel>
          )}
        </div>
        {/* bottom right: the order, as tall as the card beside it. Each panel
            scrolls inside itself now that each owns a cell of its own; the
            column that used to scroll them both (SAK-416) is gone with the
            column. */}
        <div data-lesson-cell="order" className="flex min-h-0 shrink-0 lg:col-start-2 lg:row-start-2 lg:shrink">
          <SkyPanel title="Tonight, in order" className="flex h-full min-h-0 w-full flex-col !p-4">
            {/* why the order runs the way it does, when tonight has a shape
                to explain; nothing at all when it does not (SAK-464) */}
            {note && <p className="mt-1 shrink-0 text-[12px] text-sky-muted">{note}</p>}
            <ol ref={rail} className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto lg:pr-1">
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
        </div>
        {/* top right, beside the sky and exactly as tall as it: what tonight
            rests on. Nothing here is a step, so a row wears no lock and
            opening one leaves "Step n of N" where it was. An empty list is
            not a panel (SAK-416) and not a cell either (SAK-446).

            A page's eyebrow is the KIND word, the one the Atlas and the
            Observatory use for the same thing (SAK-432). It used to be the
            page's own name for itself, "Intro" or "Sound shift", so the
            intro behind 電 read INTRO in the rail and sat under Terms in
            the Atlas. Sam: "it should say term." A star already in the sky
            is not a kind of thing but a reason to be in this list, so it
            keeps saying so. */}
        {references.length > 0 && (
          <div data-lesson-cell="references" className="flex min-h-0 shrink-0 lg:col-start-2 lg:row-start-1 lg:shrink">
            <SkyPanel title="References" className="flex h-full min-h-0 w-full flex-col !p-4">
              <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto lg:pr-1">
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
                      eyebrow={r.page ? KIND_LABEL[r.kind] : "In your sky"}
                      onClick={() => open(r.id)}
                    />
                  );
                })}
              </ul>
            </SkyPanel>
          </div>
        )}
      </div>
    </SkyPageShell>
  );
}
