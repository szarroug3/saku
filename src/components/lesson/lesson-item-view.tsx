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
// A SECTION PER ROLE, NOT PER KIND
// ================================
// A `LessonItem` carries ONE kind, and the unified spine teaches characters that
// play several roles at once: 人 is a word, a kanji and a shape other kanji are
// built around. Branching on the kind gave that character one role's material
// and a badge promising three, so 人 showed the readings it takes inside longer
// words and never said that on its own it is a word you can pronounce. The
// sections now come from `lessonSections` (src/lib/lesson-roles.ts), which reads
// the role set and returns exactly what this step has to show; the kind is left
// to the tracks that really are one thing, kana and grammar and the pattern
// cards. The affordances follow the same rule: a character that is a word is
// pronounceable whichever track it arrived on.
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
import { RoleBlock } from "@/components/lesson/role-block";
import { WordSensePanel } from "@/components/lesson/word-sense-panel";
import { RadicalKanjiTable } from "@/components/library/radical-kanji-table";
import { VerbPairView } from "@/components/library/verb-pair-view";
import { KeigoSetView } from "@/components/library/keigo-set-view";
import { WordFormFan } from "@/components/lesson/word-form-fan";
import { noteFor, glyphVariantFor } from "@/data/characters";
import { cluster, membersOf } from "@/data/grammar/clusters";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { getMnemonic } from "@/data/mnemonics";
import { exampleFor } from "@/data/word-examples";
import { type VocabRow } from "@/data/vocab";
import { pairForEntry } from "@/data/transitivity-facts";
import { keigoSetForEntry } from "@/data/keigo";
import { buildRow } from "@/lib/grammar/build";
import { primaryHost } from "@/lib/grammar/example";
import { attachesTo, recipeFormula } from "@/lib/grammar/formula";
import { knownLookalikes } from "@/lib/kanji-lookalikes";
import type { CharacterRole } from "@/lib/character-role";
import { characterRole, characterRoleTitle } from "@/lib/character-role";
import type { LessonItem } from "@/lib/lesson-items";
import {
  canHearItem,
  headwordSubtitle,
  lessonRoles,
  lessonSections,
  lessonWord,
  roleHasSections,
  wordTypeOf,
} from "@/lib/lesson-roles";
import { formsOfWord } from "@/lib/word-forms";
import { libEntry, recipeOf } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import { useQuizConfig } from "@/lib/quiz-config";
import { useHistory } from "@/lib/use-history";

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
  lead,
}: {
  examples: readonly { from: string; to: string }[];
  wraps: boolean;
  /** The claim the examples are evidence for, ready-made. See `workedLead` in
   * lib/grammar/formula.ts for why it is not cut out of the slot here. */
  lead: string;
}) {
  if (!examples.length) return null;
  return (
    <p className="mt-2 text-[12px] text-text-muted">
      {wraps ? "Worked out: " : `${lead}: `}
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
            <WorkedLine examples={f.worked} wraps={f.wraps} lead={f.workedLead} />
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
                    {r.sense && (
                      <span className="ml-1 text-[12px] text-text-muted">
                        ({r.sense})
                      </span>
                    )}
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
  hearGlyph,
  kanaGlyph,
  right,
  voiceName,
}: {
  item: LessonItem;
  titleRow: string;
  pronunciation?: string;
  sub?: string;
  canHear: boolean;
  /** What the speaker says. The written form for a word or a kana, and the
   * READING for a character that arrived on another track: 人 alone can be said
   * four ways, and the header prints the one the word takes. */
  hearGlyph: string;
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
              {canHear ? <HearButton glyph={hearGlyph} voiceName={voiceName} /> : null}
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

/** What each role set means for how you'll actually meet the character. The badge
 * says the roles (Title Cased, the same label the tiles print) and one plain line
 * underneath, because "Radical · Kanji" tells a beginner nothing on its own.
 *
 * THE WORD ROLE IS THE ONE THAT DECIDES "is it a word?". A radical that is also a
 * kanji is not thereby a word you can say by itself — 攵 has a kanji card and
 * still never stands alone — so only the sets carrying `word` promise that. The
 * two sets without a kanji card (word-only, radical + word) cannot happen off
 * today's tables, where every curriculum word is written in jōyō kanji; they are
 * written out anyway so the badge stays truthful if the word list ever reaches
 * past the jōyō set. */
const ROLE_NOTE: Record<CharacterRole, string> = {
  radical: "A building block, not a word on its own. You'll see it inside other kanji.",
  kanji: "It stands on its own as a character, but you'll meet it paired up inside words.",
  word: "You'll meet this one as a word and nothing else. Nothing in the kanji track is built from it.",
  "radical · kanji":
    "Other kanji are built around it. By itself it isn't a word yet, so expect it in company.",
  "radical · word":
    "It works as a word by itself, and its shape lives inside other kanji, though it never gets a kanji card of its own.",
  "kanji · word":
    "Say it alone and it's already a word. It also pairs with other kanji to make longer ones.",
  "radical · kanji · word":
    "A word by itself, a character in longer words, and a shape other kanji are built around.",
};

/** The role blob in the top-right of a kanji/radical header: which roles this
 * character plays, and what that means for how you'll meet it. Null for anything
 * that plays none. */
function RoleBadge({ glyph }: { glyph: string }) {
  const role = characterRole(glyph);
  const label = characterRoleTitle(glyph);
  if (!role || !label) return null;
  const note = ROLE_NOTE[role];
  return (
    <div className="rounded-lg border border-border bg-panel px-3 py-2 md:max-w-[240px] md:justify-self-end">
      <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-accent">
        {label}
      </span>
      <p className="mt-1 text-[12px] leading-snug text-text-muted">{note}</p>
    </div>
  );
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

/** The transitivity pair teach card — the shared pair view, fed the pair the
 * lesson item names. A pair has no Library glyph and no single fact, so it never
 * used the shared single-glyph hero; now it does not author its own layout
 * either — the Library entry page shows the identical card. */
function TransitivityTeachView({
  item,
  voiceName,
}: {
  item: LessonItem;
  voiceName: string;
}) {
  const pair = pairForEntry(item.entry);
  if (!pair) return null;
  return <VerbPairView pair={pair} voiceName={voiceName} />;
}

/** The keigo set teach card — the shared set view, fed the set the lesson item
 * names. Like a transitivity pair, a set is neither a glyph nor a single fact, so
 * it never used the single-glyph hero and the Library entry page shows the
 * identical card. */
function KeigoTeachView({
  item,
  voiceName,
}: {
  item: LessonItem;
  voiceName: string;
}) {
  const set = keigoSetForEntry(item.entry);
  if (!set) return null;
  return <KeigoSetView set={set} voiceName={voiceName} />;
}

export function LessonItemView({ item }: { item: LessonItem }) {
  const { cfg } = useQuizConfig();
  const { history } = useHistory();
  const claims = history.claims ?? {};
  const [now] = useState(() => Date.now());

  const subtitle = headwordSubtitle(item);
  // The roles this character plays and the sections they earn, both read off the
  // role set. Everything below asks these two rather than the item's single
  // kind, which is what left a folded character showing one role in three.
  const roles = lessonRoles(item);
  const sectionList = lessonSections(item);
  const sections = new Set(sectionList);
  // The role headings only make sense when there is more than one role to tell
  // apart; a plain kanji keeps the unlabelled stack it has always had.
  const labelRoles = roles.length > 1;
  // Pronounceable surfaces only: a kana has one sound, and so does a character
  // that stands alone as a word, whichever track it arrived on.
  const canHear = canHearItem(item);
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
  // The kana whose printed shape and handwritten shape diverge — き's connected
  // loop vs its detached lower stroke. Shown right beside the sound note, on the
  // card where the character is met, so a learner who has only seen one form is
  // not thrown by the other later. Absent for the majority whose forms match.
  const glyphVariant = item.kind === "kana" ? glyphVariantFor(item.glyph) : null;
  const entry = libEntry(item.entry);
  const pattern = entry ? recipeOf(entry) : null;
  // The word's own row, looked up by GLYPH: a folded character carries the kanji
  // entry, and the word it also is lives under an entry of its own.
  const word = lessonWord(item);
  const forms = word ? formsOfWord(word) : null;
  const grammarSub = item.kind === "grammar" && pattern ? attachesTo(pattern) : undefined;
  const grammarExample = useGrammarExample(
    item.kind === "grammar" && pattern ? pattern.id : null,
  );
  const wordAlign = word?.align && word.align.length > 0 ? word : null;
  // A word that is only a word says what it is up top: "noun · student". A
  // character that is also a kanji spends its header on the character's meaning
  // and teaches its word sense in the word section, which is the same condition
  // the word-sense section is chosen by, asked once.
  const headline =
    word && !sections.has("word-sense")
      ? `${wordTypeOf(word)} · ${(entry?.meanings?.[0] ?? "").trim()}`
      : subtitle;

  // A transitivity pair is neither a glyph nor a single fact, so it gets its own
  // card rather than the shared hero. This return is after every hook above, so
  // the rules-of-hooks hold.
  if (item.kind === "transitivity") {
    return <TransitivityTeachView item={item} voiceName={cfg.voiceName} />;
  }
  if (item.kind === "keigo") {
    return <KeigoTeachView item={item} voiceName={cfg.voiceName} />;
  }

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
          soundNote={note}
        />
      ) : (
        <PlainHeadword
          item={item}
          titleRow={headline}
          // ONE SOUND, OR NONE, IN THE HEADER.
          // ==================================
          // A speaker up here promises the character has A pronunciation, and a
          // folded character does not: 人 is ひと, じん and にん. Printing one of
          // the three beside a play button is the app picking a favourite and not
          // saying so. Whenever the word-sense panel is on this page it lists
          // every reading with a speaker of its own, so the header stands down
          // and pronunciation is said once, in the place that can say it fully.
          //
          // Kana and word-only steps keep theirs. A kana IS one sound, and a
          // word-only step (学生) has no sense panel, so the header is the only
          // place its reading lives and there is only ever one to show.
          pronunciation={sections.has("word-sense") ? undefined : word?.reb}
          sub={grammarSub}
          canHear={canHear && !sections.has("word-sense")}
          hearGlyph={item.glyph}
          kanaGlyph={kanaGlyph}
          right={
            // The badge speaks for a CHARACTER, so it is asked the same pure
            // question it prints: 学生 plays the word role and is still two
            // characters, with no badge to show.
            characterRole(item.glyph) ? (
              <div className="space-y-3 md:justify-self-end">
                <RoleBadge glyph={item.glyph} />
                {/* Lookalikes are a kanji's problem: they are the characters
                    this one is confused WITH on a page, which only arises once
                    it has a card of its own. */}
                {roles.includes("kanji") ? (
                  <KanjiConfusables glyph={item.glyph} />
                ) : null}
              </div>
            ) : null
          }
          voiceName={cfg.voiceName}
        />
      )}

      {/* The irregular-sound call-out. When there's a mnemonic, MnemonicView
          renders it right under the sound line (where the correction belongs);
          this standalone copy is only for the plain-headword path, which has no
          sound line of its own. */}
      {!mnemonic && note ? (
        <div className="mt-6">
          <Callout>{note}</Callout>
        </div>
      ) : null}

      {/* The written-form aside, when print and handwriting differ. Its own
          call-out because it corrects a different mistake than the sound note:
          not "you will say it wrong" but "you will not recognise it when it is
          written by hand". The opener "Note:" is the Callout label so it renders
          bold; the note string itself carries no prefix, so nothing repeats. */}
      {glyphVariant ? (
        <div className={note ? "mt-3" : "mt-6"}>
          <Callout label="Note:">{glyphVariant}</Callout>
        </div>
      ) : null}

      {/* The reference sections, full-width below the hero, off a single light
          divider — no card around them, the flattening the owner asked for.
          Each decides its own emptiness, and which of them appear is the role
          set's decision: a kana shows only "how it's written", a plain kanji
          adds its parts and its readings, and a character that is also a word
          teaches the word too, under a heading of its own.

          The roles run word, kanji, building block, the order the badge's own
          sentence puts them in for a character that plays all three. */}
      <div className="mt-9 space-y-3 border-t border-border pt-7">
        <RoleBlock role="word" labelled={labelRoles && roleHasSections("word", sectionList)}>
          {sections.has("word-sense") && word ? (
            <WordSensePanel word={word} voiceName={cfg.voiceName} />
          ) : null}
          {sections.has("word-forms") && word && forms ? (
            <WordFormFan dictionary={word.keb} groups={forms} />
          ) : null}
          {word ? (
            <PairedRow
              wide={
                sections.has("word-readings") && wordAlign ? (
                  <WordReadingsPanel word={wordAlign} voiceName={cfg.voiceName} />
                ) : null
              }
              narrow={
                sections.has("word-example") ? <WordSentencePanel keb={word.keb} /> : null
              }
              even
            />
          ) : null}
        </RoleBlock>
        <RoleBlock role="kanji" labelled={labelRoles && roleHasSections("kanji", sectionList)}>
          {sections.has("kanji-parts") ? <KanjiPartsRow glyph={item.glyph} /> : null}
          {/* Pointed at the KANJI entry, which is where the readings live. For a
              step that arrived on the kanji track that is the entry it already
              carries; for one that reached this character from the radical or
              words track it is the fold, and the same table either way. */}
          {sections.has("kanji-readings") ? (
            <LessonReadings
              item={{ ...item, entry: kanjiEntry(item.glyph) }}
              voiceName={cfg.voiceName}
            />
          ) : null}
        </RoleBlock>
        {/* A radical's kanji, in learning order: the shape's whole payoff is the
            meaning it lends the kanji built on it, so this shows the first few of
            them, each with its meaning and the reader's score. */}
        <RoleBlock role="radical" labelled={labelRoles && roleHasSections("radical", sectionList)}>
          {sections.has("radical-kanji") ? (
            <RadicalKanjiTable
              component={item.glyph}
              cap={5}
              facts={history.facts}
              claims={claims}
              metric={cfg.accuracyMetric}
              now={now}
            />
          ) : null}
        </RoleBlock>
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
        {/* Last, and under no role heading: how the shape is drawn is one answer
            however many roles the character plays. */}
        {sections.has("how-its-written") ? <HowItsWritten item={item} /> : null}
      </div>
    </div>
  );
}
