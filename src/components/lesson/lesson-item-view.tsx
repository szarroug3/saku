"use client";

// One lesson item, opened up — the rich detail view the stepper shows for the
// character (or word, or pattern) you are on.
//
// SUBJECT-AGNOSTIC BY ASSEMBLY, NOT BY BRANCHING EVERYWHERE
// ========================================================
// The frame is the same for every track: a big headword with its reading or
// meaning, then the sections that apply. Which sections apply is the only thing
// that varies, and it varies in ONE place here — kana gets the mnemonic
// scaffold, kanji gets its readings, everything gets "how it's written". Each
// section is its own component and decides its own emptiness, so this file reads
// as "what a lesson item is made of" and nothing more.
//
// It reads the entry's story from the Library index (libEntry / appearsIn) —
// the same source the entry page uses — so the walk-through and the reference
// can't disagree about what a character is.

import Link from "next/link";

import { HowItsWritten } from "@/components/lesson/how-its-written";
import { KanaMnemonic } from "@/components/lesson/kana-mnemonic";
import { LessonReadings } from "@/components/lesson/lesson-readings";
import type { LessonItem } from "@/lib/lesson-items";
import { appearsIn, entryForGlyph, libEntry } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import { useQuizConfig } from "@/lib/quiz-config";
import { speak } from "@/lib/speech";

/** The one-line reading/meaning under the headword, per track. Read off the
 * Library entry so it matches the reference exactly. */
function subtitleOf(item: LessonItem): string {
  const entry = libEntry(item.entry);
  if (!entry) return "";
  switch (item.kind) {
    case "kana":
      return entry.readings.join(" · ");
    case "kanji":
      return entry.meanings.slice(0, 4).join(" · ");
    case "word":
      return [entry.readings[0], entry.meanings.slice(0, 3).join(", ")]
        .filter(Boolean)
        .join(" — ");
    case "grammar":
      return entry.meanings[0] ?? "";
  }
}

/** A word, linked to its own entry when it has one — the entry page's WordLink,
 * for the "appears in" list. Degrades to plain text for a word with no page,
 * which is the join being honest (see the entry page). */
function WordLink({ word }: { word: string }) {
  const id = entryForGlyph("word", word);
  if (!id) return <span className="font-kana text-[15px]">{word}</span>;
  return (
    <Link
      href={entryHref(id)}
      className="font-kana text-[15px] text-accent no-underline hover:opacity-80"
    >
      {word}
    </Link>
  );
}

export function LessonItemView({ item }: { item: LessonItem }) {
  const { cfg } = useQuizConfig();

  const subtitle = subtitleOf(item);
  // Pronounceable surfaces only: a kana and a word have one sound, a bare kanji
  // (a meaning) and a grammar pattern do not — the same split the entry page
  // and the teach screen make.
  const canHear = item.kind === "kana" || item.kind === "word";
  // The everyday words a kanji is written in — its example words, and the
  // payoff the readings table points at. Only kanji attest this link.
  const words = item.kind === "kanji" ? appearsIn(libEntry(item.entry)!).slice(0, 8) : [];
  const kanaGlyph = item.kind === "kana" || item.kind === "grammar";

  return (
    <div>
      <div className="flex flex-col items-center pb-1 pt-2 text-center">
        {/* The headword opens its Library entry — where the full story lives. A
            Link, so cmd/middle-click work; the speaker sits outside it. */}
        <Link
          href={entryHref(item.entry)}
          aria-label={`Open ${item.glyph} in the Library`}
          className={`${
            kanaGlyph ? "font-kana" : ""
          } text-[68px] font-extralight leading-none text-text no-underline`}
        >
          {item.glyph}
        </Link>
        {subtitle ? (
          <p className="mt-3 max-w-[26rem] text-[15px] text-text-muted">{subtitle}</p>
        ) : null}
        {canHear ? (
          <button
            type="button"
            onClick={() => speak(item.glyph, cfg.voiceName)}
            aria-label={`Hear ${item.glyph}`}
            className="mt-3 cursor-pointer rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] leading-none text-text-muted hover:bg-panel hover:text-text"
          >
            🔊
          </button>
        ) : null}
      </div>

      {/* KANA: the mnemonic scaffold, always present (character placeholder +
          hook or "coming soon"). KANJI and the rest: no mnemonic slot — kanji
          already carry everything they need in their own data. */}
      {item.kind === "kana" ? <KanaMnemonic glyph={item.glyph} /> : null}

      {/* How it's written — collapsed by default, a persisted preference. */}
      <HowItsWritten item={item} />

      {/* KANJI readings — minimised, collapsed, not drilled until words unlock
          them. Renders nothing for other tracks. */}
      {item.kind === "kanji" ? <LessonReadings item={item} /> : null}

      {/* Example words: where a kanji actually shows up. Kana carry their own
          example inside the mnemonic; words and patterns don't have this link. */}
      {words.length ? (
        <div className="mt-3 rounded-lg border border-border bg-panel px-3.5 py-3">
          <p className="text-[13px] font-medium">Shows up in</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {words.map((w) => (
              <WordLink key={w} word={w} />
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-text-muted/80">
            You&rsquo;ll learn these as words later — each one you learn unlocks a
            reading above.
          </p>
        </div>
      ) : null}
    </div>
  );
}
