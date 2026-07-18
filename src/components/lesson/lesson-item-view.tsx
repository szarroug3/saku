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
// THE PICTURE IS THE HERO
// =======================
// For a kana we author a mnemonic, the drawn image is the memory hook, so it is
// the largest thing on the page — a big square block, not a 120px thumbnail. A
// kana with no drawing yet has no placeholder tile: the glyph ITSELF becomes the
// hero, set large in its place. Either way the glyph appears exactly ONCE (it
// used to sit big at the top AND small inside the mnemonic card): as the drawn
// object's headword when there's an image, or as the hero when there isn't.
//
// It reads the entry's story from the Library index (libEntry / appearsIn) —
// the same source the entry page uses — so the walk-through and the reference
// can't disagree about what a character is.

import Link from "next/link";
import { useState } from "react";

import { HowItsWritten } from "@/components/lesson/how-its-written";
import { LessonReadings } from "@/components/lesson/lesson-readings";
import { Line } from "@/components/lesson/mnemonic-card";
import { SoundIcon } from "@/components/ui";
import { getMnemonic, type Mnemonic } from "@/data/mnemonics";
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

/** The speaker — pronounceable surfaces only (a kana or a word have one sound; a
 * bare kanji meaning and a grammar pattern do not). Same control the header and
 * the entry page use. */
function HearButton({ glyph, voiceName }: { glyph: string; voiceName: string }) {
  return (
    <button
      type="button"
      onClick={() => speak(glyph, voiceName)}
      aria-label={`Hear ${glyph}`}
      className="inline-flex items-center justify-center cursor-pointer rounded-md border border-border bg-card px-2 py-0.5 text-[12px] leading-none text-text-muted hover:bg-panel hover:text-text"
    >
      <SoundIcon className="size-[14px]" />
    </button>
  );
}

/** The kana hero: the drawn picture (or the glyph, when nothing's drawn yet) big
 * on one side, and the reading + the sound analogy + the story + a real word on
 * the other. Two columns on a wide screen, stacked on a narrow one. This is the
 * old MnemonicCard's content, un-boxed and enlarged — the same `getMnemonic`
 * data and the same sound-accent rule (via the shared `Line`), no thumbnail. */
function KanaHero({
  item,
  m,
  voiceName,
}: {
  item: LessonItem;
  m: Mnemonic;
  voiceName: string;
}) {
  const chars = [...m.example.word];
  const href = entryHref(item.entry);

  // `getMnemonic` hands every kana a candidate picture path; the file may not be
  // drawn yet. When it 404s the <img>'s onError fires and the WHOLE hero drops to
  // the glyph layout (big character on the left, romaji leading on the right) —
  // the exact look kana without a drawing have always had. Tracked by src, so
  // stepping to a different kana re-tries its own picture with no reset.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = m.image != null && failedSrc !== m.image;

  return (
    <div className="grid items-center gap-x-12 gap-y-7 md:grid-cols-[minmax(0,440px)_1fr]">
      {/* THE HERO. With a drawing: a big square block on the app's frosted-panel
          material (kq-material + bg-card + border) — the same surface every
          other box wears, so the tile adapts to every theme and reads in both
          light and dark. Transparent-PNG images show the frost THROUGH their
          empty areas. The tile sits directly on the page, so kq-material's
          backdrop is the page and the frost is real. Without a drawing: the
          glyph itself, set large, is the hero — no placeholder tile. */}
      <div className="flex justify-center md:justify-start">
        {showImage ? (
          <Link
            href={href}
            aria-label={`Open ${item.glyph} in the Library`}
            className="block w-full max-w-[440px]"
          >
            <div
              className="kq-material flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-card"
              aria-hidden
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.image}
                alt=""
                className="size-full object-contain p-6"
                onError={() => setFailedSrc(m.image ?? null)}
              />
            </div>
          </Link>
        ) : (
          <Link
            href={href}
            aria-label={`Open ${item.glyph} in the Library`}
            className="font-kana text-[clamp(160px,24vw,260px)] font-extralight leading-none text-text no-underline"
          >
            {item.glyph}
          </Link>
        )}
      </div>

      {/* THE READING AND THE HOOKS. The glyph rides here as the headword ONLY
          when the drawing is the hero on the left; when the glyph is itself the
          hero, the romaji leads instead, so the glyph never doubles. */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          {showImage ? (
            <Link
              href={href}
              aria-label={`Open ${item.glyph} in the Library`}
              className="font-kana text-[52px] font-light leading-none text-text no-underline"
            >
              {m.glyph}
            </Link>
          ) : null}
          <span className="text-[19px] text-text-muted">{m.romaji}</span>
          {m.object ? (
            <span className="rounded-full bg-accent-bg px-2.5 py-0.5 text-[12px] font-medium text-accent">
              {m.object}
            </span>
          ) : null}
          <span className="ml-auto">
            <HearButton glyph={item.glyph} voiceName={voiceName} />
          </span>
        </div>

        <p className="mt-5 text-[16px] leading-relaxed">
          <Line line={m.analogy} />
        </p>
        <p className="mt-2.5 text-[15px] leading-relaxed text-text-muted">
          <Line line={m.mnemonic} />
        </p>

        {/* The kana caught in a real word, its own glyph accented. */}
        <div className="mt-6 flex items-baseline gap-2.5 border-t border-border pt-4 text-[15px]">
          <span className="font-kana text-[24px]">
            {chars.map((c, i) => (
              <span key={i} className={i === m.example.hitIndex ? "text-accent" : undefined}>
                {c}
              </span>
            ))}
          </span>
          <span className="text-text-muted">
            {m.example.reading} · {m.example.gloss}
          </span>
        </div>
      </div>
    </div>
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

  return (
    <div>
      {/* THE HERO. Kana with a hook: the picture (or the glyph) big, the reading
          and the story beside it. Everything else: the plain headword. Either
          way the glyph shows exactly once. */}
      {mnemonic ? (
        <KanaHero item={item} m={mnemonic} voiceName={cfg.voiceName} />
      ) : (
        <PlainHeadword
          item={item}
          subtitle={subtitle}
          canHear={canHear}
          kanaGlyph={kanaGlyph}
          voiceName={cfg.voiceName}
        />
      )}

      {/* The reference sections, full-width below the hero, off a single light
          divider — no card around them, the flattening the owner asked for.
          Each is collapsed by default on a persisted preference and decides its
          own emptiness, so a kana shows only "how it's written" and a kanji adds
          its readings and the words it shows up in. */}
      <div className="mt-9 space-y-3 border-t border-border pt-7">
        {/* How it's written — collapsed by default, a persisted preference. */}
        <HowItsWritten item={item} />

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
