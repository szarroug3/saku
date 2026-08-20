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
//   Related          — a counted form's link to its counter's rule page, when
//                       one exists (form only; see numberConstructionForCounterGlyph)
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
// SAK-35: a counted form's "How you say it" section is deliberately generic —
// it says what a counting word IS, not what is irregular about this one, and
// that irregular content (人's suppletive ひとり/ふたり/よにん, 本/匹/杯's hardening,
// …) already lives entirely on the counter's OWN "how it's built" page, wired
// from number-construction.ts's counterIrregulars()-derived prose. The one gap
// was 二十歳: a genuinely irregular counted form with a sibling rule page (〜歳)
// that already explains はたち, but no link from 二十歳's own page to it. The
// Related section below closes that gap with the EXISTING 〜歳 prose, not new
// copy — see numberConstructionForCounterGlyph's doc comment.
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
import { RelatedSection, type RelatedLink } from "@/components/library/related-section";
import { HearButton } from "@/components/ui/hear-button";
import {
  counterForm,
  isBareNumber,
} from "@/data/counters";
import {
  numberConstructionEntry,
  numberConstructionFor,
  numberConstructionForCounterGlyph,
} from "@/data/number-construction";
import { useContentEntry } from "@/lib/library/content-entries";
import { getEntryHref, getLibEntry } from "@/lib/library/server-lookups";
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
  // SAK-104: libEntry/entryHref live in server-only modules now, so the
  // fallback glyph lookup and the related-construction href are fetched
  // instead of imported. Both are called unconditionally (React hook rules) —
  // skipped (null args) once `item` already supplies the glyph directly, or
  // there's no related construction to link.
  const fetchedEntry = useServerLookup(getLibEntry, item ? null : [resolvedEntry]);
  const glyph = item ? item.glyph : fetchedEntry?.glyph;

  // The item is EITHER a counted form OR a construction rule; the two lookups are
  // mutually exclusive on a given entry (a form entry names no rule, and a rule
  // entry names no form), so at most one of these is non-null.
  const form = counterForm(resolvedEntry);
  const construction = numberConstructionFor(resolvedEntry);

  // A memorised counted form's own "how it's built" page, when its counter has
  // one — 二十歳's page links to 〜歳, which already explains (in its own,
  // already-authored prose) that はたち is the one irregular count 〜歳 has. A
  // bare number (isBareNumber) and every 〜つ form correctly find nothing here:
  // 〜つ is native memorisation with no rule page (see
  // numberConstructionForCounterGlyph's own doc comment).
  const relatedConstruction =
    form && !isBareNumber(form) ? numberConstructionForCounterGlyph(form.counter) : undefined;
  const relatedHref = useServerLookup(
    getEntryHref,
    relatedConstruction ? [numberConstructionEntry(relatedConstruction.id)] : null,
  );
  const relatedLinks: RelatedLink[] =
    relatedConstruction && relatedHref
      ? [{ label: relatedConstruction.name, href: relatedHref }]
      : [];

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
                    <HearButton glyph={form.reading} />
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

      {/* A counted form's link to its counter's own "how it's built" page —
          absent (RelatedSection renders nothing) for a bare number and for
          every 〜つ form, which has no rule page to link to. */}
      <RelatedSection links={relatedLinks} />
    </EntrySurface>
  );
}
