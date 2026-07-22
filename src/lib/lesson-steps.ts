// The teach walk's step list: the lesson's items, plus the teaching cards that
// introduce a new PHASE of the curriculum.
//
// WHY A LAYER ABOVE itemsFromFacts
// ================================
// `itemsFromFacts` answers "what glyphs does this teach set cover", and that is
// all it should ever answer — it is subject-generic and knows nothing about
// kana's curriculum. A phase intro is not a glyph and has no fact, so folding it
// in there would put "kana has a dakuten phase" inside the generic grouper.
//
// So the walk steps over LessonSteps instead: an item step wraps exactly the
// LessonItem it always did, and an intro step carries a card. Anything with no
// intro produces a step list that is the item list one-for-one, which is why a
// phase without a card behaves exactly as it did before this file existed.
//
// ONE HELPER, TWO CALLERS, ONE COUNT
// ==================================
// The walk renders the steps and the session HUD counts them ("1 of 6"). Both
// call this, so the count and the content cannot disagree — the same reason the
// HUD already derived its items from `itemsFromFacts` rather than keeping its
// own copy.
//
// ANCHORED ON THE EDGES OF THE TEACH SET
// ======================================
// A "before" card shows when the teach set OPENS on a section that has one; an
// "after" card shows when it CLOSES on one. Local, deterministic, and a
// function of the teach set alone — no cursor, nothing on disk, nothing to get
// out of step with history. A group re-taught later shows its card again, which
// is the right answer for a card whose whole job is to explain the material.
//
// Kana only, by the item's own `kind` — with EXCEPTIONS. A kanji/word rule with
// no kana section to hang on rides the WORD that first puts it in play: the
// iteration mark 々 surfaces the moment the first 々 word (時々) is taught, and
// rendaku the moment the first word that voices at a compound seam (仕事) is —
// each ahead of the word that first makes its rule visible. Okurigana is
// word-gated the same way, over three cards: the idea rides the first word that
// carries a kana tail, and the moving and fixed cards ride the first word whose
// tail moves and the first whose tail does not, so each contrast is real rather
// than hypothetical. See phase-intros.ts for why these are word-gated rather than
// anchored to a section.

import { CHAR_INDEX } from "@/data/characters";
import { dakutenRowFor, type DakutenRow } from "@/data/dakuten-rows";
import {
  INTRO_AFTER,
  INTRO_BEFORE,
  ITERATION_MARK,
  OKURIGANA_FIXED,
  OKURIGANA_INTRO,
  OKURIGANA_MOVING,
  RENDAKU,
  TRANSITIVITY_INTRO,
  COUNTER_SOUND_CHANGE,
  type PhaseIntro,
} from "@/data/phase-intros";
import { isSoundChangeEntry } from "@/data/counters";
import { TRACK_INTROS, type TrackId } from "@/data/track-intros";
import { vocabRow } from "@/data/vocab";
import { itemsFromFacts, type LessonItem } from "@/lib/lesson-items";
import { startedTracks, trackOfItem } from "@/lib/track-open";
import { wordClassOf } from "@/lib/word-forms";
import type { FactId, HistoryFile } from "@/types";

/** One step of the walk — a character to learn, a conversion to learn, or a
 * concept to read. */
export type LessonStep =
  | { type: "intro"; key: string; intro: PhaseIntro }
  | { type: "conversion"; key: string; row: DakutenRow }
  | { type: "item"; key: string; item: LessonItem };

/** The kana section a step's glyph belongs to, or null for anything that isn't
 * a kana we ship. A lookup, never a parse. */
function sectionOf(item: LessonItem): string | null {
  if (item.kind !== "kana") return null;
  return CHAR_INDEX[item.glyph]?.sec ?? null;
}

/** The iteration mark, whose presence in a word's spelling is the gate for the
 * card that teaches it. A word that contains it is by definition the first place
 * 々 is in play. */
const ITERATION_GLYPH = "々";

/** A kanji, roughly: the CJK unified ideographs plus extension A. Deliberately
 * not 々 (U+3005), which is punctuation the iteration-mark gate owns. */
const KANJI = /[\u4e00-\u9faf\u3400-\u4dbf]/;
/** A hiragana. Okurigana is always hiragana — the katakana range is not it. */
const HIRAGANA = /[\u3040-\u309f]/;

/**
 * Does this written form end a kanji with a kana tail — okurigana?
 *
 * True when a hiragana appears somewhere AFTER a kanji: a kanji stem followed by
 * a hiragana tail (生きる, 高い, 一つ, 言う). Pure kana (これ) has no kanji, pure
 * kanji (先生) has no tail, and 時々 has only 々 after its kanji — none is
 * okurigana. A word with a hiragana in front of a later kanji (お茶) is not
 * caught either, because the tail has to come after the kanji, not before it.
 */
