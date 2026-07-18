"use client";

// "How it's written" — the stroke-order section, collapsed by default and OFF
// by default on purpose.
//
// THE OWNER'S RULE, MADE INTO A SECTION
// =====================================
// A beginner is here to READ. They are unlikely to be handwriting Japanese any
// time soon, and drilling stroke order on the day you meet a character is effort
// spent on a skill you don't need yet. So this section keeps its head down: one
// honest line when collapsed, and it only opens if you ask — and whether it
// opens is a PERSISTED preference (see lesson-prefs.ts), not per-lesson state,
// so the learner who does want to write sets it open once and every character
// after it respects that.
//
// WHAT IT SHOWS WHEN OPEN
// =======================
// Not the animated diagram — that data (KanjiVG / strokesvg) isn't ingested yet,
// and the brief is explicit that this must not block on it. So when open it
// shows what the existing data DOES know: for a kanji built entirely from parts
// that are themselves jōyō kanji, the component breakdown (the same "every
// component has its own card" test kanjiCost uses); otherwise the stroke count;
// and for kana, that it's learned as a whole shape. The animated diagram is left
// as a clearly-marked TODO rather than a blank box. And the "why?" — why order
// matters, and that it's okay to do it your own way — sits behind the same pull.

import Link from "next/link";

import { WhyDisclosure } from "@/components/lesson/why";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { WHY_STROKE_ORDER } from "@/data/why";
import type { LessonItem } from "@/lib/lesson-items";
import { useLessonPref } from "@/lib/lesson-prefs";
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

export function HowItsWritten({ item }: { item: LessonItem }) {
  const [open, setOpen] = useLessonPref("writing");

  const row = item.kind === "kanji" ? kanjiRow(item.glyph) : undefined;
  const parts = item.kind === "kanji" ? teachableParts(item.glyph) : null;

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
        // The one line the collapsed section owes — the owner's own reasoning,
        // said plainly, with the door left open.
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
          We don&rsquo;t recommend learning to write yet — you&rsquo;re unlikely
          to be handwriting Japanese, and it&rsquo;s not worth the effort this
          early. Expand it if you want to.
        </p>
      ) : (
        <div className="mt-2.5">
          {/* What the existing data knows about the shape. */}
          {parts ? (
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
          ) : row ? (
            <p className="text-[13px] text-text-muted">
              <span className="text-text">
                {row.strokes} stroke{row.strokes === 1 ? "" : "s"}
              </span>{" "}
              — learned as a whole shape for now.
            </p>
          ) : (
            <p className="text-[13px] text-text-muted">
              Learned as a whole shape — no need to break it into strokes.
            </p>
          )}

          {/* The animated diagram is not here yet, and the section says so
              rather than pretending. Stroke-order data (KanjiVG / strokesvg) is
              a separate ingest — see the brief's scope note. */}
          <p className="mt-2.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-[11px] leading-relaxed text-text-muted/80">
            TODO · animated stroke-order diagram — the stroke data isn&rsquo;t
            ingested yet, so there&rsquo;s no drawing to show here.
          </p>

          {/* Why order matters, and that your own way is fine for now. */}
          <WhyDisclosure why={WHY_STROKE_ORDER} />
        </div>
      )}
    </div>
  );
}
