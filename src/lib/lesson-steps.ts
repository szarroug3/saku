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
  PITCH_INTRO,
  RENDAKU,
  TRANSITIVITY_INTRO,
  type PhaseIntro,
} from "@/data/phase-intros";
import { wordPitch } from "@/data/pitch";
import {
  constructionIntroForMarker,
  isConstructionMarker,
} from "@/data/counter-categories";
import { COUNTER_ENTRIES } from "@/data/counters";
import { TRACK_INTROS, type TrackId } from "@/data/track-intros";
import { vocabRow, wordReadingFactId } from "@/data/vocab";
import { grammarLessonsForFacts } from "@/data/grammar/lessons";
import { itemsFromFacts, type LessonItem } from "@/lib/lesson-items";
import { spineIntroPlan } from "@/lib/spine-intros";
import { startedTracks, trackOfItem } from "@/lib/track-open";
import type { FactId, HistoryFile } from "@/types";

/** The tracks whose cards are anchored to a curriculum item instead of opened by
 * a subject. They are the three roles of the one spine, and spine-intros.ts owns
 * when each fires. */
const SPINE_TRACKS: ReadonlySet<TrackId> = new Set<TrackId>(["radical", "kanji", "word"]);

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
 * ahead of the first word that carries 々, and the two word-gated cards (rendaku)
 * ahead of the first word with rendaku.
 */