export function hasOkurigana(word: string): boolean {
  let seenKanji = false;
  for (const ch of word) {
    if (KANJI.test(ch)) {
      seenKanji = true;
      continue;
    }
    if (seenKanji && HIRAGANA.test(ch)) return true;
  }
  return false;
}

/** Does the word's tail MOVE — i.e. does it conjugate? A non-null conjugation
 * class (verb or い-adjective) means the okurigana is the part that changes;
 * null (a counter, a plain noun) means the tail is fixed. Resolved through the
 * app's own pos→class bridge (`wordClassOf`), because vocab.json stores JMdict's
 * EXPANDED pos names and `classFromTags` speaks the short codes — see the head of
 * word-forms.ts. A word with no vocab row cannot be shown to conjugate, so it
 * counts as fixed. */
function tailMoves(word: string): boolean {
  const row = vocabRow(word);
  return row ? wordClassOf(row) !== null : false;
}

/** Each kana to its rendaku (voiced/semi-voiced) form: か→が, は→ば/ぱ. Only the
 * initial mora of a compound's second element voices, so only its first kana is
 * ever looked up here. */
const RENDAKU_VOICED: Readonly<Record<string, readonly string[]>> = {
  か: ["が"], き: ["ぎ"], く: ["ぐ"], け: ["げ"], こ: ["ご"],
  さ: ["ざ"], し: ["じ"], す: ["ず"], せ: ["ぜ"], そ: ["ぞ"],
  た: ["だ"], ち: ["ぢ"], つ: ["づ"], て: ["で"], と: ["ど"],
  は: ["ば", "ぱ"], ひ: ["び", "ぴ"], ふ: ["ぶ", "ぷ"], へ: ["べ", "ぺ"], ほ: ["ぼ", "ぽ"],
};

/**
 * Does this word show rendaku — a compound whose second (or later) element's
 * initial consonant has voiced at the seam? 仕事 (し+こと→しごと), 手紙
 * (て+かみ→てがみ), 言葉 (こと+は→ことば).
 *
 * Read off the word's `align` — the per-kanji [kanji, surface-in-word, base]
 * breakdown vocab.ts ships (see VocabRow.align). An element voiced iff its
 * surface is its base with the first kana swapped for the voiced counterpart and
 * the rest unchanged; the FIRST element is skipped, because rendaku is what
 * happens to the element that follows another. A word with no align (the ~2.6%
 * jukujikun) cannot be shown to voice and so counts as not-rendaku, the same
 * conservative default `tailMoves` takes.
 *
 * Note this is BLIND to a word whose align already records the voiced form as the
 * base — 時々's second element is stored as [時, どき, どき], not [時, どき, とき] —
 * which is correct for gating: 時々 (rank 154) is far behind the first genuine
 * rendaku word (仕事, rank 22), so the card has always fired by the time it is
 * reached, and 々 carries its own card regardless. See phase-intros.ts.
 */
export function hasRendaku(word: string): boolean {
  const align = vocabRow(word)?.align;
  if (!align) return false;
  return align.some(([, surface, base], i) => {
    if (i === 0 || !surface || !base) return false;
    const voiced = RENDAKU_VOICED[base[0]];
    return !!voiced && voiced.includes(surface[0]) && surface.slice(1) === base.slice(1);
  });
}

/**
 * The teach set, as the steps the walk pages through.
 *
 * Items in the order `itemsFromFacts` gives them — untouched — with at most one
 * card in front and any number behind (a script's last group closes on both its
 * long-vowel and its sokuon card), plus the two word-gated cards (々 and rendaku)
 * ahead of the first word that carries 々, and the three okurigana cards ahead of
 * the first word with a kana tail (intro), the first whose tail moves (moving),
 * and the first whose tail is fixed (fixed).
 */
