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
import { useEffect, useState, type ReactNode } from "react";

import { Callout } from "@/components/lesson/callout";
import { HearButton } from "@/components/lesson/hear-button";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { KanjiPartsRow } from "@/components/lesson/kanji-parts-row";
import { LessonPanel, PairedRow } from "@/components/lesson/lesson-panel";
import { LessonReadings } from "@/components/lesson/lesson-readings";
import { MnemonicView } from "@/components/lesson/mnemonic-view";
import { WordFormFan } from "@/components/lesson/word-form-fan";
import { noteFor } from "@/data/characters";
import { cluster, membersOf } from "@/data/grammar/clusters";
import { kanjiRow } from "@/data/kanji";
import { radicalByGlyph } from "@/data/radicals";
import { getMnemonic } from "@/data/mnemonics";
import { exampleFor } from "@/data/word-examples";
import { vocabRow, type VocabRow } from "@/data/vocab";
import { buildRow } from "@/lib/grammar/build";
import { primaryHost } from "@/lib/grammar/example";
import { attachesTo, recipeFormula } from "@/lib/grammar/formula";
import { knownLookalikes } from "@/lib/kanji-lookalikes";
import type { LessonItem } from "@/lib/lesson-items";
import { radicalConsumerCount } from "@/lib/radical-order";
import { formsOfWord } from "@/lib/word-forms";
import { libEntry, recipeOf } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import { useQuizConfig } from "@/lib/quiz-config";
import { useHistory } from "@/lib/use-history";

/** The one-line reading/meaning under the headword, per track. Read off the
 * Library entry so it matches the reference exactly. */
function subtitleOf(item: LessonItem): string {
  const entry = libEntry(item.entry);
  if (!entry) return "";
  switch (item.kind) {
    case "kana":
      return entry.readings.join(" · ");
    case "kanji":
    case "radical":
      return entry.meanings.slice(0, 4).join(" · ");
    case "word":
      return [entry.readings[0], entry.meanings.slice(0, 3).join(", ")]
        .filter(Boolean)
        .join(": ");
    case "grammar":
      return entry.meanings[0] ?? "";
  }
}

type GrammarExample = {
  jp: string;
  en: string;
} | null;

function useGrammarExample(recipeId: string | null): GrammarExample {
  const [example, setExample] = useState<GrammarExample>(null);
  useEffect(() => {
    if (!recipeId) return;
    const ac = new AbortController();
    void fetch(`/api/grammar-example?recipe=${encodeURIComponent(recipeId)}`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as GrammarExample;
      })
      .then((x) => setExample(x))
      .catch(() => setExample(null));
    return () => ac.abort();
  }, [recipeId]);
  return example;
}

function FormulaLine({
  slot,
  formLabel,
  trim,
  add,
}: {
  slot: string;
  formLabel: string | null;
  trim: string | null;
  add: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <span className="rounded-md border border-dashed border-border px-2 py-1 text-text-muted">
        {slot}
      </span>
      {formLabel ? (
        <>
          <span className="text-text-muted">→</span>
          <span className="rounded-md border border-border px-2 py-1 text-text">
            {formLabel}
          </span>
        </>
      ) : null}
      {trim ? (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-text-muted">-</span>
          <span className="font-kana text-[15px] text-accent">{trim}</span>
        </span>
      ) : null}
      {add ? (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-text-muted">+</span>
          <span className="font-kana text-[15px] text-accent">{add}</span>
        </span>
      ) : null}
    </div>
  );
}

function WorkedLine({
  examples,
  wraps,
  slot,
}: {
  examples: readonly { from: string; to: string }[];
  wraps: boolean;
  slot: string;
}) {
  if (!examples.length) return null;
  return (
    <p className="mt-2 text-[12px] text-text-muted">
      {wraps ? "Worked out: " : `Any ${slot.replace("any ", "")} you know: `}
      {examples.map((w, i) => (
        <span key={w.from}>
          {i > 0 ? <span> · </span> : null}
          <span className="whitespace-nowrap">
            <span className="font-kana text-text">{w.from}</span> →{" "}
            <span className="font-kana text-text">{w.to}</span>
          </span>
        </span>
      ))}
    </p>
  );
}

function WordReadingsPanel({
  word,
  voiceName,
}: {
  word: VocabRow;
  voiceName: string;
}) {
  if (!word.align || word.align.length === 0) return null;
  return (
    <LessonPanel title="Why it sounds like that">
      <div className="space-y-2">
        {word.align.map(([k, surface], i) => {
          const meaning = kanjiRow(k)?.meanings[0] ?? "";
          return (
            <div key={`${k}-${i}`} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span className="flex items-center gap-2">
                <HearButton glyph={surface} voiceName={voiceName} />
                <span className="font-kana text-[20px] leading-none">{k}</span>
              </span>
              <span className="font-kana text-[16px] leading-none text-text">
                {surface}
              </span>
              <span className="text-[11px] text-text-muted">meaning</span>
              <span className="text-[11px] text-text-muted">
                {meaning || "(no meaning listed)"}
              </span>
            </div>
          );
        })}
      </div>
    </LessonPanel>
  );
}

