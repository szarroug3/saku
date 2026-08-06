"use client";

// One keigo set, shown as a unit: the plain verb the learner already knows, then
// the honorific form (for what the other person does) and the humble form (for
// what you do), each with its reading and a speaker, over the rule that decides
// which one to reach for.
//
// SHARED so the teach walk and the Library entry page cannot drift, the same rule
// VerbPairView follows for transitivity. A set is neither a glyph nor a single
// fact, so it fits none of the single-glyph heroes; this is the one layout that
// knows how to draw a keigo set, and both screens mount it.

import { HearButton } from "@/components/lesson/hear-button";
import { useFlatSurface } from "@/components/ui";
import type { KeigoSet, KeigoWord } from "@/data/keigo";

/** One keigo verb: its written form big, a speaker with its reading, and the
 * plain-language note of when it is used. */
function KeigoSide({
  word,
  role,
  note,
  voiceName,
}: {
  word: KeigoWord;
  role: string;
  note: string;
  voiceName: string;
}) {
  // Flat (transparent, border kept) on the Library entry page; frosty bg-card in
  // the lesson teach view, where no FlatSurfaceProvider sits above.
  const flat = useFlatSurface();
  return (
    <div
      className={`rounded-lg border border-border p-5 ${
        flat ? "bg-transparent" : "bg-card"
      }`}
    >
      <p className="text-[12px] uppercase tracking-wide text-text-muted">{role}</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <span className="font-kana text-[34px] font-extralight leading-none text-text">
          {word.word}
        </span>
        <div className="flex items-center gap-2 pt-1">
          <HearButton glyph={word.word} voiceName={voiceName} />
          <span className="text-right font-kana text-[14px] text-text-muted">
            {word.reading}
          </span>
        </div>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-text-muted">{note}</p>
    </div>
  );
}

/** The whole set: the plain verb, the keigo forms grouped by register, and the
 * reminder of the rule. */
export function KeigoSetView({
  set,
  voiceName,
  showLead = true,
}: {
  set: KeigoSet;
  voiceName: string;
  /** The LEAD LINE at the top — the plain verb it replaces (verb sets) or the
   * meaning paragraph (the set phrase). Shown in the lesson, where this view
   * stands alone with no header to carry them. The Library entry page passes
   * false: its header already prints the plain verb and the meaning in word
   * format, so a lead line here would repeat them. */
  showLead?: boolean;
}) {
  const honorific = set.words.filter((w) => w.register === "honorific");
  const humble = set.words.filter((w) => w.register === "humble");

  if (set.formulaic) {
    const phrase = set.words[0];
    return (
      <div>
        {showLead ? (
          <p className="mb-4 text-[15px] text-text">{set.meaning}</p>
        ) : null}
        {phrase ? (
          showLead ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="font-kana text-[34px] font-extralight leading-none text-text">
                  {phrase.word}
                </span>
                <div className="flex items-center gap-2 pt-1">
                  <HearButton glyph={phrase.word} voiceName={voiceName} />
                  <span className="text-right font-kana text-[14px] text-text-muted">
                    {phrase.reading}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // Library page: the header above already shows the phrase; just surface the audio.
            <div className="flex items-center gap-2">
              <HearButton glyph={phrase.word} voiceName={voiceName} />
              <span className="font-kana text-[14px] text-text-muted">{phrase.reading}</span>
            </div>
          )
        ) : null}
        <div className={showLead ? "mt-9 border-t border-border pt-7" : "mt-3"}>
          <p className="text-[14px] leading-relaxed text-text-muted">
            This is a fixed greeting rather than a verb you change, so learn it as
            one whole phrase. It is the honorific welcome a shop says to a
            customer, and it is one of the first things you will hear.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {showLead ? (
        <p className="mb-4">
          <span className="font-kana text-[20px] font-light text-text">
            {set.plain.map((p) => p.keb).join(" / ")}
          </span>{" "}
          <span className="text-[14px] text-text-muted">({set.meaning})</span>
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {honorific.map((w) => (
          <KeigoSide
            key={w.key}
            word={w}
            role="Honorific · for what they do"
            note="You raise the other person with this. Use it for the action of someone you are showing respect to, never for yourself."
            voiceName={voiceName}
          />
        ))}
        {humble.map((w) => (
          <KeigoSide
            key={w.key}
            word={w}
            role={w.use ? `Humble · ${w.use}` : "Humble · for what you do"}
            note="You humble yourself with this. Use it for your own action, to defer to the person you are speaking to, never for what they do."
            voiceName={voiceName}
          />
        ))}
      </div>
    </div>
  );
}
