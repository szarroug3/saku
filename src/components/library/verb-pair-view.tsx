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

function sharedStem(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}

/** One member of a pair: its written form big, then a speaker with reading beside it,
 * and the English cue that points to this verb rather than its partner. A
 * dedicated layout (not the single-glyph headword) because the unit is a PAIR,
 * and both verbs have to read as equals. */
function VerbSide({
  member,
  role,
  voiceName,
  base,
  addition,
}: {
  member: { word: string; reading: string; en: string };
  role: string;
  voiceName: string;
  base: string;
  addition: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-[12px] uppercase tracking-wide text-text-muted">{role}</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <span className="font-kana text-[40px] font-extralight leading-none text-text">
          {member.word}
        </span>
        <span className="pt-1 text-right font-kana text-[14px] text-text-muted">
          {base ? (
            <>
              <span className="text-text-muted">{base}</span>
              <span className="text-text-muted"> + </span>
              <span className="text-text">{addition}</span>
              <span className="text-text-muted"> = </span>
              <span className="text-text">{member.reading}</span>
            </>
          ) : (
            <span className="text-text">{member.reading}</span>
          )}
        </span>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-text">{member.en}</p>
      <div className="mt-3 flex items-center gap-2">
        <HearButton glyph={member.word} voiceName={voiceName} />
        <span className="font-kana text-[15px] text-text-muted">{member.reading}</span>
      </div>
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
  const base = sharedStem(pair.happens.reading, pair.doIt.reading);
  const happensAdd = pair.happens.reading.slice(base.length);
  const doItAdd = pair.doIt.reading.slice(base.length);
  return (
    <div>
      <p className="mb-3 text-[13px] text-text-muted">
        <span className="font-medium text-text">Base stem:</span>{" "}
        <span className="font-kana text-text">{base || "none shared"}</span>
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <VerbSide
          member={pair.happens}
          role="It happens on its own"
          voiceName={voiceName}
          base={base}
          addition={happensAdd}
        />
        <VerbSide
          member={pair.doIt}
          role="Someone does it"
          voiceName={voiceName}
          base={base}
          addition={doItAdd}
        />
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
            <span className="font-kana text-text">{pattern.to}</span>. In this
            pattern, the <span className="font-medium text-text">it happens</span>{" "}
            verb uses <span className="font-kana text-text">{pattern.from}</span>{" "}
            and the <span className="font-medium text-text">someone does it</span>{" "}
            verb uses <span className="font-kana text-text">{pattern.to}</span>.
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
