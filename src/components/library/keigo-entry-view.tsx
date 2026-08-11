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
import { KeigoSetView } from "@/components/library/keigo-set-view";
import { SoundIcon } from "@/components/ui";
import { keigoSetForEntry } from "@/data/keigo";
import { grammarConceptEntry, grammarConceptRow } from "@/data/grammar-concepts";
import { entryHref } from "@/lib/library/href";
import { speak } from "@/lib/speech";
import type { ContentItem } from "@/lib/content/item";

export function KeigoEntryView({ item }: { item: ContentItem }) {
  const set = keigoSetForEntry(item.entry);
  if (!set) return null;

  const registers = grammarConceptRow("keigo-registers");

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      {/* THE EVERYDAY VERB — the plain word the learner already has, which is the
          anchor for the whole set: keigo does not add meaning, it swaps the verb
          for a politer one. A set may replace more than one plain verb (食べる AND
          飲む both become 召し上がる), so every plain verb is listed with its
          reading. Absent for the formulaic phrase (いらっしゃいませ), which has no
          plain partner — there the header's hero is the phrase itself. */}
      {set.plain.length > 0 ? (
        <Section title="Everyday verb" tone="accent">
          <Lead>
            The plain verb you already know. Keigo does not change what you are saying,
            only how politely you say it:
          </Lead>
          <table className="w-full text-[14px]">
            <tbody>
              {set.plain.map((p) => (
                <tr key={p.keb}>
                  <td className="whitespace-nowrap py-1 pr-6 align-top">
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => speak(p.reading, "")}
                        aria-label={`Hear ${p.reading}`}
                        className="flex-none cursor-pointer border-none bg-transparent p-0 leading-none text-accent"
                      >
                        <SoundIcon />
                      </button>
                      <span className="font-kana text-[18px] leading-none text-text">{p.keb}</span>
                    </span>
                  </td>
                  <td className="w-full py-1 align-middle font-kana text-[13px] text-text-muted">
                    {p.reading}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {/* THE POLITE FORMS — the honorific verb (for the OTHER person's action) and
          the humble verb (for YOUR own), each with its reading and the rule for
          when to reach for it. KeigoSetView is the one layout that knows how to
          draw a set; the lesson mounts the same one. Its own boxes already carry a
          border, so it sits directly on the surface — no card around it — to avoid
          a box inside a box, exactly as the entry router does. */}
      <Section title="Polite forms" tone="accent">
        <Lead>
          Which one you use is decided by whose action it is: honorific raises the
          other person, humble lowers yourself.
        </Lead>
        <KeigoSetView set={set} voiceName="" showLead={false} />
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
