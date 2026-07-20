"use client";

// The transitivity pair, shown as a unit: both verbs side by side, each with its
// reading, a speaker, and the English cue that points to it, over the reminder
// that the two go together and neither builds from the other.
//
// SHARED so the teach walk and the Library entry page cannot drift. A pair is
// neither a glyph nor a single fact, so it fits none of the single-glyph heroes
// the rest of the app hangs a lesson or an entry on. This is the one layout that
// knows how to draw a pair, and both screens mount it rather than each authoring
// the same copy — the shared-component rule the mnemonic hero already follows.

import { HearButton } from "@/components/lesson/hear-button";
import type { VerbPair } from "@/data/transitivity";
import { pairPattern } from "@/lib/transitivity-pattern";

/** One member of a pair: its written form big, the reading beside it, a speaker,
 * and the English cue that points to this verb rather than its partner. A
 * dedicated layout (not the single-glyph headword) because the unit is a PAIR,
 * and both verbs have to read as equals. */
function VerbSide({
  member,
  role,
  voiceName,
}: {
  member: { word: string; reading: string; en: string };
  role: string;
  voiceName: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-[12px] uppercase tracking-wide text-text-muted">{role}</p>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="font-kana text-[40px] font-extralight leading-none text-text">
          {member.word}
        </span>
        <span className="font-kana text-[15px] text-text-muted">{member.reading}</span>
      </div>
      <div className="mt-3">
        <HearButton glyph={member.word} voiceName={voiceName} />
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-text">{member.en}</p>
    </div>
  );
}

/** The whole pair: the two sides, then the tail-shift note (or the exception
 * flag) and the reminder that a pair is learned as a pair. */
export function VerbPairView({
  pair,
  voiceName,
}: {
  pair: VerbPair;
  voiceName: string;
}) {
  const pattern = pairPattern(pair.happens.reading, pair.doIt.reading);
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <VerbSide member={pair.happens} role="It happens on its own" voiceName={voiceName} />
        <VerbSide member={pair.doIt} role="Someone does it" voiceName={voiceName} />
      </div>
      <div className="mt-9 border-t border-border pt-7">
        {pattern.isException ? (
          <p className="text-[13px] leading-relaxed text-text-muted">
            <span className="font-medium text-text">Exception.</span> This pair
            does not follow one of the usual ending swaps, so learn it on its own.
          </p>
        ) : (
          <p className="text-[13px] leading-relaxed text-text-muted">
            <span className="font-medium text-text">Pattern:</span>{" "}
            <span className="font-kana text-text">{pattern.from}</span>{" "}
            <span aria-hidden>&rarr;</span>{" "}
            <span className="font-kana text-text">{pattern.to}</span>. A common
            ending swap, but it does not tell you which verb is which, so still
            learn the pair.
          </p>
        )}
        <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
          Same event, two verbs. The English version tells you which one to use:
          whether it happens on its own, or someone makes it happen. You cannot
          build one from the other, so learn them together as a pair.
        </p>
      </div>
    </div>
  );
}
