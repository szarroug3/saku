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
// If we have KanjiVG stroke data for the glyph (all base hiragana today, see
// src/lib/strokes.ts + scripts/ingest/kanjivg.mjs), it renders the real thing:
// an animated draw-along plus the numbered step-by-step chart (StrokeOrder). The
// data is lazy — nothing is fetched until the section is expanded. For a glyph
// with no data yet (katakana, kanji), it FALLS BACK gracefully to what the
// existing data knows: a kanji's component breakdown, or the stroke count, or
// "whole shape" — never a crash, never a blank box.
//
// COLLAPSED / PERSISTED
// =====================
// Still collapsible, still a persisted preference (see lesson-prefs.ts): set it
// open once and every character respects that. The collapsed prompt is now
// inviting, not discouraging — expanding shows real stroke order.

import Link from "next/link";

import { StrokeOrder } from "@/components/lesson/stroke-order";
import { WhyDisclosure } from "@/components/lesson/why";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { WHY_STROKE_ORDER } from "@/data/why";
import type { LessonItem } from "@/lib/lesson-items";
import { useLessonPref } from "@/lib/lesson-prefs";
import { useGlyphStrokes } from "@/lib/strokes";
import { entryHref } from "@/lib/library/href";

/** The jōyō components of a kanji, EXCLUDING itself — the same test kanjiCost
 * uses for a "known radical". Returns them only when EVERY component is itself a
 * jōyō kanji with a card; otherwise null, which the caller reads as "fall back
 * to strokes". Raw KRADFILE comps (｜ ノ マ) are never shown: they are unreliable
 * for teaching and half of them have no page to link. */
function teachableParts(glyph: string): Array<{ c: string; meaning: string }> | null {
  const row = kanjiRow(glyph);
  if (!row) return null;
  const parts = row.comps.filter((c) => c !== glyph);
  if (!parts.length) return null;
  if (!parts.every((c) => kanjiRow(c) !== undefined)) return null;
  return parts.map((c) => ({
    c,
    meaning: kanjiRow(c)?.meanings[0] ?? "",
  }));
}

/** The whole-shape fallback, shown when there's no stroke data for the glyph.
 * A kanji made of teachable parts shows the breakdown; otherwise the stroke
 * count if we have it; otherwise the plain "whole shape" line. */
function WholeShapeFallback({ item }: { item: LessonItem }) {
  const row = item.kind === "kanji" ? kanjiRow(item.glyph) : undefined;
  const parts = item.kind === "kanji" ? teachableParts(item.glyph) : null;

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

  if (row) {
    return (
      <p className="text-[13px] text-text-muted">
        <span className="text-text">
          {row.strokes} stroke{row.strokes === 1 ? "" : "s"}
        </span>{" "}
        — the stroke-order diagram for this one isn&rsquo;t in yet.
      </p>
    );
  }

  return (
    <p className="text-[13px] text-text-muted">
      Learned as a whole shape — the stroke-order diagram for this one
      isn&rsquo;t in yet.
    </p>
  );
}

export function HowItsWritten({ item }: { item: LessonItem }) {
  const [open, setOpen] = useLessonPref("writing");
  // Lazy — the stroke asset is only fetched once the section is open. Skipping
  // the lookup while collapsed keeps the chunk off the initial load entirely.
  const strokes = useGlyphStrokes(open ? item.glyph : "");

  return (
    <div className="mt-3 rounded-lg border border-border bg-panel px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium">How it&rsquo;s written</p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="cursor-pointer rounded-md border border-border bg-card px-2 py-0.5 text-[11px] leading-none text-text-muted hover:bg-panel hover:text-text"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {!open ? (
        // Inviting, not discouraging: it's worth learning, and here's why.
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
          Stroke order is worth learning — draw a character the standard way and
          it comes out balanced and legible. Expand to see how this one is
          drawn.
        </p>
      ) : (
        <div className="mt-2.5">
          {strokes.status === "loading" ? (
            <p className="text-[13px] text-text-muted">Loading stroke order&hellip;</p>
          ) : strokes.data ? (
            // The real thing: animated draw-along + numbered step chart.
            <StrokeOrder data={strokes.data} />
          ) : (
            // No stroke data for this glyph yet — degrade, don't crash.
            <WholeShapeFallback item={item} />
          )}

          {/* Why order matters — reframed as worth learning, not "your own way". */}
          <WhyDisclosure why={WHY_STROKE_ORDER} />
        </div>
      )}
    </div>
  );
}
