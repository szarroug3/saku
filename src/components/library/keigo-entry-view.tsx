"use client";

// KEIGO entry — the redesigned Library page for one honorific/humble SET (the
// eat/drink set: 食べる・飲む → 召し上がる / いただく). A keigo set is neither a
// glyph nor a single fact; it is a plain verb the learner already knows and the
// two polite verbs that stand in for it depending on whose action it is. The page
// shows:
//
//   header             — the plain verb (hero) + the shared meaning + "keigo"
//   Everyday verb (accent) — the plain verb(s) the set replaces, with readings
//   Polite forms (accent)  — the honorific and humble forms (KeigoSetView)
//   The bigger picture     — a link to the politeness-levels concept
//
// The forms come from the SAME KeigoSetView the teach walk and the entry router
// mount, so the reference and the lesson cannot draw a set two different ways.
// `showLead={false}` drops the view's own plain-verb/meaning lead — the header
// and the "Everyday verb" section carry those, so a lead here would repeat them.
//
// keigoSetForEntry (data/keigo.ts) stays a LIVE read: a small, self-contained
// file with no dictionary dependency. FETCHED BY ID by default (the Library
// route) is itemHeadline's {text, speak}, seeded per set. The hero glyph comes
// from library-index.ts. The teach walk / /dev/views pass a live `item` instead.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section } from "@/components/library/entry-section";
import { HearButton } from "@/components/ui/hear-button";
import { keigoSetForEntry } from "@/data/keigo";
import { grammarConceptEntry, libEntry } from "@/lib/library/library-index";
import { entryHref } from "@/lib/library/href";
import { useContentEntry } from "@/lib/library/content-entries";
import { hasKanji } from "@/lib/romaji";
import type { Headline } from "@/lib/content/headline";
import type { ContentItem } from "@/lib/content/item";
import type { EntryId } from "@/types";

interface KeigoPayload {
  readonly text: string;
  readonly speak: string | null;
}

// Per-register label (accent) + the "when do I use this" line, shown as text
// under the label and leading into the form.
const REGISTER: Record<string, { label: string; desc: string }> = {
  honorific: {
    label: "Honorific",
    desc: "Use this form to raise another person when they take an action:",
  },
  humble: {
    label: "Humble",
    desc: "Use this form to lower yourself when you take an action:",
  },
};

const KEIGO_HELP =
  "Keigo doesn't change the original everyday version of the word. These are entirely new words.";

export function KeigoEntryView({
  entry,
  item,
  liveHeadline,
}: {
  entry?: EntryId;
  item?: ContentItem;
  liveHeadline?: Headline;
}) {
  const fetched = useContentEntry<KeigoPayload>(item ? null : (entry ?? null));
  const headline = item ? liveHeadline : fetched;
  const resolvedEntry = item ? item.entry : entry!;
  const glyph = item ? item.glyph : libEntry(resolvedEntry)?.glyph;
  const set = keigoSetForEntry(resolvedEntry);

  if (headline === undefined || headline === null || !glyph || !set) return null;

  const registers = libEntry(grammarConceptEntry("keigo-registers"));

  return (
    <EntrySurface>
      <ContentEntryHeader glyph={glyph} headline={headline} typeLabel="keigo" />

      {/* THE FORMULAIC SET is the odd one out: いらっしゃいませ has no plain verb it
          politens (that is why it is `blockedBy` nothing and opens on its own).
          Without this note a learner meets it beside the verb sets and reasonably
          asks "the polite form of WHAT?" — so it is named for what it actually is:
          a fixed phrase you hear rather than conjugate. */}
      {set.formulaic ? (
        <Section title="Where you'll hear it" tone="accent">
          <p className="text-[15px] leading-relaxed text-text">
            This one is different. It isn&rsquo;t the polite version of a verb you
            already know — it&rsquo;s a fixed phrase. It&rsquo;s the greeting shop
            and restaurant staff call out to welcome a customer in:{" "}
            <span lang="ja" className="font-kana">
              いらっしゃいませ
            </span>
            , roughly &ldquo;welcome, come in!&rdquo; You&rsquo;ll hear it, not say
            it, so learn it by ear.
          </p>
        </Section>
      ) : null}

      {/* THE POLITE FORMS — the honorific verb (for the OTHER person's action) and
          the humble verb (for YOUR own). Each is a boxless row: its register in
          accent with the "when to use it" note in a tooltip, then the form + its
          reading. The section's own tooltip carries the one thing a learner must
          not miss — these are NEW words, not a politer spelling of the plain verb. */}
      <Section title="Polite forms" tone="accent" help={KEIGO_HELP}>
        <div className="flex flex-col gap-5">
          {set.words.map((w) => {
            // A FORMULAIC SET carries no honorific/humble EXPLANATION: `register`
            // still tags いらっしゃいませ for the question engine's distractor logic,
            // but "Use this form to raise another person when they take an
            // action" describes a conjugation choice this fixed phrase doesn't
            // have — printing it here would contradict the "Where you'll hear it"
            // section just above, which already told the learner it's a phrase to
            // learn by ear, not a form to reach for. So the register label AND its
            // description are both suppressed for formulaic sets; only the word
            // itself (with its audio) still renders.
            const reg = set.formulaic ? undefined : REGISTER[w.register];
            return (
              <div key={w.key}>
                {reg ? (
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
                    {reg.label}
                  </p>
                ) : null}
                {reg ? (
                  <p className="mb-2 text-[13px] leading-relaxed text-text">{reg.desc}</p>
                ) : null}
                <div className="flex items-center gap-2.5">
                  <HearButton glyph={w.reading} />
                  <span className="font-kana text-[22px] leading-none text-text">{w.word}</span>
                  {/* Furigana glosses a kanji reading — a word already written
                      entirely in kana (いらっしゃいませ) has nothing for it to
                      add, so the reading is suppressed rather than printed
                      twice. See SAK-38. */}
                  {hasKanji(w.word) ? (
                    <span className="font-kana text-[13px] text-text-muted">{w.reading}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* THE WHY BEHIND IT — the specific verbs above are instances of the
          three-register politeness model. The concept page is the one place that
          model is taught as an idea; the set links out to it rather than restating
          it, the same "Read about it" hop the entry router gives a keigo page. */}
      {registers ? (
        <Section title="The bigger picture">
          <Lead>These forms are one case of a general system of politeness levels.</Lead>
          <Link
            href={entryHref(grammarConceptEntry(registers.id))}
            className="text-[13px] text-accent no-underline"
          >
            {registers.name} &rarr;
          </Link>
        </Section>
      ) : null}
    </EntrySurface>
  );
}