function WordSentencePanel({ keb }: { keb: string }) {
  const ex = exampleFor(keb);
  return (
    <LessonPanel title="Used like this">
      {ex ? (
        <>
          <p className="font-kana text-[18px] leading-relaxed text-text">{ex.jp}</p>
          <p className="mt-1.5 text-[13px] text-text-muted">{ex.en}</p>
        </>
      ) : null}
    </LessonPanel>
  );
}

function GrammarBuildPanel({ item }: { item: LessonItem }) {
  const entry = libEntry(item.entry);
  if (!entry) return null;
  const pattern = recipeOf(entry);
  if (!pattern) return null;
  const formula = recipeFormula(pattern);
  if (!formula.opening.length) return null;

  return (
    <LessonPanel title="How to build it">
      <div className="space-y-3">
        {formula.opening.map((f) => (
          <div key={`${f.host}-${f.slot}`} className="rounded-md border border-border bg-card px-3 py-2">
            <FormulaLine
              slot={f.slot}
              formLabel={f.formLabel}
              trim={f.trim}
              add={f.add}
            />
            <WorkedLine examples={f.worked} wraps={f.wraps} slot={f.slot} />
          </div>
        ))}
      </div>
    </LessonPanel>
  );
}

function GrammarSentencePanel({
  item,
  example,
}: {
  item: LessonItem;
  example: Exclude<GrammarExample, null>;
}) {
  const entry = libEntry(item.entry);
  const pattern = entry ? recipeOf(entry) : null;
  if (!entry || !pattern) return null;
  return (
    <LessonPanel title="Used like this">
      <p className="font-kana text-[18px] leading-relaxed text-text">{example.jp}</p>
      <p className="mt-1.5 text-[13px] text-text-muted">{example.en}</p>
    </LessonPanel>
  );
}

