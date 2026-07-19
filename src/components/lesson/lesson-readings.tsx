"use client";

// The kanji readings, MINIMISED — collapsed by default, on the same persisted
// preference as "how it's written" (see lesson-prefs.ts).
//
// WHY MINIMISED, AND WHY NOT DRILLED
// ==================================
// You just met this kanji. Its readings are the answers to questions later
// words will ask — セイ is what 学生 tests — and you cannot read them yet, on the
// day you learned the shape. So they are here to be SEEN, not studied: the
// section stays shut unless you open it, and even open it is a reference. The
// drill never asks a reading until a word unlocks it (the existing gate, in
// word-unlock.ts); this screen changes none of that.
//
// It reads the same table the Library entry page reads (factRows), so what you
// see here and what you'd see on the entry page cannot drift — richest-evidence
// reading first, each anchored to the everyday words that prove it.

import { meaningFactId } from "@/data/kanji";
import type { LessonItem } from "@/lib/lesson-items";
import { useLessonPref } from "@/lib/lesson-prefs";
import { factRows, libEntry } from "@/lib/library/entries";

export function LessonReadings({ item }: { item: LessonItem }) {
  const [open, setOpen] = useLessonPref("readings");

  const entry = libEntry(item.entry);
  if (!entry) return null;
  // Every fact but the meaning — the meaning is the headword above, and this
  // section is the readings. Filter by id (a lookup), not by label text.
  const meaning = meaningFactId(item.glyph);
  const rows = factRows(entry).filter((r) => r.id !== meaning);
  if (!rows.length) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-panel px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium">
          Readings{" "}
          <span className="text-[11px] font-normal text-text-muted">
            · {rows.length}
          </span>
        </p>
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
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
          You only just learned this character, so you can&rsquo;t read these yet,
          and the app won&rsquo;t ask for one until a word teaches it. Here if you
          want a look.
        </p>
      ) : (
        <div className="mt-2.5">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] font-medium text-text-muted">
                <th className="py-1.5 pr-2 font-medium">Reading</th>
                <th className="py-1.5 font-medium">Heard in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="py-2 pr-2 align-middle">
                    <span className="text-[15px]">{r.label}</span>
                    {r.answer && r.answer !== r.label ? (
                      <span className="ml-1.5 text-text-muted">({r.answer})</span>
                    ) : null}
                  </td>
                  <td className="py-2 align-middle text-text-muted">
                    {r.askedIn.length ? (
                      <span className="font-kana text-text">
                        {r.askedIn.slice(0, 3).join(" · ")}
                      </span>
                    ) : r.unattested ? (
                      <span className="text-[11px] italic">rarer: here, never asked</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-relaxed text-text-muted/80">
            Not drilled yet. Each reading unlocks when you learn a word that
            uses it.
          </p>
        </div>
      )}
    </div>
  );
}
