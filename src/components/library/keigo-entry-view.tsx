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

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section } from "@/components/library/entry-section";
import { Info, SoundIcon } from "@/components/ui";
import { keigoSetForEntry } from "@/data/keigo";
import { grammarConceptEntry, grammarConceptRow } from "@/data/grammar-concepts";
import { entryHref } from "@/lib/library/href";
import { speak } from "@/lib/speech";
import type { ContentItem } from "@/lib/content/item";

// Per-register label (accent) + the "when do I use this" note, moved off the
// old form boxes and into a hover tooltip.
const REGISTER: Record<string, { label: string; help: string }> = {
  honorific: {
    label: "Honorific",
    help: "You raise the other person with this. Use it for the action of someone you are showing respect to, never for yourself.",
  },
  humble: {
    label: "Humble",
    help: "You humble yourself with this. Use it for your own action, to defer to the person you are speaking to, never for what they do.",
  },
};

const KEIGO_HELP =
  "Keigo doesn't change the original everyday version of the word. These are entirely new words.";

export function KeigoEntryView({ item }: { item: ContentItem }) {
  const set = keigoSetForEntry(item.entry);
  if (!set) return null;

  const registers = grammarConceptRow("keigo-registers");

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      {/* THE POLITE FORMS — the honorific verb (for the OTHER person's action) and
          the humble verb (for YOUR own). Each is a boxless row: its register in
          accent with the "when to use it" note in a tooltip, then the form + its
          reading. The section's own tooltip carries the one thing a learner must
          not miss — these are NEW words, not a politer spelling of the plain verb. */}
      <Section title="Polite forms" tone="accent" help={KEIGO_HELP}>
        <Lead>
          Which one you use is decided by whose action it is: honorific raises the
          other person, humble lowers yourself.
        </Lead>
        <div className="flex flex-col gap-5">
          {set.words.map((w) => {
            const reg = REGISTER[w.register];
            return (
              <div key={w.key}>
                <p className="mb-1.5 flex items-center text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
                  {reg?.label ?? w.register}
                  {reg ? <Info>{reg.help}</Info> : null}
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => speak(w.reading, "")}
                    aria-label={`Hear ${w.reading}`}
                    className="flex-none cursor-pointer border-none bg-transparent p-0 leading-none text-accent"
                  >
                    <SoundIcon />
                  </button>
                  <span className="font-kana text-[22px] leading-none text-text">{w.word}</span>
                  <span className="font-kana text-[13px] text-text-muted">{w.reading}</span>
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
