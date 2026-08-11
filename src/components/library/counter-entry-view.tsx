"use client";

// COUNTER / NUMBER entry — the redesigned Library page for one item on the
// "Numbers & counters" shelf. Two shapes share the shelf and this page:
//
//   - a COUNTED FORM (三本 · さんぼん, ひとつ, 二十歳 · はたち) — a memorised word
//     that welds a number to a thing you count, carried by @/data/counters;
//   - a GENERATIVE RULE (11–99, hundreds and up, 〜本 …) — not a word but a way
//     to BUILD a number, carried by @/data/number-construction.
//
//   header
//   How you say it   — the reading(s) + meaning of a counted form (form only)
//   How it's built    — the construction rule + worked examples (rule only)
//
// A given item is one OR the other, never both: an entry either resolves to a
// counterForm (the form shape) or a numberConstructionFor (the rule shape), so
// exactly one section renders under the header. Reference data only — the same
// two sources the live router reads; nothing here is invented.
//
// NO "Built from" here. A word's "Built from" splits its reading across its
// kanji off a verified alignment; a counter carries no such alignment, and the
// one sound this shelf teaches is the shift a naive split gets wrong (本 → ぼん),
// so a reading-per-kanji breakdown would be exactly the mis-split we refuse.
// NO stroke section either: these are multi-character forms and rules, not one
// drawable glyph.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section } from "@/components/library/entry-section";
import { NumberConstructionView } from "@/components/library/number-construction-view";
import { SoundIcon } from "@/components/ui";
import {
  counterForm,
  isBareNumber,
  isKanaForm,
} from "@/data/counters";
import { numberConstructionFor } from "@/data/number-construction";
import { speak } from "@/lib/speech";
import type { ContentItem } from "@/lib/content/item";

export function CounterEntryView({
  item,
  lesson = false,
}: {
  item: ContentItem;
  /** The SAME page in the lesson intro. The counter page shows the same thing in
   * both contexts today (unlike a word, whose lesson hides the readings it isn't
   * teaching), so this only reserves the seam for a future difference; the
   * example tables are dropped in both. */
  lesson?: boolean;
}) {
  void lesson;
  // The item is EITHER a counted form OR a construction rule; the two lookups are
  // mutually exclusive on a given entry (a form entry names no rule, and a rule
  // entry names no form), so at most one of these is non-null.
  const form = counterForm(item.entry);
  const construction = numberConstructionFor(item.entry);

  if (!form && !construction) return null;

  // 〜つ is the general counter, worth calling out on its own pages.
  const isTsu = form?.counter === "つ";

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      {/* ---- COUNTED FORM: how you say it, and what it means ---- */}
      {form ? (
        <Section
          title="How you say it"
          tone="accent"
        >
          <Lead>
            {isBareNumber(form)
              ? "The number on its own, and what it counts to."
              : "A counting word joins a number to the thing you count, and you say the two as one word."}
          </Lead>
          <table className="w-full text-[14px]">
            <tbody>
              <tr>
                <td className="whitespace-nowrap py-1 pr-6 align-top">
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => speak(form.reading, "")}
                      aria-label={`Hear ${form.reading}`}
                      className="flex-none cursor-pointer border-none bg-transparent p-0 leading-none text-accent"
                    >
                      <SoundIcon />
                    </button>
                    <span className="font-kana text-text">{form.reading}</span>
                    {/* A second reading the same number branches into — く beside
                        きゅう. It is a READING, so it rides beside the primary reading,
                        never in the meaning. Absent (empty) for every current form. */}
                    {form.altReading ? (
                      <span className="text-[13px] text-text-muted">
                        <span className="font-kana">{form.altReading}</span> beside{" "}
                        <span className="font-kana">{form.reading}</span>
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="w-full py-1 align-top text-text-muted">{form.meaning}</td>
              </tr>
            </tbody>
          </table>
          {isTsu ? (
            <p className="mt-4 text-[13px] leading-relaxed text-text-muted">
              〜つ works when nothing else does and can count almost anything up to ten. When you
              don&rsquo;t know the right counter, this one still works, and you&rsquo;ll be
              understood.
            </p>
          ) : null}
        </Section>
      ) : null}

      {/* ---- GENERATIVE RULE: how the number/count is built ---- */}
      {construction ? (
        <Section title="How it's built" tone="accent">
          <Lead>{construction.summary}</Lead>
          {/* The lesson's own rule card, so the reference and the lesson cannot
              drift. Example tables dropped: each counter's exceptions are stated in
              its prose, so the full 1–10 tables were more than the page needs. */}
          <NumberConstructionView construction={construction} hideExamples />
        </Section>
      ) : null}
    </EntrySurface>
  );
}
