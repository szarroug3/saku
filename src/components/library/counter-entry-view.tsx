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
// exactly one of the two content sections renders under the header. counterForm/
// numberConstructionFor stay LIVE reads — both small, self-contained data
// files with no dictionary dependency, so there's nothing to gain fetching
// them. The one heavy thing this page reads is itemHeadline's {text, speak},
// FETCHED BY ID by default (the Library route) — seeded per entry by
// scripts/seed-content-entries.mjs. `glyph` comes from library-index.ts's
// `libEntry` (checked to match buildItem's own glyph for both these kinds,
// unlike transitivity) rather than needing its own seed field.
//
// SAK-35 wired a counted form's genuinely irregular content (人's suppletive
// ひとり/ふたり/よにん, 本/匹/杯's hardening, …) onto the counter's OWN "how it's
// built" page, via number-construction.ts's counterIrregulars()-derived prose
// — a counted form's own "How you say it" section stays deliberately generic.
// The one gap that left, 二十歳 (irregular, but with no link to 〜歳's existing
// explanation of はたち), was closed by a Related section here that pointed
// out to that page. SAK-172 closed it differently: はたち is now a genuine
// Irregular row ON 〜歳's own page (number-construction.ts's `sai` spec), and
// 二十歳 no longer has a standalone page of its own to carry a Related link
// FROM (see COUNTER_TAIL_FORM_ALIASES in @/data/counters and entries.ts's
// COUNTER_CURRICULUM walk) — so the Related section, now unreachable by every
// remaining counted form (every other one is a 〜つ native with no rule page
// to link to), was removed rather than left dead.
//
// The teach walk (TeachItemView) and /dev/views already build a live
// ContentItem for every kind they show, so this also accepts an `item` prop
// that skips the fetch and reads the headline straight off it — same pattern
// as KanaEntryView/VerbPairEntryView.
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
import { PitchReading } from "@/components/library/pitch-mark";
import { HearButton } from "@/components/ui/hear-button";
import {
  counterForm,
  isBareNumber,
} from "@/data/counters";
import { wordPitch } from "@/data/pitch";
import { numberConstructionFor } from "@/data/number-construction";
import { useContentEntry } from "@/lib/library/content-entries";
import { getLibEntry } from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import type { Headline } from "@/lib/content/headline";
import type { ContentItem } from "@/lib/content/item";
import type { EntryId } from "@/types";

export function CounterEntryView({
  entry,
  item,
  liveHeadline,
  lesson = false,
}: {
  entry?: EntryId;
  item?: ContentItem;
  liveHeadline?: Headline;
  /** The SAME page in the lesson intro. The counter page shows the same thing in
   * both contexts today (unlike a word, whose lesson hides the readings it isn't
   * teaching), so this only reserves the seam for a future difference. */
  lesson?: boolean;
}) {
  void lesson;
  const fetched = useContentEntry<Headline>(item ? null : (entry ?? null));
  const headline = item ? liveHeadline : fetched;
  const resolvedEntry = item ? item.entry : entry!;
  // SAK-104: libEntry lives in a server-only module now, so the fallback
  // glyph lookup is fetched instead of imported — called unconditionally
  // (React hook rules), skipped (null args) once `item` already supplies the
  // glyph directly.
  const fetchedEntry = useServerLookup(getLibEntry, item ? null : [resolvedEntry]);
  const glyph = item ? item.glyph : fetchedEntry?.glyph;

  // The item is EITHER a counted form OR a construction rule; the two lookups are
  // mutually exclusive on a given entry (a form entry names no rule, and a rule
  // entry names no form), so at most one of these is non-null.
  const form = counterForm(resolvedEntry);
  const construction = numberConstructionFor(resolvedEntry);

  if (headline === undefined || headline === null || !glyph) return null;
  if (!form && !construction) return null;

  return (
    <EntrySurface>
      <ContentEntryHeader
        glyph={glyph}
        headline={headline}
        typeLabel={construction ? "counting rule" : "counter"}
      />

      {/* ---- COUNTED FORM: how you say it, and what it means ---- */}
      {form ? (
        <Section title="How you say it">
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
                    {/* SAK-170: most counted forms (ひとつ, さんぼん …) are
                        namespaced entry-key inventions, never real JMdict kanji
                        (see the "entry KEYS are namespaced" note at this file's
                        top), so wordPitch(form.glyph) is null for them — but a
                        real minority ARE ordinary JMdict headwords (whole
                        calendar dates, 二十歳): 15 of the 54 forms checked
                        against src/data/generated/pitch.json (~28%) carry a
                        verified downstep, so this is wired the same
                        downstep-exact way as character-entry-view.tsx rather
                        than skipped as "doesn't apply here". */}
                    {(() => {
                      const pitch = wordPitch(form.glyph);
                      return pitch !== null ? (
                        <>
                          <HearButton glyph={form.reading} downstep={pitch} />
                          <PitchReading
                            reading={form.reading}
                            downstep={pitch}
                            className="font-kana text-text"
                          />
                        </>
                      ) : (
                        <>
                          <HearButton glyph={form.reading} />
                          <span className="font-kana text-text">{form.reading}</span>
                        </>
                      );
                    })()}
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
        </Section>
      ) : null}

      {/* ---- GENERATIVE RULE: how the number/count is built ---- */}
      {construction ? (
        <Section title="How it's built">
          <Lead>{construction.summary}</Lead>
          {/* The lesson's own rule card, so the reference and the lesson cannot
              drift — prose, then the worked 1–10 (or hundreds-and-up) example
              table underneath it. */}
          <NumberConstructionView construction={construction} />
        </Section>
      ) : null}
    </EntrySurface>
  );
}