function GrammarFamilyPanel({ item }: { item: LessonItem }) {
  const entry = libEntry(item.entry);
  if (!entry) return null;
  const pattern = recipeOf(entry);
  if (!pattern || !pattern.cluster) return null;
  const c = cluster(pattern.cluster);
  if (!c) return null;
  const members = membersOf(c);
  if (members.length < 2) return null;

  return (
    <LessonPanel title="Ways to say this">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-medium text-text-muted">
              <th className="py-1.5 pr-2 font-medium">Pattern</th>
              <th className="py-1.5 pr-2 font-medium">Built form</th>
              <th className="py-1.5 font-medium">What it means</th>
            </tr>
          </thead>
          <tbody>
            {members.map((r) => {
              const row = buildRow(r, primaryHost(r) ?? undefined);
              const current = r.id === pattern.id;
              return (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="py-2 pr-2 font-kana text-[15px]">
                    {current ? <span className="text-accent">{r.pattern}</span> : r.pattern}
                  </td>
                  <td className="py-2 pr-2 font-kana text-text-muted">
                    {row?.built ?? ""}
                  </td>
                  <td className="py-2">{r.gloss}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-text-muted">
        All of these are correct ways to say this. {c.feel ?? ""} Which one someone
        reaches for is a matter of feel, and feel comes from hearing them used, so
        this lesson shows you the difference and never tests you on it.
      </p>
    </LessonPanel>
  );
}

/** The plain headword — for a kanji (a meaning, no mnemonic), a word, a pattern,
 * or an extended kana with no authored hook. The glyph, its reading/meaning, and
 * the speaker when it's pronounceable, set large and to the left so the page
 * still opens on the character. */
function PlainHeadword({
  item,
  titleRow,
  pronunciation,
  sub,
  canHear,
  kanaGlyph,
  right,
  voiceName,
}: {
  item: LessonItem;
  titleRow: string;
  pronunciation?: string;
  sub?: string;
  canHear: boolean;
  kanaGlyph: boolean;
  right?: ReactNode;
  voiceName: string;
}) {
  return (
    <div className="grid gap-3.5 md:grid-cols-[auto_1fr]">
      <div className="flex min-w-0 items-start gap-x-6 gap-y-2">
        <Link
          href={entryHref(item.entry)}
          aria-label={`Open ${item.glyph} in the Library`}
          className={`${
            kanaGlyph ? "font-kana" : ""
          } text-[72px] font-extralight leading-none text-text no-underline`}
        >
          {item.glyph}
        </Link>
        <div className="min-w-0 flex-1">
          {titleRow ? <p className="text-[16px] leading-relaxed text-text-muted">{titleRow}</p> : null}
          {sub ? <p className="mt-0.5 text-[12px] text-text-muted">{sub}</p> : null}
          {canHear || pronunciation ? (
            <div className="mt-2 flex items-center gap-2">
              {canHear ? <HearButton glyph={item.glyph} voiceName={voiceName} /> : null}
              {pronunciation ? (
                <span className="font-kana text-[15px] text-text-muted">{pronunciation}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {right}
    </div>
  );
}

function wordTypeOf(word: VocabRow): string {
  const pos = word.pos[0]?.toLowerCase() ?? "";
  if (pos.includes("verb")) return "verb";
  if (pos.includes("adjective")) return "adjective";
  if (pos.includes("adverb")) return "adverb";
  if (pos.includes("particle")) return "particle";
  if (pos.includes("expression")) return "expression";
  return "noun";
}

function KanjiConfusables({ glyph }: { glyph: string }) {
  const { history } = useHistory();
  const lookalikes = knownLookalikes(glyph, history);
  if (!lookalikes.length) return null;
  return (
    <LessonPanel title="Commonly confused with" className="h-full">
      <div className="flex flex-wrap items-center gap-2">
        {lookalikes.map((l) => (
          <span
            key={l.c}
            className="rounded-md border border-border bg-card px-2 py-1 text-[13px]"
          >
            <span className="text-[18px] leading-none">{l.c}</span>{" "}
            <span className="text-text-muted">{l.meaning}</span>
          </span>
        ))}
      </div>
    </LessonPanel>
  );
}

export function LessonItemView({ item }: { item: LessonItem }) {
  const { cfg } = useQuizConfig();

  const subtitle = subtitleOf(item);
  // Pronounceable surfaces only: a kana and a word have one sound, a bare kanji
  // (a meaning) and a grammar pattern do not — the same split the entry page
  // and the teach screen make.
  const canHear = item.kind === "kana" || item.kind === "word";
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
  // The radical being taught, when this step is one — its meaning and how many
  // kanji it feeds are the whole lesson: a radical is a shape and an idea, not a
  // sound, so there is no reading table or mnemonic, just what it means and the
  // promise that it comes back.
  const radical = item.kind === "radical" ? radicalByGlyph(item.glyph) : null;
  const radicalAppearsIn = radical ? radicalConsumerCount(radical.num) : 0;
  const entry = libEntry(item.entry);
  const pattern = entry ? recipeOf(entry) : null;
  const word = item.kind === "word" ? vocabRow(item.glyph) : undefined;
  const forms = word ? formsOfWord(word) : null;
  const grammarSub = item.kind === "grammar" && pattern ? attachesTo(pattern) : undefined;
  const grammarExample = useGrammarExample(
    item.kind === "grammar" && pattern ? pattern.id : null,
  );
  const wordExample = word ? exampleFor(word.keb) : null;
  const wordAlign = word?.align && word.align.length > 0 ? word : null;
  const wordHeader = word
    ? `${wordTypeOf(word)} · ${(entry?.meanings?.[0] ?? "").trim()}`
    : subtitle;
  const wordPronunciation = word?.reb;

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
          titleRow={item.kind === "word" ? wordHeader : subtitle}
          pronunciation={item.kind === "word" ? wordPronunciation : undefined}
          sub={grammarSub}
          canHear={canHear}
          kanaGlyph={kanaGlyph}
          right={item.kind === "kanji" ? <KanjiConfusables glyph={item.glyph} /> : null}
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

      {/* What a radical IS, on the one screen it is taught. A building block used
          inside kanji rather than a word you speak, so the lesson asks only for
          its meaning. The "appears in N kanji" line is the reason it earns a
          card: this piece is about to come back. */}
      {radical ? (
        <div className="mt-6">
          <Callout label="Radical.">
            A building block used inside kanji, not a word on its own. This one
            means &ldquo;{radical.meaning}&rdquo;.
            {radicalAppearsIn > 0
              ? ` It appears in ${radicalAppearsIn} kanji, so you'll meet it again.`
              : " No common kanji uses it, so you're learning it to round out the set."}
          </Callout>
        </div>
      ) : null}

      {/* The reference sections, full-width below the hero, off a single light
          divider — no card around them, the flattening the owner asked for.
          Each is collapsed by default on a persisted preference and decides its
          own emptiness, so a kana shows only "how it's written" and a kanji adds
          its readings and the words it shows up in. */}
      <div className="mt-9 space-y-3 border-t border-border pt-7">
        {item.kind === "kanji" ? <KanjiPartsRow glyph={item.glyph} /> : null}
        {item.kind === "kanji" ? (
          <LessonReadings item={item} voiceName={cfg.voiceName} />
        ) : null}
        {item.kind === "word" && word && forms ? (
          <WordFormFan dictionary={word.keb} groups={forms} />
        ) : null}
        {item.kind === "word" && word ? (
          <PairedRow
            wide={wordAlign ? <WordReadingsPanel word={wordAlign} voiceName={cfg.voiceName} /> : null}
            narrow={wordExample ? <WordSentencePanel keb={word.keb} /> : null}
            even
          />
        ) : null}
        {item.kind === "grammar" ? (
          <PairedRow
            wide={<GrammarBuildPanel item={item} />}
            narrow={
              grammarExample ? (
                <GrammarSentencePanel item={item} example={grammarExample} />
              ) : null
            }
          />
        ) : null}
        {item.kind === "grammar" ? <GrammarFamilyPanel item={item} /> : null}
        {item.kind === "kana" || item.kind === "kanji" ? <HowItsWritten item={item} /> : null}
      </div>
    </div>
  );
}
