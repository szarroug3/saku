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
import { TermLink } from "@/components/library/term-link";
import type { KeigoSet, KeigoWord } from "@/data/keigo";

/** The one quiet way out of the word "keigo" itself, which this card leans on
 * (honorific, humble, register) but never defines. Placed once, above the set,
 * so both the Library page and the teach walk carry it and neither doubles it. */
function KeigoTermLink() {
  return (
    <p className="mb-3 text-[12px]">
      <TermLink id="keigo">What is keigo?</TermLink>
    </p>
  );
}

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
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-[12px] uppercase tracking-wide text-text-muted">{role}</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <span className="font-kana text-[34px] font-extralight leading-none text-text">
          {word.word}
        </span>
        <span className="pt-1 text-right font-kana text-[14px] text-text-muted">
          {word.reading}
        </span>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-text-muted">{note}</p>
      <div className="mt-3 flex items-center gap-2">
        <HearButton glyph={word.word} voiceName={voiceName} />
        <span className="font-kana text-[15px] text-text-muted">{word.reading}</span>
      </div>
    </div>
  );
}

/** The whole set: the plain verb, the keigo forms grouped by register, and the
 * reminder of the rule. */
export function KeigoSetView({
  set,
  voiceName,
}: {
  set: KeigoSet;
  voiceName: string;
}) {
  const honorific = set.words.filter((w) => w.register === "honorific");
  const humble = set.words.filter((w) => w.register === "humble");

  if (set.formulaic) {
    const phrase = set.words[0];
    return (
      <div>
        <KeigoTermLink />
        <p className="mb-3 text-[13px] text-text-muted">
          <span className="font-medium text-text">Set phrase.</span>{" "}
          {set.meaning}.
        </p>
        {phrase ? (
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="font-kana text-[34px] font-extralight leading-none text-text">
                {phrase.word}
              </span>
              <span className="pt-1 text-right font-kana text-[14px] text-text-muted">
                {phrase.reading}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <HearButton glyph={phrase.word} voiceName={voiceName} />
              <span className="font-kana text-[15px] text-text-muted">
                {phrase.reading}
              </span>
            </div>
          </div>
        ) : null}
        <div className="mt-9 border-t border-border pt-7">
          <p className="text-[14px] leading-relaxed text-text-muted">
            This is a fixed greeting rather than a verb you change, so learn it as
            one whole phrase. It is the honorific welcome a shop says to a
            customer, and it is one of the first things you will hear.
          </p>
        </div>
      </div>
    );
  }

  // The closing note names only the forms this set actually has — some have no
  // humble (くれる) or no honorific (もらう) — and, when a register carries more
  // than one form, spells out which is which from their `use` labels.
  const ways = ["neutral"];
  if (honorific.length) ways.push("honorific (for what they do)");
  if (humble.length) ways.push("humble (for what you do)");
  const waysText =
    ways.length <= 2
      ? ways.join(" and ")
      : `${ways.slice(0, -1).join(", ")} and ${ways[ways.length - 1]}`;
  const humbleTail =
    humble.length > 1 && humble.every((w) => w.use)
      ? ` Here the humble side has more than one form: ${humble
          .map((w) => `${w.word} (${w.use})`)
          .join(" and ")}.`
      : "";

  return (
    <div>
      <KeigoTermLink />
      <p className="mb-3 text-[13px] text-text-muted">
        <span className="font-medium text-text">Plain verb:</span>{" "}
        <span className="font-kana text-text">
          {set.plain.map((p) => p.keb).join(" / ")}
        </span>{" "}
        <span className="text-text-muted">({set.meaning})</span>, the everyday
        word you already know.
      </p>
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
      <div className="mt-9 border-t border-border pt-7">
        <p className="text-[14px] leading-relaxed text-text-muted">
          It’s the same action but has multiple ways to say it: {waysText}.
          {humbleTail}
        </p>
      </div>
    </div>
  );
}
