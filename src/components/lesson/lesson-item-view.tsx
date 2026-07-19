"use client";

// One lesson item, opened up — the rich detail view the stepper shows for the
// character (or word, or pattern) you are on.
//
// ONE COHERENT LESSON, NOT BOXES-IN-BOXES
// =======================================
// This view used to be a stack of bordered cards — a mnemonic card with a
// thumbnail, a "how it's written" card — and the teach walk wrapped the whole
// stack in ANOTHER card, so the screen read as a page within a page within a
// page. It doesn't any more. The item lives directly on the page: a wide HERO
// at the top (the drawn picture big on one side, the reading and the hooks on
// the other), then the collapsible reference sections full-width below it,
// separated by a single light divider. The only remaining surfaces are the two
// collapsibles, which earn a subtle panel because they open and close.
//
// SUBJECT-AGNOSTIC BY ASSEMBLY, NOT BY BRANCHING EVERYWHERE
// ========================================================
// The frame is the same for every track: a headword with its reading or
// meaning, then the sections that apply. Which sections apply is the only thing
// that varies, and it varies in ONE place here — kana gets the mnemonic hero,
// kanji gets its readings, everything gets "how it's written". Each section is
// its own component and decides its own emptiness, so this file reads as "what
// a lesson item is made of" and nothing more.
//
// THE PICTURE IS THE HERO — AND THE LIBRARY SHOWS THE SAME ONE
// ============================================================
// For a kana we author a mnemonic, the drawn image is the memory hook, so it is
// the largest thing on the page — a big square block, not a 120px thumbnail.
// That block is no longer built here: it is `MnemonicView`, the ONE mnemonic
// implementation, which the Library entry page renders too. The arrangement is
// this lesson's (picture left, words right, capped at 440px) and the entry page
// adopted it, so a character met in the walk-through looks the same when it is
// looked up later. A kana with no drawing yet has no placeholder tile: the glyph
// ITSELF becomes the hero, and the header glyph drops so it never doubles.
//
// It reads the entry's story from the Library index (libEntry / appearsIn) —
// the same source the entry page uses — so the walk-through and the reference
// can't disagree about what a character is.

import Link from "next/link";

import { Callout } from "@/components/lesson/callout";
import { HearButton } from "@/components/lesson/hear-button";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { LessonReadings } from "@/components/lesson/lesson-readings";
import { MnemonicView } from "@/components/lesson/mnemonic-view";
import { noteFor } from "@/data/characters";
import { getMnemonic } from "@/data/mnemonics";
import type { LessonItem } from "@/lib/lesson-items";
import { appearsIn, entryForGlyph, libEntry } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import { useQuizConfig } from "@/lib/quiz-config";

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

/** The plain headword — for a kanji (a meaning, no mnemonic), a word, a pattern,
 * or an extended kana with no authored hook. The glyph, its reading/meaning, and
 * the speaker when it's pronounceable, set large and to the left so the page
 * still opens on the character. */
function PlainHeadword({
  item,
  subtitle,
  canHear,
  kanaGlyph,
  voiceName,
}: {
  item: LessonItem;
  subtitle: string;
  canHear: boolean;
  kanaGlyph: boolean;
  voiceName: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <Link
        href={entryHref(item.entry)}
        aria-label={`Open ${item.glyph} in the Library`}
        className={`${
          kanaGlyph ? "font-kana" : ""
        } text-[92px] font-extralight leading-none text-text no-underline`}
      >
        {item.glyph}
      </Link>
      <div className="min-w-0 flex-1">
        {subtitle ? (
          <p className="text-[17px] leading-relaxed text-text-muted">{subtitle}</p>
        ) : null}
        {canHear ? (
          <div className="mt-3">
            <HearButton glyph={item.glyph} voiceName={voiceName} />
          </div>
        ) : null}
      </div>
    </div>
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
  // The app's own hook for this kana, when one is authored. When present it
  // drives the hero (big image, or the glyph as the hero when nothing's drawn);
  // when absent — an extended kana, or any non-kana — the plain headword stands
  // in. Gated on getMnemonic so the hide-when-absent rule holds.
  const mnemonic = item.kind === "kana" ? getMnemonic(item.glyph) : null;
  // The seven kana that don't say what their row says they say — し is "shi",
  // ふ is "fu", ぢ sounds exactly like じ. Named here, on the card where the
  // character is met, because a learner who infers "si" from the grid will not
  // find out they were wrong until the drill marks them down for it. Absent
  // for the regular majority, so this is silent rather than empty.
  const note = item.kind === "kana" ? noteFor(item.glyph) : null;

  return (
    <div>
      {/* THE HERO. Kana with a hook: the picture (or the glyph) big, the reading
          and the story beside it. Everything else: the plain headword. Either
          way the glyph shows exactly once. */}
      {mnemonic ? (
        <MnemonicView
          m={mnemonic}
          glyph={item.glyph}
          voiceName={cfg.voiceName}
          href={entryHref(item.entry)}
        />
      ) : (
        <PlainHeadword
          item={item}
          subtitle={subtitle}
          canHear={canHear}
          kanaGlyph={kanaGlyph}
          voiceName={cfg.voiceName}
        />
      )}

      {/* The call-out, when the sound is irregular. Directly under the hero and
          above the divider, because it is a correction to the thing you just
          read, not a reference section to open later. A left rule in the accent
          rather than a boxed card: it belongs to the hero. */}
      {note ? (
        <div className="mt-6">
          <Callout>{note}</Callout>
        </div>
      ) : null}

      {/* The reference sections, full-width below the hero, off a single light
          divider — no card around them, the flattening the owner asked for.
          Each is collapsed by default on a persisted preference and decides its
          own emptiness, so a kana shows only "how it's written" and a kanji adds
          its readings and the words it shows up in. */}
      <div className="mt-9 space-y-3 border-t border-border pt-7">
        {/* How it's written. Collapsed by default, a persisted preference, and
            gated on the track the same way the two sections below it are.

            SINGLE CHARACTERS ONLY. A kana has a real stroke diagram; a kanji has
            no diagram yet but a real stroke COUNT, which is worth showing and
            stays. A WORD is several characters and a GRAMMAR pattern is a shape
            with no stroke order at all, so for those the section had nothing to
            say and said so out loud: "learned as a whole shape, the stroke-order
            diagram for this one isn't in yet." That is wrong for 学生, whose two
            kanji each have their own order, and meaningless for 〜てから. The
            Library reached the same conclusion from the other side (see the
            alwaysOpen branch of how-its-written.tsx, which returns null rather
            than announcing an absence). */}
        {item.kind === "kana" || item.kind === "kanji" ? (
          <HowItsWritten item={item} />
        ) : null}

        {/* KANJI readings — minimised, collapsed, not drilled until words unlock
            them. Renders nothing for other tracks. */}
        {item.kind === "kanji" ? <LessonReadings item={item} /> : null}

        {/* Example words: where a kanji actually shows up. Kana carry their own
            example inside the hero; words and patterns don't have this link. */}
        {words.length ? (
          <div className="rounded-lg border border-border bg-panel px-3.5 py-3">
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
    </div>
  );
}