export function lessonSteps(
  facts: readonly FactId[],
  history?: HistoryFile,
): LessonStep[] {
  const items = itemsFromFacts(facts);
  const steps: LessonStep[] = [];
  // Which tracks are OPENING here — the ones the learner has no record of
  // outside this very lesson. Each owes its intro card ahead of its first item.
  // Optional, and absent means "no track cards": a caller with no history to
  // read (a test naming a teach set, and nothing else today) gets exactly the
  // walk this function produced before track intros existed.
  const started = history ? startedTracks(history, new Set(facts)) : null;
  // Fired at most once each, so a lesson that opens a track and then teaches
  // twenty of its items shows the card once, at the top.
  const trackCardDone = new Set<TrackId>();
  // A converted kana is not taught on its own card. Its whole row is one
  // lesson — "voice the k and it becomes g" — so the first character of a row
  // to come past emits that row's card, at the position it would have had, and
  // its other four fold into the same card rather than adding four steps. See
  // src/data/dakuten-rows.ts.
  const rowsSeen = new Set<string>();
  // The iteration mark rides the first word whose spelling uses 々, and only the
  // first one, so a teach set full of 々 words teaches it once.
  let markedIteration = false;
  // Rendaku rides the first word that actually voices at a compound seam (仕事,
  // rank 22) — far ahead of 々 — so it is a rule already in hand by the time 々's
  // own voicing turns up. See hasRendaku.
  let markedRendaku = false;
  // Okurigana rides words the same way, over three cards each fired once: the
  // idea at the first word with a kana tail, the moving card at the first whose
  // tail conjugates, the fixed card at the first whose tail does not.
  let markedOkurigana = false;
  let markedOkuriganaMoving = false;
  let markedOkuriganaFixed = false;
  // Transitivity rides the first pair item of the teach set — the moment the
  // pair contrast is in play — so its intro lands once, ahead of the first pair,
  // the same word-gated shape the rules above use. See phase-intros.ts.
  let markedTransitivity = false;
  // The counter sound-change rule rides the first phase-2 counted form whose
  // reading shifts (本 or 匹), the same word-gated shape the rules above use: the
  // moment the h→p/b change is first in play is the moment to explain it. 枚 is
  // phase 2 but does not shift, so it never fires this — it is the contrast, not
  // the rule. See isSoundChangeEntry in src/data/counters.ts.
  let markedSoundChange = false;
  for (const item of items) {
    // The track card goes FIRST, ahead of everything else this item might owe —
    // ahead of its conversion row, ahead of any rule card. A learner meeting the
    // words track has to be told what a word track is before being told what
    // okurigana is, and the rule cards below all assume the track's own
    // vocabulary. Placed at the top of the loop rather than after the `continue`
    // a repeated conversion row takes, so a track whose first item happens to be
    // a converted kana still gets its card.
    const track = started ? trackOfItem(item) : null;
    if (track && !started!.has(track) && !trackCardDone.has(track)) {
      trackCardDone.add(track);
      const intro = TRACK_INTROS[track];
      steps.push({ type: "intro", key: intro.id, intro });
    }
    const row = item.kind === "kana" ? dakutenRowFor(item.glyph) : null;
    if (row) {
      if (rowsSeen.has(row.id)) continue;
      rowsSeen.add(row.id);
      steps.push({ type: "conversion", key: row.id, row });
      continue;
    }
    if (!markedIteration && item.glyph.includes(ITERATION_GLYPH)) {
      markedIteration = true;
      steps.push({ type: "intro", key: ITERATION_MARK.id, intro: ITERATION_MARK });
    }
    if (!markedRendaku && item.kind === "word" && hasRendaku(item.glyph)) {
      markedRendaku = true;
      steps.push({ type: "intro", key: RENDAKU.id, intro: RENDAKU });
    }
    if (item.kind === "word" && hasOkurigana(item.glyph)) {
      // The idea leads, so when the first tail word is itself a moving word the
      // intro and moving cards land together ahead of it, intro first.
      if (!markedOkurigana) {
        markedOkurigana = true;
        steps.push({ type: "intro", key: OKURIGANA_INTRO.id, intro: OKURIGANA_INTRO });
      }
      const moves = tailMoves(item.glyph);
      if (!markedOkuriganaMoving && moves) {
        markedOkuriganaMoving = true;
        steps.push({ type: "intro", key: OKURIGANA_MOVING.id, intro: OKURIGANA_MOVING });
      }
      if (!markedOkuriganaFixed && !moves) {
        markedOkuriganaFixed = true;
        steps.push({ type: "intro", key: OKURIGANA_FIXED.id, intro: OKURIGANA_FIXED });
      }
    }
    if (!markedTransitivity && item.kind === "transitivity") {
      markedTransitivity = true;
      steps.push({ type: "intro", key: TRANSITIVITY_INTRO.id, intro: TRANSITIVITY_INTRO });
    }
    if (!markedSoundChange && isSoundChangeEntry(item.entry)) {
      markedSoundChange = true;
      steps.push({ type: "intro", key: COUNTER_SOUND_CHANGE.id, intro: COUNTER_SOUND_CHANGE });
    }
    steps.push({ type: "item", key: item.entry, item });
  }
  if (!items.length) return steps;

  const opensOn = sectionOf(items[0]);
  const before = opensOn ? INTRO_BEFORE[opensOn] : undefined;
  if (before) steps.unshift({ type: "intro", key: before.id, intro: before });

  // Closing a script can owe more than one card — long vowels AND small っ both
  // come due once every shape is known — so this is a list where the opening
  // side is a single card. They are pushed in table order, and each is an
  // ordinary step: the walk pages through them and the HUD counts them like
  // anything else, which is the whole reason both read this function.
  const closesOn = sectionOf(items[items.length - 1]);
  const after = closesOn ? INTRO_AFTER[closesOn] : undefined;
  for (const intro of after ?? []) {
    steps.push({ type: "intro", key: intro.id, intro });
  }

  return steps;
}