export function lessonSteps(
  facts: readonly FactId[],
  history?: HistoryFile,
  // The concept cards this learner has already been shown, by intro id. Absent
  // means none, which is the right default for a caller with no store to read
  // (SSR, a test naming a teach set) and the safe error either way: a card seen
  // twice costs ten seconds, a card never seen costs the learner the word. See
  // src/lib/intro-shown.ts.
  shownIntros: ReadonlySet<string> = new Set(),
): LessonStep[] {
  // GRAMMAR takes a different walk: its pages are AUTHORED, not derived from the
  // teach set the way a kana lesson's steps are. A grammar sitting is one form
  // lesson OR a bundle of up to three pattern lessons (see grammar-lesson.ts), so
  // emit EVERY lesson the teach set names, in teaching order, each lesson's pages
  // in turn — a teach page is a concept card (the same PhaseIntro kana uses), a
  // pattern page is the terse recipe tile the track always showed. Anything that
  // is not a grammar lesson falls through to the kana-native walk below.
  // A GENERATIVE NUMBER unit's teach set is a single marker pseudo-fact (see
  // src/data/counters.ts), which resolves to no glyph and no item — SOMETIMES
  // prepended with the counter kanji's prereq facts (its full component chain),
  // which DO resolve to kanji/radical item cards. So the walk teaches those
  // prereq item cards first, then the unit's one rule card — the tens/big compose
  // rules, or a counter's attach-and-shift card — and the generated round follows
  // in the drill leg (src/lib/counter-lesson.ts). The prereq kanji are context for
  // the rule, not the lesson's own subject, so they get no spine or track cards,
  // the same call a keigo lesson makes for the kanji inside its verbs. Detected
  // ahead of everything else because the marker has no FactInfo for the generic
  // walk below to group.
  const genMarker = facts.find(isConstructionMarker);
  if (genMarker) {
    const intro = constructionIntroForMarker(genMarker);
    const prereqFacts = facts.filter((f) => f !== genMarker);
    const steps: LessonStep[] = itemsFromFacts(prereqFacts).map((item) => ({
      type: "item",
      key: item.entry,
      item,
    }));
    // A marker with no intro cannot happen (every marker maps to a category), but
    // guard rather than crash.
    if (intro) steps.push({ type: "intro", key: intro.id, intro });
    return steps;
  }

  const grammarLessons = grammarLessonsForFacts(facts);
  if (grammarLessons.length > 0) {
    const grammarSteps: LessonStep[] = [];
    for (const grammarLesson of grammarLessons) {
      for (const page of grammarLesson.pages) {
        if (page.kind === "teach") {
          grammarSteps.push({ type: "intro", key: page.card.id, intro: page.card });
        } else {
          for (const item of itemsFromFacts([...page.facts])) {
            grammarSteps.push({ type: "item", key: item.entry, item });
          }
        }
      }
    }
    return grammarSteps;
  }

  const items = itemsFromFacts(facts);
  const steps: LessonStep[] = [];
  // Which tracks are OPENING here — the ones the learner has no record of
  // outside this very lesson. Each owes its intro card ahead of its first item.
  // Optional, and absent means "no track cards": a caller with no history to
  // read (a test naming a teach set, and nothing else today) gets exactly the
  // walk this function produced before track intros existed.
  const teachSet = new Set(facts);
  const started = history ? startedTracks(history, teachSet) : null;
  // Fired at most once each, so a lesson that opens a track and then teaches
  // twenty of its items shows the card once, at the top.
  const trackCardDone = new Set<TrackId>();
  // The three spine cards (radical, kanji, word) are planned over the whole walk
  // and skipped in the per-item track block below. See spine-intros.ts: on one
  // ordered curriculum a subject is not a track, and where a card goes depends on
  // what else the walk contains.
  // Spine intros belong to the curriculum; don't fire them inside a keigo OR a
  // counters lesson, where the prereq kanji are context for the material, not the
  // lesson's own subject. A counters form lesson now prepends number-kanji prereq
  // items (囗, 四, …) exactly the way a keigo lesson prepends its verbs' kanji.
  const isContextKanjiLesson =
    items.some((it) => it.kind === "keigo") ||
    items.some((it) => COUNTER_ENTRIES.has(it.entry));
  const spinePlan =
    history && !isContextKanjiLesson
      ? spineIntroPlan(items, history, teachSet, shownIntros)
      : new Map<number, PhaseIntro[]>();
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
  // Transitivity rides the first pair item of the teach set — the moment the
  // pair contrast is in play — so its intro lands once, ahead of the first pair,
  // the same word-gated shape the rules above use. See phase-intros.ts.
  let markedTransitivity = false;
  // The pitch card rides the first word carrying a verified pitch, so the overline
  // is taught before it is first drawn (on that word's reveal). ONCE EVER, not per
  // lesson: it is a concept card whose id lives in CONCEPT_CARD_IDS, so a learner
  // who has already read it (`shownIntros`) is never shown it again — ~69% of
  // words have pitch, so a per-lesson gate would put it ahead of nearly every word
  // lesson. Gated on `history` for the same reason the spine cards are: a caller
  // with no history (a test naming a teach set) gets the pre-track walk, and only
  // the app, which always passes history and the shown set, ever fires it.
  let markedPitch = shownIntros.has(PITCH_INTRO.id) || !history;
  items.forEach((item, index) => {
    // THE CONCEPT CARDS GO FIRST, ahead of everything else this item might owe:
    // ahead of its conversion row, ahead of any rule card. A learner meeting
    // words has to be told what a word is before being told what okurigana is,
    // and the rule cards below all assume that vocabulary. Placed at the top of
    // the loop and not after the `continue` a repeated conversion row takes, so
    // a track whose first item happens to be a converted kana still gets its
    // card.
    //
    // The SPINE cards lead, at the positions the plan chose. More than one can
    // land on the same item, and they arrive down the hierarchy (kanji, then
    // radical), so the second reads as one level deeper and not as an unrelated
    // second announcement.
    for (const intro of spinePlan.get(index) ?? []) {
      steps.push({ type: "intro", key: intro.id, intro });
    }
    // Then the remaining TRACK cards, still opened by subject: kana's two
    // scripts, grammar, counters and keigo are each their own track with their
    // own first lesson, and nothing about the spine changed that. The three spine
    // tracks are skipped here, because the block above owns them.
    const track = started ? trackOfItem(item) : null;
    if (track && !SPINE_TRACKS.has(track) && !started!.has(track) && !trackCardDone.has(track)) {
      trackCardDone.add(track);
      const intro = TRACK_INTROS[track];
      steps.push({ type: "intro", key: intro.id, intro });
    }
    const row = item.kind === "kana" ? dakutenRowFor(item.glyph) : null;
    if (row) {
      // `return` and not `continue`: the walk is planned per index now, so the
      // loop is a forEach. Same skip either way.
      if (rowsSeen.has(row.id)) return;
      rowsSeen.add(row.id);
      steps.push({ type: "conversion", key: row.id, row });
      return;
    }
    if (!markedIteration && item.glyph.includes(ITERATION_GLYPH)) {
      markedIteration = true;
      steps.push({ type: "intro", key: ITERATION_MARK.id, intro: ITERATION_MARK });
    }
    if (!markedRendaku && item.kind === "word" && hasRendaku(item.glyph)) {
      markedRendaku = true;
      steps.push({ type: "intro", key: RENDAKU.id, intro: RENDAKU });
    }
    if (!markedTransitivity && item.kind === "transitivity") {
      markedTransitivity = true;
      steps.push({ type: "intro", key: TRANSITIVITY_INTRO.id, intro: TRANSITIVITY_INTRO });
    }
    // The counter sound-change rule is no longer form-gated here: each object
    // counter is a generative CATEGORY that carries its own rule card (attach +
    // sound shift) as its whole teach walk, detected by the marker branch above.
    // The overline is about to appear on this word, so teach it first. Gated on
    // the item TEACHING the word (its reading fact is in the step), NOT on
    // item.kind: a folded character like 何 leads as its kanji (kind "kanji") yet
    // teaches the word 何 in the same step, and its word-reading reveal draws the
    // overline. Keying on kind alone missed exactly that — the first pitch word a
    // learner meets — so key on the fact instead. wordPitch is on the written
    // form; a word with none draws no line and is not what this card waits for.
    if (
      !markedPitch &&
      wordPitch(item.glyph) !== null &&
      item.facts.includes(wordReadingFactId(item.glyph))
    ) {
      markedPitch = true;
      steps.push({ type: "intro", key: PITCH_INTRO.id, intro: PITCH_INTRO });
    }
    steps.push({ type: "item", key: item.entry, item });
  });
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
