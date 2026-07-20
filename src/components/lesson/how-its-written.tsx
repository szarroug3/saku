"use client";

// "How it's written" — the stroke-order section. Collapsed by default, opened on
// a persisted preference; when open it shows the REAL stroke order.
//
// THE SECTION, AND WHAT CHANGED
// =============================
// This used to keep its head down: the owner's line was that a beginner is here
// to READ and shouldn't bother with writing, so the collapsed prompt talked the
// learner out of it and the open state showed a TODO where a diagram belonged.
// That stance is reversed. Stroke order genuinely matters — follow it and shapes
// come out balanced and legible, and handwriting-recognition input and paper
// dictionaries both assume the standard order — so the section now teaches it
// properly instead of apologising for existing.
//
// WHAT IT SHOWS WHEN OPEN
// =======================
// If we have KanjiVG stroke data for the glyph (every base kana and every jōyō
// kanji, see src/lib/strokes.ts + scripts/ingest/kanjivg.mjs), it renders the
// real thing: an animated draw-along plus the numbered step-by-step chart
// (StrokeOrder). The data is lazy — nothing is fetched until the section is
// expanded, and then it is one chunk, not the whole set. For a glyph with no
// data (a non-jōyō kanji), it FALLS BACK gracefully to what the existing data
// knows: a kanji's component breakdown, or the stroke count, or "whole shape" —
// never a crash, never a blank box.
//
// COLLAPSED / PERSISTED
// =====================
// Still collapsible, still a persisted preference (see lesson-prefs.ts): set it
// open once and every character respects that. The collapsed prompt is now
// inviting, not discouraging — expanding shows real stroke order.

import Link from "next/link";
import { useId, useState } from "react";

import { StrokeOrder } from "@/components/lesson/stroke-order";
import { WhyDisclosure } from "@/components/lesson/why";
import { Card } from "@/components/ui";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { radicalByGlyph } from "@/data/radicals";
import { WHY_STROKE_ORDER, WHY_WRITING_EARLY } from "@/data/why";
// The parts test lives in lib now, because the drill's hint builder asks it too
// and the lesson and the hint must never disagree about what 明 is made of.
import { teachableParts } from "@/lib/kanji-parts";
import type { LessonItem } from "@/lib/lesson-items";
import { useLessonPref } from "@/lib/lesson-prefs";
import { useGlyphStrokes } from "@/lib/strokes";
import { entryHref } from "@/lib/library/href";

/** The whole-shape fallback, shown when there's no stroke data for the glyph.
 * A kanji made of teachable parts shows the breakdown; otherwise the stroke
 * count if we have it; otherwise the plain "whole shape" line.
 *
 * `reference` is the Library entry page. There the parts breakdown is SUPPRESSED
 * — not because it is wrong, but because that page's Links section already
 * carries a "Made of" row, and printing the same components twice on one screen
 * reads as two different claims. The lesson keeps it: a walk-through has no
 * Links section, so the breakdown is the only place the parts appear. */
function WholeShapeFallback({
  item,
  reference = false,
}: {
  item: LessonItem;
  reference?: boolean;
}) {
  const row = item.kind === "kanji" ? kanjiRow(item.glyph) : undefined;
  const radRow = item.kind === "radical" ? radicalByGlyph(item.glyph) : undefined;
  const parts = item.kind === "kanji" && !reference ? teachableParts(item.glyph) : null;

  if (parts) {
    return (
      <div className="text-[13px]">
        <p className="text-text-muted">Built from parts you learn on their own:</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {parts.map((p, i) => (
            <span key={`${p.c}-${i}`} className="flex items-center gap-2">
              {i > 0 ? <span className="text-text-muted">+</span> : null}
              <Link
                href={entryHref(kanjiEntry(p.c))}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-text no-underline hover:bg-panel"
              >
                <span className="text-[20px] leading-none">{p.c}</span>
                <span className="text-[11px] text-text-muted">{p.meaning}</span>
              </Link>
            </span>
          ))}
        </div>
      </div>
    );
  }

  const strokes = row?.strokes ?? radRow?.strokes;
  if (strokes !== undefined) {
    return (
      <p className="text-[13px] text-text-muted">
        <span className="text-text">
          {strokes} stroke{strokes === 1 ? "" : "s"}
        </span>
        , and the stroke-order diagram for this one isn&rsquo;t in yet.
      </p>
    );
  }

  return (
    <p className="text-[13px] text-text-muted">
      Learned as a whole shape. The stroke-order diagram for this one
      isn&rsquo;t in yet.
    </p>
  );
}

/** The stepped lesson's "how it's written" body: the "we don't recommend
 * learning to write early" notice, with the full reasoning folded behind a
 * "why?". Reads its lede and paragraphs from WHY_WRITING_EARLY so the wording
 * lives in one place (src/data/why.ts).
 *
 * Its own disclosure, not the shared WhyDisclosure, for two reasons: it adds one
 * app-specific line the shared, language-only Why component must never carry (the
 * "use the Show button" out), and its open state must be OWNED HERE so it
 * survives the reader pressing Show — the notice stays mounted while the diagram
 * appears below it, so opening the writing does not collapse the why.
 *
 * `open` is the section's Show state: once the diagram is already showing, the
 * "use Show to see it" paragraph would contradict the screen, so it is dropped. */
