"use client";

// TRANSITIVITY entry — the redesigned Library page for one verb PAIR (開く/開ける).
// A pair is two verbs for one event: one for when it happens on its OWN, one for
// when SOMEONE does it. The page shows them the same boxless way the keigo forms
// read — each side's role in accent, the "what that means" note in a tooltip,
// then the verb, its reading, a speaker, and the English sentence that points to
// it — over a one-line reminder that they share a stem and are learned together.
//
//   header
//   It happens, or someone does it  (accent) — the two verbs, keigo-style
//
// Reference data only, read off the pair (pairForEntry). No stroke section: a
// pair has no single drawing.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface } from "@/components/library/entry-section";
import { Info, SoundIcon } from "@/components/ui";
import { pairForEntry } from "@/data/transitivity-facts";
import { speak } from "@/lib/speech";
import type { ContentItem } from "@/lib/content/item";

/** The leading run of characters two strings share (開 for 開く / 開ける). */
function sharedStem(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}

export function VerbPairEntryView({ item }: { item: ContentItem }) {
  const pair = pairForEntry(item.entry);
  if (!pair) return null;

  const sides = [
    {
      m: pair.happens,
      label: "It happens on its own",
      help: "No one is named as making it happen; it just happens.",
    },
    {
      m: pair.doIt,
      label: "Someone does it",
      help: "Someone makes it happen.",
    },
  ];
  const stem = sharedStem(pair.happens.word, pair.doIt.word);

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      {/* No section title or lead: the two accent role labels (It happens on its
          own / Someone does it) are the structure, and each carries its own
          tooltip. Just a divider under the header. */}
      <div className="mt-5 border-t border-border/50 pt-5">
        <div className="flex flex-col gap-5">
          {sides.map((s) => (
            <div key={s.m.word}>
              <p className="mb-1.5 flex items-center text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
                {s.label}
                <Info>{s.help}</Info>
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => speak(s.m.reading, "")}
                  aria-label={`Hear ${s.m.reading}`}
                  className="flex-none cursor-pointer border-none bg-transparent p-0 leading-none text-accent"
                >
                  <SoundIcon />
                </button>
                <span className="font-kana text-[22px] leading-none text-text">{s.m.word}</span>
                <span className="font-kana text-[13px] text-text-muted">{s.m.reading}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{s.m.en}</p>
            </div>
          ))}
        </div>
        {stem ? (
          <p className="mt-4 text-[12px] text-text-muted">
            Both are built on <span className="font-kana text-text">{stem}</span>, and are
            learned together as a pair.
          </p>
        ) : null}
      </div>
    </EntrySurface>
  );
}