function WritingEarlyNotice({ open }: { open: boolean }) {
  const [why, setWhy] = useState(false);
  const panelId = useId();
  return (
    <div className="mt-2">
      <p className="text-[13px] leading-relaxed">
        <span className="font-medium">{WHY_WRITING_EARLY.lede.strong}</span>{" "}
        <button
          type="button"
          aria-expanded={why}
          aria-controls={panelId}
          onClick={() => setWhy((v) => !v)}
          className="cursor-pointer whitespace-nowrap rounded border-none bg-transparent p-0 text-[13px] text-accent underline decoration-dotted underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {why ? "Less" : "Why?"}
        </button>
      </p>

      {why ? (
        <div
          id={panelId}
          className="mt-2.5 flex flex-col gap-2.5 text-[13px] leading-relaxed text-text-muted"
        >
          {WHY_WRITING_EARLY.paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {!open ? (
            <p>
              That being said, if you would prefer to learn how to write now,
              expand this section using the{" "}
              <span className="font-medium">Show</span> button above and you will
              see stroke order step by step as well as in an animation.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function HowItsWritten({
  item,
  alwaysOpen = false,
}: {
  item: LessonItem;
  /** Render the section EXPANDED with no Show/Hide control — the Library entry
   * page, which is a reference you read rather than a walk you step through, so
   * hiding the diagram behind a toggle would just be a click between you and the
   * thing you came for. In this mode the section renders NOTHING at all when the
   * glyph has no stroke data, rather than an empty box with a heading: the lesson
   * gets a graceful whole-shape fallback because it is walking you through every
   * character in turn, but a reference page with nothing to show should not
   * announce itself. Defaults to false, so the stepped lesson keeps its
   * collapsible, persisted-preference behaviour untouched. */
  alwaysOpen?: boolean;
}) {
  const [pref, setOpen] = useLessonPref("writing");
  const open = alwaysOpen || pref;
  // Lazy — the stroke asset is only fetched once the section is open. Skipping
  // the lookup while collapsed keeps the chunk off the initial load entirely.
  const strokes = useGlyphStrokes(open ? item.glyph : "");

  // WHEN THERE IS STILL NO DIAGRAM. The jōyō kanji have stroke data now
  // (src/lib/strokes.ts, chunked), so this path is no longer what a normal kanji
  // page takes — but it is still reachable, for a kanji outside the ingested
  // set. There the honest thing to show is not nothing: the stroke COUNT is real
  // data, it is the one thing about the writing the app can state without
  // guessing, and a reference page that knows a glyph is 5 strokes should say
  // so.
  //
  // That is the whole difference between this and "announcing an absence". A
  // glyph we know NOTHING about — no count, no row — still renders nothing
  // rather than an empty heading.
  const hasFallback =
    (item.kind === "kanji" && kanjiRow(item.glyph) !== undefined) ||
    (item.kind === "radical" && radicalByGlyph(item.glyph) !== undefined);
  if (alwaysOpen && strokes.status === "loading") return null;
  if (alwaysOpen && strokes.status === "ready" && !strokes.data && !hasFallback) {
    return null;
  }

  const diagram =
    strokes.status === "loading" ? (
      <p className="text-[13px] text-text-muted">Loading stroke order&hellip;</p>
    ) : strokes.data ? (
      // The real thing: animated draw-along + numbered step chart.
      <StrokeOrder data={strokes.data} />
    ) : (
      // No stroke data for this glyph yet — degrade, don't crash.
      <WholeShapeFallback item={item} reference={alwaysOpen} />
    );

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium">How it&rsquo;s written</p>
        {alwaysOpen ? null : (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!pref)}
            className="cursor-pointer rounded-md border border-border bg-card px-2 py-0.5 text-[11px] leading-none text-text-muted hover:bg-panel hover:text-text"
          >
            {open ? "Hide" : "Show"}
          </button>
        )}
      </div>

      {alwaysOpen ? (
        // Library reference: the diagram is the thing you came for, always open,
        // with the encouraging "worth learning" why pinned to the bottom edge so
        // the box stretches to its row's height.
        <div className="mt-2.5 flex flex-1 flex-col">
          {diagram}
          <div className="mt-auto">
            <WhyDisclosure why={WHY_STROKE_ORDER} />
          </div>
        </div>
      ) : (
        // Stepped lesson: the "not yet" notice is ALWAYS mounted, so opening the
        // diagram with Show never collapses its why. Show just reveals the
        // stroke order below the notice.
        <>
          <WritingEarlyNotice open={open} />
          {open ? <div className="mt-3">{diagram}</div> : null}
        </>
      )}
    </>
  );

  // TWO MATERIALS, ONE COMPONENT. Inside the stepped lesson this is a section
  // NESTED in a card, so it wears nested-panel material: --panel, the smaller
  // radius, the tighter padding. On the Library entry page (the one and only
  // alwaysOpen caller) it is a TOP-LEVEL box sitting directly beside a Card,
  // and panel material next to card material reads as a different surface — so
  // there it IS a Card, sharing the card token, radius, padding and frost.
  if (alwaysOpen) {
    return <Card className="flex h-full flex-col">{content}</Card>;
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-panel px-3.5 py-3">
      {content}
    </div>
  );
}
