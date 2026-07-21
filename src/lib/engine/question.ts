// How to ASK a fact — the seam that makes a subject a plugin.
//
// This file exists because engine/index.ts said it should. Its `QuestionType`
// was "a dead seam, deliberately left alone… its one flaw is being keyed on
// `char: string`; re-keying it to `fact: FactId` is what makes a subject a
// plugin (facts + prompt + checker + distractors), and that lands with the
// first kanji". The first kanji has landed, so here it is, with consumers.
//
// WHY A REGISTRY AND NOT A DERIVATION
// ===================================
// You could ask any fact mechanically off FactInfo alone: show `glyph`, accept
// `answers`. That works, it is ten lines, and for a kanji reading it asks a
// QUESTION THAT CANNOT BE GRADED — the exact failure the entry/fact split was
// built to prevent, reintroduced one layer up.
//
//   「生」 → ?    has nine answers. セイ, ショウ, い, う, は, なま, き, お, ふ.
//   「生」in 人生 → ?  has one.
//
// The fact id already carries the anchor word; the WORD is what makes the
// reading askable. FactInfo is deliberately thin and does not carry it, so
// the anchor is read from the kanji subject's own index — exactly as
// types/index.ts prescribes: "everything a subject knows about its own
// material… stays in that subject's module".
//
// So a subject does not just supply facts. It supplies facts plus the three
// things you need to ask one, and the drill screen knows none of them.

import { CHAR_INDEX, KANA_SUBJECT, LOOK_GROUP, kanaFact } from "@/data/characters";
import { distractorsFor } from "@/data/confusable";
import { crossScriptLookalikes } from "@/data/cross-script";
import {
  GRAMMAR_SUBJECT,
  grammarMeaning,
  grammarProduction,
  patternMeaningFactId,
  patternProductionFactId,
} from "@/data/grammar";
import { RECIPES, isProducible, patternLabel, type Host } from "@/data/grammar/recipes";
import { buildExample } from "@/lib/grammar/example";
import { selectionMcsFor } from "@/lib/grammar/mc";
// The blank's own text, so the frame in `context` and the halo stand-in for a
// host-less signature are the same string the generator wrote.
import { BLANK as SELECTION_BLANK } from "@/lib/grammar/questions";
import { readerFor, wordKnown } from "@/lib/grammar/readable";
import { BEHAVIOR } from "@/lib/config";
import { apply, hostOfClass } from "@/lib/grammar/apply";
import {
  pickVehicle,
  transitivityAllows,
  type Rng,
  type Vehicle,
} from "@/lib/grammar/vehicles";
import type { WordClass } from "@/lib/conjugate";
import {
  KANJI_SUBJECT,
  READING_INDEX,
  meaningFactId,
  readingFactId,
} from "@/data/kanji";
import {
  VOCAB,
  VOCAB_SUBJECT,
  isKanaWord,
  vocabRow,
  wordMeaningFactId,
  wordReadingFactId,
} from "@/data/vocab";
import { factInfo } from "@/lib/facts";
import {
  TRANSITIVITY_SUBJECT,
  transitivitySide,
} from "@/data/transitivity-facts";
import { PROMPT as TRANSITIVITY_PROMPT } from "@/lib/transitivity";
import { isKanaOnly, romajiMatches } from "@/lib/romaji";
import type { Direction, FactId, HistoryFile } from "@/types";

/**
 * What to put on screen. Two parts, because one is not enough and three is
 * inventing a layout.
 *
 * `context` is the whole reason this type exists rather than a bare string:
 * "生" alone is an ungradeable question and "生 in 人生" is a fair one, and the
 * difference is one short line under the glyph.
 */
export interface Prompt {
  /** The big thing. Rendered in a JP font when `jp` is true. */
  glyph: string;
  /** True when `glyph` is Japanese and should get the quiz's JP font. */
  jp: boolean;
  /**
   * The line that makes the question ANSWERABLE — "in 人生", "meaning".
   * Null when the glyph asks itself, which is the kana case.
   *
   * NOT the same thing as `hint`, and the difference is not cosmetic: this is
   * part of the question. Hiding it would leave "生 → ?", which has nine right
   * answers. Nothing may gate it behind a setting.
   */
  context: string | null;
  /**
   * Optional decoration — kana's "hiragana" / "katakana" script tag.
   *
   * This is the half of the old script label that was genuinely a preference:
   * knowing し is hiragana doesn't help you answer it, it just tells you which
   * chart you are in. `cfg.scriptLabel` hides this and only this.
   */
  hint: string | null;
  /**
   * A SECOND line of question, under `context`. Optional, and today exactly one
   * subject has anything to put here: a grammar SELECTION showing, whose
   * question is a Japanese sentence with a blank (`context`) plus its English
   * translation (this).
   *
   * Not decoration and not gateable, for the same reason `context` isn't: the
   * English is the only thing telling you WHICH pattern the blank wants, so a
   * selection card without it is unanswerable rather than hard (see the
   * SelectionQuestion docs in lib/grammar/questions.ts). A separate field rather
   * than a longer `context` because the two lines are different languages and
   * want different weights — and because every other subject returns nothing
   * here and renders exactly as it did.
   */
  note?: string | null;
}

/**
 * A presentation hint the caller may pass to `prompt`. Today its one member is
 * `anchor`: the word to frame a kanji reading question on, when the caller knows
 * a word the user has actually learned and the fact's own (ingest-chosen) anchor
 * is not it. See word-unlock.ts — the answer is identical in every attesting
 * word, so this moves only the CONTEXT, never the grading. Every subject but
 * kanji ignores it, and a caller with nothing to say omits it and gets the
 * fact's default framing.
 */
export interface PromptContext {
  anchor?: string;
  /**
   * The per-showing vehicle for a grammar PRODUCTION question — the verb to
   * build the pattern on THIS time. See lib/grammar/vehicles.ts for why the
   * fact stays fixed while the showing varies: naming the target makes the
   * answer unique for any legal vehicle, so the drill picks one and grades by
   * re-running the recipe on it. Every subject but grammar ignores it, and a
   * grammar showing with none omits it and gets the fixed vehicle baked in the
   * fact (行く) — the pre-variety behaviour, unchanged.
   */
  grammarVehicle?: GrammarVehicle;
  /**
   * The per-showing SELECTION frame for a grammar MEANING fact — the corpus
   * sentence whose blank this card is asking the learner to fill.
   *
   * Same discipline as `grammarVehicle`: the FACT is fixed ("do you know what
   * 〜てから means and where it goes"), the SHOWING varies, and the showing is
   * rolled once at ask time and carried here so prompt, option labels and
   * reveal all agree. Absent → the meaning fact is asked the old way (the
   * pattern, "meaning", glosses to choose between), unchanged.
   */
  grammarSelection?: GrammarSelection;
}

/** A verb picked to carry a grammar production question this showing. Plain
 * data (no functions) so it can ride in the drill's serialized runtime. */
export interface GrammarVehicle {
  readonly surface: string;
  readonly kana: string;
  readonly cls: WordClass | null;
}

/**
 * One selection showing, flattened to plain data so it rides the drill's
 * serialized runtime beside `GrammarVehicle`.
 *
 * `choices` is the whole reason this type carries FACT ids rather than the
 * recipe ids GrammarMc speaks: the drill's MC control takes `FactId[]` and
 * grades by WHICH fact was clicked, so handing it the board as facts means the
 * existing control renders and scores a selection card with no new grading
 * path — and the fact it scores is the answer pattern's MEANING fact, which is
 * the standing the Library entry page shows. The mapping recipe id → fact id
 * happens once, in `grammarSelectionFor`.
 */
export interface GrammarSelection {
  /** The sentence with the pattern (and its host verb) blanked out. */
  readonly frame: string;
  /** The host verb's dictionary form; the blank swallowed the conjugated one. */
  readonly host: string | null;
  /** The human English translation. Always shown — it is the only context. */
  readonly en: string;
  /** Tatoeba id, for attribution and for reporting a bad item. */
  readonly sourceId: number;
  /** The board, already shuffled. Meaning facts; exactly one is the asked one. */
  readonly choices: readonly FactId[];
}

/**
 * Everything the drill screen needs in order to ask about a fact without
 * knowing what kind of thing it is.
 *
 * Keyed by FactId throughout. No method here takes a character, and that is
 * the point: the moment one did, kana's glyph would be its key again and the
 * whole rekey would have been for nothing.
 */
export interface QuestionType {
  id: string;
  /** What to show, asking `fact` in `dir`. `ctx` is an optional presentation
   * hint — see PromptContext; the kanji reading question reads its anchor, the
   * grammar production question reads its vehicle. */
  prompt(fact: FactId, dir: Direction, ctx?: PromptContext): Prompt;
  /** Whether `given` answers `fact` in `dir`. `ctx` carries the same
   * per-showing presentation as `prompt` — grammar grades against the vehicle
   * it prompted on, not the fixed one baked in the fact. */
  check(fact: FactId, dir: Direction, given: string, ctx?: PromptContext): boolean;
  /**
   * Plausible WRONG answers for a multiple-choice `fact`, as facts.
   *
   * Returns fewer than `n` — or none — rather than padding with randoms. An
   * option nobody would ever pick is not a distractor, it is a free point, and
   * four options where three are absurd is a one-option question wearing a
   * costume. `ctx` lets grammar choose distractors that are wrong for THIS
   * vehicle (行った against 行ってから, not against 食べてから).
   */
  distractors(fact: FactId, n: number, ctx?: PromptContext): FactId[];
  /**
   * The visible text of an MC option, when the fact's own answer/glyph is not
   * it. Grammar production shows the option pattern built on the SHOWING's
   * vehicle (行きたい, not the baked 行きたい of a fixed fact — same string here,
   * but 食べたい when the vehicle is 食べる). Absent → the drill falls back to the
   * fact's glyph/answer, which is right for every other subject.
   */
  optionLabel?(fact: FactId, dir: Direction, ctx?: PromptContext): string | null;
  /**
   * The answer to REVEAL, when it is not the fact's first baked answer — the
   * grammar production answer on this showing's vehicle. Absent → the drill
   * reveals `factInfo(fact).answers[0]`, right for everyone else.
   *
   * `dir` because the answer is not always the same string both ways round: an
   * en2jp grammar meaning card asks for the PATTERN, so revealing the fact's
   * first baked answer would reprint the English that was the prompt — "decide
   * to X pattern = decide to X", which tells you nothing you were not shown.
   */
  answerReveal?(fact: FactId, dir: Direction, ctx?: PromptContext): string | null;
  /**
   * When set, this fact is ONLY ever asked as multiple choice — never typed,
   * whatever the session's answer style. The drill reads this instead of
   * deciding typeability from the fact's script.
   *
   * `true` means both directions. Transitivity sets it: the question is "pick
   * the verb for this English cue", and typing a verb from an English sentence
   * is a different, harder task than the one being taught (and there is no
   * romaji prompt to type against).
   *
   * A Direction means that direction only, and the other side stays typed.
   * Kana sets `"en2jp"`: there the prompt IS the romaji, so a typed box grades
   * the prompt retyped as correct and the card tests nothing. Picking あ off a
   * board is a real recall test; jp2en (show あ, type "a") is untouched and
   * stays typed.
   *
   * Read it through `mcOnlyIn`, never directly — a bare truthiness test on a
   * Direction value is true in both directions and silently loses the scoping.
   */
  mcOnly?: boolean | Direction;
  /**
   * When set, this fact is ALWAYS asked in this one direction, whatever the
   * session enables. Transitivity sets `en2jp`: the cue is English and the
   * answer is the Japanese verb, and there is no coherent jp2en reading of it
   * ("what does 開ける mean" is a vocab question, not a transitivity one). The
   * drill uses this in place of picking a direction from the enabled set.
   */
  fixedDir?: Direction;
}

/** Case- and space-forgiving comparison, for both scripts. `answers` holds
 * romaji for kana, hiragana for readings and English for meanings; all three
 * want the same forgiveness and none of them wants any more than this. */
function accepts(fact: FactId, given: string): boolean {
  const info = factInfo(fact);
  if (!info) return false;
  const g = given.trim().toLowerCase();
  return info.answers.some((a) => a.trim().toLowerCase() === g);
}

/** The canonical answer to display — the first one. */
function answerOf(fact: FactId): string {
  return factInfo(fact)?.answers[0] ?? "";
}

function glyphOfFact(fact: FactId): string {
  return factInfo(fact)?.glyph ?? "";
}

/**
 * The en2jp answer check, shared by every subject: you are shown a meaning or a
 * reading and must produce the Japanese GLYPH.
 *
 * A directly-typed glyph (か, これ, 生 from an IME) always counts. On top of
 * that, when the glyph is ALL KANA — a kana word like これ, a kana character —
 * a romaji spelling of it counts too, so "kore" answers これ with no IME. A
 * glyph containing kanji is left exact-match only: there is no romaji for 生, so
 * romaji cannot and must not grade it (the drill offers those as multiple
 * choice instead — see DrillScreen.nextQuestion).
 */
function checkEn2jp(fact: FactId, given: string): boolean {
  return checkProduces(glyphOfFact(fact), given);
}

/**
 * The jp2en answer check, shared by every subject: you are shown the Japanese
 * and must produce what it SAYS — a reading, or an English meaning.
 *
 * `accepts` on its own is exact-match (case- and space-forgiving), which is
 * right for an English meaning and WRONG for a reading. A kanji reading answer
 * is all kana, and this owner has no IME: she types "mei" for めい exactly as
 * she types "a" for あ in the kana drill, and exactly as the en2jp side of every
 * subject already allows. So an all-kana answer is graded through checkProduces
 * as well, which is the same romaji forgiveness en2jp has always had.
 *
 * The asymmetry cuts only one way: an answer containing KANJI, and an English
 * meaning, are untouched, because isKanaOnly refuses both. Romaji cannot grade
 * 生 and must not start grading "life".
 */
function checkJp2en(fact: FactId, given: string): boolean {
  if (accepts(fact, given)) return true;
  const info = factInfo(fact);
  if (!info) return false;
  return info.answers.some((a) => checkProduces(a, given));
}

/**
 * Whether `given` produces the Japanese `target`: a direct match (an IME glyph,
 * or kana typed as kana) always counts, and when `target` is ALL KANA a romaji
 * spelling of it counts too. Factored out of checkEn2jp because a word asked
 * en2jp by its MEANING is answered with its READING — a different target than
 * its written glyph — and both wants exactly this forgiveness. See
 * wordQuestions.check and en2jpTypeable.
 */
function checkProduces(target: string, given: string): boolean {
  if (given.trim() === target) return true;
  return isKanaOnly(target) && romajiMatches(given, target);
}

/**
 * Cross-script lookalike distractors for `glyph`, as facts — カ's 力, 力's カ.
 *
 * The one place a kana question reaches into the kanji subject and vice versa,
 * and it earns the crossing: no kana looks more like カ than 力 does, and the
 * same-script fill can never offer it. A kana lookalike resolves to its reading
 * fact, a kanji to its meaning fact; anything the data no longer has is dropped.
 * These are DISTRACTORS ONLY — confusedWith resolves scores within the deck and
 * never consults this, so a predicted pair cannot become a confusion the user
 * did not demonstrate.
 */
function crossScriptDistractors(glyph: string): FactId[] {
  return crossScriptLookalikes(glyph)
    .map((other) => (CHAR_INDEX[other] ? kanaFact(other) : meaningFactId(other)))
    .filter((f) => factInfo(f));
}

// ---------- kana: the floor case ----------
//
// One entry, one fact, one reading, and the glyph really is the whole question.
// This is the only subject where `context` is null, and it is why the char-keyed
// model looked correct for so long.

const kanaQuestions: QuestionType = {
  id: "kana",
  prompt(fact, dir) {
    const c = glyphOfFact(fact);
    const script = CHAR_INDEX[c]?.setLabel.toLowerCase() ?? null;
    return dir === "jp2en"
      ? { glyph: c, jp: true, context: null, hint: script }
      : {
          glyph: answerOf(fact),
          jp: false,
          context: null,
          hint: script && `give the ${script}`,
        };
  },
  // en2jp is multiple choice ONLY. The en2jp prompt for a kana fact is its
  // romaji — "a" for あ — so a typed box graded through checkEn2jp accepted the
  // prompt typed straight back and the card tested nothing, across all 214 kana.
  // The romaji forgiveness in checkProduces is right everywhere else (これ must
  // be answerable "kore" with no IME) and is left alone; kana en2jp opts out of
  // typing entirely instead, which also keeps the card answerable without an IME.
  mcOnly: "en2jp",
  check(fact, dir, given) {
    // en2jp wants the GLYPH and nothing else. No romaji forgiveness here: the
    // romaji is the prompt, so forgiving it grades the prompt as the answer.
    // MC options carry the glyph, so exact match is all the board ever needs.
    return dir === "jp2en"
      ? checkJp2en(fact, given)
      : given.trim() === glyphOfFact(fact);
  },
  distractors(fact, n) {
    const c = glyphOfFact(fact);
    const info = CHAR_INDEX[c];
    if (!info) return [];
    // Lookalikes first — they are the mistakes you would actually make — then
    // same-script fill, which is what the char-keyed buildMcOptions did and is
    // still right here.
    const looks = (LOOK_GROUP[c] ?? []).filter((x) => CHAR_INDEX[x]);
    const rest = Object.keys(CHAR_INDEX).filter(
      (x) => x !== c && CHAR_INDEX[x].set === info.set && !looks.includes(x),
    );
    // Cross-script lookalikes lead: 力 is the sharpest wrong option カ has, and
    // no kana in the same-script fill comes close.
    return [
      ...crossScriptDistractors(c),
      ...[...looks, ...shuffled(rest)].map(kanaFact),
    ].slice(0, n);
  },
};

// ---------- kanji ----------

/** The word a reading fact is anchored to, or null for a meaning fact. */
function anchorOf(fact: FactId): string | null {
  return READING_INDEX.get(fact)?.anchor ?? null;
}

/**
 * How to frame "which reading" for this anchor.
 *
 * 632 of the 3,178 reading facts (20%) are anchored to the kanji ITSELF — the
 * word 一 is a word, and it is read いち. Rendering those the general way gives
 * "一 · in 一", which reads as a bug and tells you nothing. It is not a bug and
 * the fact is not redundant: 一 on its own is いち while 一 in 一つ is ひと, and
 * those are two things you can be asked and get separately wrong. So the
 * standalone case gets the words it actually means.
 */
function frameFor(glyph: string, anchor: string, lead: string): string {
  return anchor === glyph ? "on its own" : `${lead} ${anchor}`;
}

const kanjiQuestions: QuestionType = {
  id: "kanji",
  prompt(fact, dir, ctx) {
    const glyph = glyphOfFact(fact);
    // The fact's own anchor decides whether this is a reading question at all
    // (null → a meaning fact). When it IS a reading and the caller named a word
    // the user knows, frame on THAT instead — the ingest's anchor is the
    // evidence-richest word, not the one the learner was taught. Same reading,
    // fairer question. See word-unlock.ts / PromptContext.
    const baseAnchor = anchorOf(fact);
    const anchor = baseAnchor ? (ctx?.anchor ?? baseAnchor) : null;
    if (dir === "jp2en") {
      return {
        glyph,
        jp: true,
        // THE LINE THIS FILE EXISTS FOR. Without it the question is "生 → ?",
        // which has nine right answers and grades none of them.
        context: anchor ? frameFor(glyph, anchor, "in") : "meaning",
        hint: null,
      };
    }
    return {
      glyph: answerOf(fact),
      jp: !!anchor,
      context: anchor ? frameFor(glyph, anchor, "read this way in") : null,
      hint: null,
    };
  },
  check(fact, dir, given) {
    return dir === "jp2en"
      ? checkJp2en(fact, given)
      : checkEn2jp(fact, given);
  },
  distractors(fact, n) {
    const c = glyphOfFact(fact);
    const anchor = anchorOf(fact);

    // A READING question's wrong answers are THIS KANJI'S OTHER READINGS.
    //
    // Not other kanji's readings, which was the first thing I wrote and it is
    // wrong. "生 in 人生 → ?" is asking WHICH OF 生'S NINE READINGS applies
    // here; the mistake you actually make is answering ショウ instead of セイ.
    // Offering 先's readings instead asks "which of these is a reading of 生 at
    // all", which is a different and much easier question — and it can hand you
    // the answer for free, since two kanji sharing a reading would put セイ on
    // the board twice.
    if (anchor) {
      const siblings = [...READING_INDEX.values()]
        .filter((r) => r.k === c && r.anchor !== anchor)
        .map((r) => readingFactId(r.k, r.anchor));
      // Same-answer siblings are dropped: 生 has one セイ fact per anchor word,
      // so an option reading セイ next to an answer reading セイ is two right
      // answers on one board.
      const answer = answerOf(fact).toLowerCase();
      const seen = new Set([answer]);
      const out: FactId[] = [];
      for (const s of shuffled(siblings)) {
        const a = answerOf(s).toLowerCase();
        if (seen.has(a)) continue;
        seen.add(a);
        out.push(s);
        if (out.length >= n) break;
      }
      return out;
    }

    // A MEANING question's wrong answers are the meanings of kanji you would
    // mistake this one for — the confusable pairs, which is what that data is
    // for and its only sanctioned use — plus any katakana that looks like this
    // kanji (力 → カ), the same crossing the kana side makes in reverse.
    return [
      ...crossScriptDistractors(c),
      ...distractorsFor(c, n).map(meaningFactId),
    ]
      .filter((f) => factInfo(f))
      .slice(0, n);
  },
};

// ---------- words ----------

const wordQuestions: QuestionType = {
  id: "word",
  prompt(fact, dir) {
    // A word has two facts — how it is READ and what it MEANS — and they are
    // different questions about the same glyph. The reading fact's answer is
    // kana; the meaning fact's is English.
    const reading = isWordReading(fact);
    if (dir === "jp2en") {
      return {
        glyph: glyphOfFact(fact),
        jp: true,
        context: reading ? "reading" : "meaning",
        hint: null,
      };
    }
    // en2jp. The READING fact is the typed en→jp gap: shown the English gloss,
    // the learner produces the word's kana reading — which romaji can spell, so
    // it is answerable with no IME (see en2jpTypeable). The glyph shown is the
    // gloss; the answer to reveal is answerOf (the reading kana), which the
    // generic reveal already prints. The MEANING fact keeps the older en→jp
    // shape: shown the gloss, produce the WRITTEN word (先生), which carries
    // kanji and so is offered as multiple choice (or IME), never a romaji box.
    if (reading) {
      return {
        glyph: factInfo(fact)?.meaning ?? "",
        jp: false,
        context: "reading",
        hint: null,
      };
    }
    return { glyph: answerOf(fact), jp: false, context: "in japanese", hint: null };
  },
  check(fact, dir, given) {
    if (dir === "jp2en") return checkJp2en(fact, given);
    // The reading fact's en→jp answer is its kana READING, not its glyph. Accept
    // it typed (romaji or kana) exactly the way every other kana target is.
    if (isWordReading(fact)) return checkProduces(answerOf(fact), given);
    return checkEn2jp(fact, given);
  },
  distractors(fact, n) {
    // A word has no confusable table, but it has neighbours: the other everyday
    // words at a similar level. Ordered by nearness in beginnerRank — so an
    // option is a word the learner is about as likely to know — then by a
    // similar written length, so it is not eliminable on shape alone. Each
    // neighbour contributes the SAME KIND of fact as the one asked: a reading
    // question gets other readings (kana), a meaning question other glosses
    // (English). buildMcOptions drops any that share the answer, so two words
    // that gloss or read alike can never both sit on the board.
    const info = factInfo(fact);
    const target = info && vocabRow(info.glyph);
    if (!info || !target) return [];
    const reading = isWordReading(fact);
    const toFact = reading ? wordReadingFactId : wordMeaningFactId;
    const pool = VOCAB.filter(
      // A reading question needs a word that HAS a reading fact — kana words do
      // not (これ is its own reading), so they can only be meaning distractors.
      (w) => w.keb !== info.glyph && (!reading || !isKanaWord(w)),
    ).sort((a, b) => {
      const byRank =
        Math.abs(a.beginnerRank - target.beginnerRank) -
        Math.abs(b.beginnerRank - target.beginnerRank);
      if (byRank !== 0) return byRank;
      return (
        Math.abs(a.keb.length - target.keb.length) -
        Math.abs(b.keb.length - target.keb.length)
      );
    });
    const out: FactId[] = [];
    for (const w of pool) {
      const f = toFact(w.keb);
      if (!factInfo(f)) continue;
      out.push(f);
      if (out.length >= n) break;
    }
    return out;
  },
};

/**
 * Whether `fact` may only be asked as multiple choice in `dir`.
 *
 * The one reader of `QuestionType.mcOnly`, because that field is a boolean OR a
 * Direction and `!qt.mcOnly` on the Direction form is wrong in the direction it
 * was meant to leave alone. Everything that needs the answer asks here.
 */
export function mcOnlyIn(fact: FactId, dir: Direction): boolean {
  const flag = questionsFor(fact).mcOnly;
  return flag === true || flag === dir;
}

/**
 * Whether an en2jp card for `fact` can be answered by TYPING romaji — the
 * question the drill screen asks to decide between a text box and multiple
 * choice. True when the Japanese to produce is all kana: for most subjects that
 * is the glyph itself, but a WORD asked en2jp by its reading is answered with
 * its kana reading, which is typeable even though the written word has kanji.
 * A word asked by its meaning still produces the written glyph, so it follows
 * the same all-kana test as everyone else.
 */
export function en2jpTypeable(fact: FactId): boolean {
  const info = factInfo(fact);
  if (!info) return false;
  if (info.subject === VOCAB_SUBJECT && isWordReading(fact)) return true;
  return isKanaOnly(info.glyph);
}

function isWordReading(fact: FactId): boolean {
  const info = factInfo(fact);
  return !!info && wordReadingFactId(info.glyph) === fact;
}

/** Kana, kanji, or the citation mark 〜 — and no latin letter anywhere. Both
 * halves matter: "sushi" has no Japanese in it, and a gloss like "OK" that
 * happened to carry a 〜 is still English and still typed as latin. */
function isJapaneseText(str: string): boolean {
  const s = str.trim();
  if (!s || /[A-Za-z]/.test(s)) return false;
  return /[぀-ヿ㐀-䶿一-鿿々〜～]/.test(s);
}

/**
 * Whether the answer to `fact` in `dir` is written in JAPANESE — the single
 * question that decides whether a typed card gets live romaji→kana conversion.
 *
 * THE AXIS IS (FACT, DIRECTION), NOT DIRECTION. The drill used to convert
 * whenever `dir === "en2jp"`, which is half right and half backwards. It left a
 * jp2en typed card — a kanji reading, a word reading, a grammar production —
 * with a latin box and no way for a learner without an IME to answer at all.
 * But flipping it on for every typed card converts the four cards whose answer
 * is ENGLISH: type "life" on a kanji meaning card and the box turns it into
 * kana and marks it wrong, which is the same shape of failure as grading a
 * correct romaji answer wrong.
 *
 *   kanji READING jp2en   せい          → convert
 *   word  READING jp2en   せんせい       → convert
 *   grammar PRODUCTION    行ってから      → convert
 *   kana          jp2en   "a"           → do NOT
 *   kanji MEANING jp2en   "life"        → do NOT
 *   word  MEANING jp2en   "teacher"     → do NOT
 *   grammar MEANING jp2en "after doing X" → do NOT
 *
 * en2jp is Japanese-by-construction for every subject: the direction's whole
 * definition is "you are shown a meaning or a reading and must produce the
 * Japanese". jp2en is the side that splits, and it splits on what the fact's
 * own baked answers are made of — a reading is kana, a meaning is English —
 * so the data answers the question and no subject list has to be maintained
 * here. EVERY answer must be Japanese, not merely one: a fact that would accept
 * a latin spelling must keep a latin box, or conversion takes that answer away.
 *
 * Lives here, next to the check helpers, because it is the same kind of claim
 * they make about a fact and it must agree with them; and it is exported so the
 * drill has exactly ONE place that decides this.
 */
export function answerIsJapanese(fact: FactId, dir: Direction): boolean {
  const info = factInfo(fact);
  if (!info) return false;
  if (dir === "en2jp") return true;
  return info.answers.length > 0 && info.answers.every(isJapaneseText);
}

// ---------- grammar ----------
//
// Two aspects. PRODUCTION is direction-insensitive — "build 〜てから on 行く" has
// one answer whichever way the drill turns the card, so it ignores `dir` and
// grades against the built form in kanji and in kana.
//
// MEANING IS NOT, and pretending it was is what shipped the degenerate card.
// A meaning fact holds a pair (pattern, gloss), and a direction picks which half
// is the question:
//
//   jp2en   〜てから      → "after doing X"   (the gloss; the baked answers)
//   en2jp   "after doing X" → 〜てから         (the pattern)
//
// Ignoring `dir` meant en2jp showed the pattern AND offered glyphs, so the
// prompt was reprinted on a button. Both `prompt` and `check` read the
// direction now; `distractors` does not need to, because the same set of rival
// patterns is wrong either way round.
//
// THE SAFETY IS IN THE DISTRACTORS, and it is the whole reason grammar can be
// multiple-choice at all. The one failure this app will not commit is marking
// correct Japanese wrong (see the は/が header in grammar/questions.ts):
//
//   MEANING — never a same-cluster sibling as a distractor. A cluster is by
//     definition a family that glosses identically (all seven "must" patterns),
//     so a sibling on the board is a second right answer. Excluded by gloss AND
//     by cluster, belt and braces.
//   PRODUCTION — distractors are OTHER forms of the SAME vehicle verb (行きたい,
//     行った against 行ってから). Real, plausible, and unambiguously wrong for
//     the named target. buildMcOptions drops any that share the answer string,
//     so two patterns that coincide on 行く can never both be on the board.
//
// Only producible recipes carry a production fact, and producibility already
// rejects は/が (no recipe exists), the vacuous rows, the order-free wraps and
// the data-blocked しか〜ない — so the dangerous items never reach here.

/**
 * The VARIED vehicle a production showing runs on, or null to mean "use the
 * fixed one baked in the fact".
 *
 * Returns the ctx vehicle only when it actually builds on this recipe; anything
 * else (no ctx, an illegal pick, a re-cut of the data) collapses to null, and
 * every method below then falls back to the exact pre-variety behaviour —
 * glyph 行く, the fact's baked answers, the same-lemma distractors. So variety
 * is strictly additive: absent a legal vehicle, this file behaves as it did.
 */
function variedVehicle(
  r: import("@/data/grammar/recipes").Recipe,
  ctx?: PromptContext,
  onHost?: Host,
): GrammarVehicle | null {
  const v = ctx?.grammarVehicle;
  if (!v || !apply(r, v.surface, v.cls).ok) return null;
  // A VEHICLE THE RECIPE DOES NOT TAKE IS AN ILLEGAL ONE, even though it builds.
  // apply() is happy to conjugate 行く into 行ってある — the 音便 is right and the
  // sentence is not Japanese — so the recipe's own restriction has to be asked
  // here as well as at the deal. Without it this branch graded the ungrammatical
  // answer CORRECT for any intransitive vehicle a stale runtime carried in.
  if (!transitivityAllows(r, v.surface)) return null;
  // A vehicle of the WRONG HOST is treated exactly like an illegal one: dropped,
  // and the showing falls back to the fact's own baked example. A stale ctx (a
  // remount, a serialized runtime written before the host split) could otherwise
  // put 行く on the adj-i card, which grades and reveals the other fact's answer.
  return onHost === undefined || hostOf(v) === onHost ? v : null;
}

/** The recipe host a vehicle satisfies. A noun has no class and no form, which
 * is exactly what makes it the noun host. */
function hostOf(v: GrammarVehicle): Host {
  return v.cls === null ? "noun" : hostOfClass(v.cls);
}

/** A recipe's production fact for one host, or null if it has none there.
 * Existence is checked against the REGISTRY rather than recomputed, because
 * "which hosts split" is data/grammar/index.ts's decision and a second opinion
 * about it here is a second place for it to be wrong. */
function productionFactOn(recipeId: string, host: Host): FactId | null {
  const id = patternProductionFactId(recipeId, host);
  return factInfo(id) ? id : null;
}

/** The pattern built on a vehicle — surface form and kana form — or null when
 * the recipe will not build on it (a wrap, a defective form). */
function builtOn(
  r: import("@/data/grammar/recipes").Recipe,
  v: GrammarVehicle,
): { form: string; kanaForm: string } | null {
  const surface = apply(r, v.surface, v.cls);
  if (!surface.ok || surface.value === v.surface) return null;
  const kana = apply(r, v.kana, v.cls);
  return { form: surface.value, kanaForm: kana.ok ? kana.value : surface.value };
}

/**
 * Roll a per-showing vehicle for a grammar fact, as plain data — or null.
 *
 * Null for anything that is not a producible grammar production fact, and for a
 * production fact the pool cannot host: the caller then omits `grammarVehicle`
 * and the showing runs on the fixed baked vehicle. `rng` is injectable for
 * tests. This is the one place the drill needs to touch the vehicle pool, so it
 * lives here beside the QuestionType that consumes it.
 *
 * KNOWN VEHICLES ONLY. `history` is REQUIRED and gates the pool to words the
 * learner has met — the same discipline as `grammarSelectionFor`: a production
 * item drilled on a word she has not learned measures vocabulary, not the
 * pattern (see vehicles.ts's header on why a vehicle must be known cold), and
 * an optional gate is one a caller forgets silently. "Known" is the app's one
 * notion of known (`wordKnown`, through `effectiveState`), so a CLAIM makes a
 * word an eligible vehicle exactly as a lesson does. Null is the ORDINARY early
 * answer when she knows none of the pool yet: the showing falls back to the
 * fixed baked vehicle, so a production fact is never unaskable.
 */
export function grammarVehicleFor(
  fact: FactId,
  history: HistoryFile,
  rng: Rng = Math.random,
): GrammarVehicle | null {
  const prod = grammarProduction(fact);
  if (!prod) return null;
  // PINNED TO THE FACT'S HOST. A production fact is a fact about one host now
  // (行きそう and 高そう are separate facts because they are separate rules), so
  // rolling a verb for the adj-i fact would ask the other fact's question and
  // record the answer against this one.
  const picked: Vehicle | null = pickVehicle(prod.recipe, rng, prod.host, (surface) =>
    wordKnown(surface, history),
  );
  return picked
    ? { surface: picked.surface, kana: picked.kana, cls: picked.cls }
    : null;
}

/**
 * Roll a SELECTION showing for a grammar meaning fact, as plain data — or null.
 *
 * Null for anything that is not a meaning fact, and for a pattern the corpus
 * cannot make a safe selection item out of (30 of the 81 recipes, which is the
 * design working — see selectableRecipes). The caller then omits
 * `grammarSelection` and the fact is asked the old way.
 *
 * NULL IS ALSO THE NORMAL ANSWER FOR A BEGINNER, and that is the point of
 * `history`. An item is offered only when every content lemma in its sentence
 * is a word the learner knows (lib/grammar/readable.ts) — "you can't expect me
 * to fill in a blank in a sentence I can't read". With an empty history nothing
 * qualifies and EVERY pattern falls back; at 1,000 words known, 44 of 51
 * patterns have a readable item. The caller must therefore treat null as
 * routine rather than exceptional: the fallback is the fixed meaning card, and
 * grammar meaning is never unaskable.
 *
 * `history` is REQUIRED, not optional-defaulting-to-unfiltered. An optional
 * gate is a gate that gets skipped by the one caller that forgets it, and the
 * failure mode is silent — a beginner served unreadable sentences again, with
 * nothing on screen saying the filter was bypassed.
 *
 * Everything hard already happened upstream: `selectionMcsFor` runs the
 * distractor safety argument (gloss test, cluster test, prefix test, particle
 * allowlist) per SENTENCE and ships only the items where the answer is uniquely
 * determined. This function does the one thing that layer deliberately does not
 * do — name the fact — by mapping each choice's recipe id to its MEANING fact.
 *
 * NOT the production fact, and the distinction is the whole point. "Which
 * pattern fills this blank?" is a question about what 〜てから MEANS and where it
 * goes; "build 〜てから on 食べる" is a question about the FORM. They are two
 * facts, they move independently on the entry page, and a selection answer must
 * only ever move the first.
 *
 * `rng` is injectable so a test can pin the sentence and the board order.
 */
export function grammarSelectionFor(
  fact: FactId,
  history: HistoryFile,
  rng: Rng = Math.random,
): GrammarSelection | null {
  const mean = grammarMeaning(fact);
  if (!mean) return null;
  const cards = selectionMcsFor(
    mean.recipe.id,
    rng,
    BEHAVIOR.mcOptions,
    readerFor(history),
  );
  if (cards.length === 0) return null;
  const card = cards[Math.floor(rng() * cards.length)] ?? cards[0];
  const choices: FactId[] = [];
  for (const c of card.choices) {
    // A choice with no recipe id cannot be scored, so the whole board is
    // refused rather than shown with a hole in it. Unreachable for a selection
    // card (fromSelection sets every id); the guard is here because a silent
    // partial board would grade a click against the wrong fact.
    if (!c.id) return null;
    choices.push(patternMeaningFactId(c.id));
  }
  // The asked fact must BE on the board it is asked with. Belt and braces: if
  // the ids ever drifted from the fact registry this would put six wrong
  // options up and mark every answer wrong, which is the failure this app cares
  // about most.
  if (!choices.includes(fact)) return null;
  return {
    frame: card.prompt,
    host: card.host,
    en: card.en ?? "",
    sourceId: card.sourceId ?? 0,
    choices,
  };
}

/** The selection showing for THIS fact, or null. Mirrors `variedVehicle`: a ctx
 * carrying someone else's board (a stale serialized runtime, a re-cut of the
 * data) is dropped rather than rendered, and the showing falls back to the
 * pattern-and-glosses card. */
function selectionShowing(
  fact: FactId,
  ctx?: PromptContext,
): GrammarSelection | null {
  const s = ctx?.grammarSelection;
  return s && s.choices.includes(fact) ? s : null;
}

const grammarQuestions: QuestionType = {
  id: "grammar",
  prompt(fact, dir, ctx) {
    const prod = grammarProduction(fact);
    if (prod) {
      // The vehicle verb is the big glyph; the pattern names the target, which
      // is what makes production a question with ONE answer. The vehicle is the
      // showing's (varied) one when present and legal, else the baked 行く.
      const v = variedVehicle(prod.recipe, ctx, prod.host);
      return {
        glyph: v ? v.surface : prod.lemma,
        jp: true,
        context: `${patternLabel(prod.recipe)} form`,
        hint: null,
      };
    }
    // A meaning fact asked as a SELECTION item: the question is a real sentence
    // with the pattern (and its host verb) cut out of it.
    //
    // The HOST goes in the halo, because the blank swallowed the conjugated verb
    // and without its dictionary form the item is unanswerable rather than hard
    // — and because a whole sentence in the halo would shrink to the 15px floor
    // and overflow the ring (see glyph-fit.ts). The frame is one short centred
    // line, which is exactly what `context` already is; the English is the
    // second one. Nothing new gets invented: same halo, same option buttons.
    const sel = selectionShowing(fact, ctx);
    if (sel) {
      return {
        // No host for the handful of signatures with no host anchor (そう, たら);
        // the blank itself stands in, so the halo is never empty.
        glyph: sel.host ?? SELECTION_BLANK,
        jp: true,
        context: sel.frame,
        hint: null,
        note: sel.en,
      };
    }
    // A meaning fact (or an unrecognised grammar fact) asked the FIXED way, and
    // the direction is not decoration here — it decides which half of the pair
    // is the question.
    //
    // THE BUG THIS SHAPE FIXES. This branch used to ignore `dir` and always show
    // the PATTERN. In en2jp the options are glyphs, and a meaning fact's glyph
    // IS its pattern, so the board rendered 〜てから under a prompt reading
    // 〜てから: the answer was printed in the question. A free point, shipped, on
    // the fallback card every unselectable pattern lands on.
    //
    //   jp2en  〜てから  → pick the English gloss   (options are answers)
    //   en2jp  "after doing X" → pick the pattern   (options are glyphs)
    //
    // Each direction shows exactly what the other one asks for, which is the
    // asymmetry every other subject already has and this one had lost.
    const mean = grammarMeaning(fact);
    if (dir === "en2jp") {
      const gloss = mean?.recipe.gloss ?? factInfo(fact)?.answers[0] ?? "";
      return {
        glyph: gloss,
        // English, so no JP font — the same call the word subject makes when it
        // prompts with a meaning.
        jp: false,
        context: "pattern",
        hint: null,
      };
    }
    return {
      glyph: mean ? patternLabel(mean.recipe) : glyphOfFact(fact),
      jp: true,
      context: "meaning",
      hint: null,
    };
  },
  check(fact, dir, given, ctx) {
    const prod = grammarProduction(fact);
    if (prod) {
      // Grade against the pattern built on THIS showing's vehicle, not the
      // fixed answer baked in the fact — otherwise a 食べる showing would only
      // accept 行ってから. Both scripts count, as the baked path does. No legal
      // vehicle → the baked answers, unchanged.
      const v = variedVehicle(prod.recipe, ctx, prod.host);
      if (v) {
        const built = builtOn(prod.recipe, v);
        if (built) {
          // Through checkProduces, exactly as the baked path below does, and NOT
          // raw string equality. Equality here meant the one branch the drill
          // actually takes was the one branch with no romaji forgiveness: a
          // learner with no IME typed `tabetekudasai` for 食べてください and was
          // told she was wrong. checkProduces is unchanged and still refuses to
          // let romaji reach a kanji-bearing target, so `form` (食べてください)
          // stays exact-match and only `kanaForm` (たべてください) forgives a
          // spelling — the same asymmetry every other subject already has.
          return (
            checkProduces(built.form, given) || checkProduces(built.kanaForm, given)
          );
        }
      }
    }
    // A MEANING fact asked en2jp asks for the PATTERN, so the pattern is what it
    // has to accept. Five patterns (を, へ, まで, までに, だけ) are pure kana and
    // so reach the drill as a TYPED en2jp card, where the only thing the romaji
    // input can produce is kana — the gloss was never typeable there, and the
    // card graded every answer wrong. The 〜 is a citation mark, not something
    // anybody types, so it is optional. jp2en still wants the gloss, unchanged.
    if (dir === "en2jp") {
      const mean = grammarMeaning(fact);
      if (mean) {
        const g = given.trim();
        const pattern = mean.recipe.pattern;
        if (g === pattern || g === pattern.replace(/^〜/, "")) return true;
      }
    }
    // jp2en reaches here for a meaning fact (an English gloss, which isKanaOnly
    // refuses, so nothing changes) and for a production fact with no varied
    // vehicle, whose baked answer may be all kana. Same rule as everyone else.
    return dir === "jp2en" ? checkJp2en(fact, given) : accepts(fact, given);
  },
  distractors(fact, n, ctx) {
    const prod = grammarProduction(fact);
    if (prod) {
      const v = variedVehicle(prod.recipe, ctx, prod.host);
      const out: FactId[] = [];
      if (v) {
        const answer = builtOn(prod.recipe, v);
        for (const r of RECIPES) {
          if (r.id === prod.recipe.id || !isProducible(r)) continue;
          // A plausible wrong answer is ANOTHER pattern built on the SAME
          // vehicle (行った, 行きたい against 行ってから). It must build on this
          // vehicle and land on a different string — a distractor that coincides
          // with the answer would be a second right option.
          const d = builtOn(r, v);
          if (!d || (answer && d.form === answer.form)) continue;
          // The distractor's fact is the one for THIS vehicle's host, and it has
          // to be a fact that exists: 〜ても builds fine on 高い but has no adj-i
          // production fact (it defers to te-cause — see sharedProductionWith),
          // so offering `production@adj-i` for it would put an id on the board
          // that resolves to nothing. Its verb fact is not a substitute; that is
          // a different question with a different answer.
          const dFact = productionFactOn(r.id, hostOf(v));
          if (!dFact) continue;
          out.push(dFact);
          if (out.length >= n) break;
        }
        return out;
      }
      // No varied vehicle: the pre-variety same-fixed-lemma filter, verbatim,
      // now per host — a fact's baked lemma is its own host's example word.
      for (const r of RECIPES) {
        if (r.id === prod.recipe.id || !isProducible(r)) continue;
        const ex = buildExample(r, prod.host);
        if (!ex || ex.lemma !== prod.lemma) continue;
        const dFact = productionFactOn(r.id, prod.host);
        if (!dFact) continue;
        out.push(dFact);
        if (out.length >= n) break;
      }
      return out;
    }
    const mean = grammarMeaning(fact);
    if (!mean) return [];
    const out: FactId[] = [];
    for (const r of RECIPES) {
      if (r.id === mean.recipe.id) continue;
      // Same gloss = a second right answer; same cluster = same gloss by
      // construction. Refuse both.
      if (r.gloss === mean.recipe.gloss) continue;
      if (mean.recipe.cluster && r.cluster === mean.recipe.cluster) continue;
      out.push(patternMeaningFactId(r.id));
      if (out.length >= n) break;
    }
    return out;
  },
  optionLabel(fact, dir, ctx) {
    // A SELECTION board offers PATTERNS to choose between, in both directions.
    // Left to the drill's default a jp2en board would label each option with its
    // English gloss, which asks a different (and much easier) question than the
    // one the blank asks — and the glosses are exactly what the distractor rules
    // proved distinct, not what goes in the sentence. The sense rides along so a
    // board holding two members of a shared bare pattern is not two identical
    // buttons.
    const sel = selectionShowing(fact, ctx);
    if (sel) {
      const r = grammarMeaning(fact)?.recipe;
      return r ? patternLabel(r) : null;
    }
    // Only a VARIED production option needs a per-vehicle label. Without a legal
    // vehicle, or for a meaning option, the fact's own glyph/answer is already
    // right, so return null and let the drill use it.
    const prod = grammarProduction(fact);
    if (prod) {
      const v = variedVehicle(prod.recipe, ctx, prod.host);
      return v ? (builtOn(prod.recipe, v)?.form ?? null) : null;
    }
    // A fixed MEANING card asked en2jp offers PATTERN glyphs. Its distractors are
    // other recipes and two of them can share a bare pattern with the answer
    // (〜られる 可能 vs 受身, 〜から 理由 vs 起点), which would put two identical
    // buttons up and grade the right one wrong. The sense makes them distinct;
    // jp2en offers glosses, so the fact's own answer is left alone there.
    if (dir === "en2jp") {
      const r = grammarMeaning(fact)?.recipe;
      if (r) return patternLabel(r);
    }
    return null;
  },
  answerReveal(fact, dir, ctx) {
    // A missed selection item reveals the PATTERN that fits the blank, not the
    // fact's baked gloss: the gloss is the answer to "what does 〜てから mean",
    // and this card asked something else. The sense rides along so the reveal
    // matches the option it lights up.
    const sel = selectionShowing(fact, ctx);
    if (sel) {
      const r = grammarMeaning(fact)?.recipe;
      return r ? patternLabel(r) : null;
    }
    // Same argument for the fixed meaning card asked en2jp — it asked for the
    // pattern, so the pattern is what a miss has to show. Falling through to the
    // baked answer printed "decide to X pattern = decide to X".
    const mean = grammarMeaning(fact);
    if (mean && dir === "en2jp") return patternLabel(mean.recipe);
    const prod = grammarProduction(fact);
    if (!prod) return null;
    const v = variedVehicle(prod.recipe, ctx, prod.host);
    return v ? (builtOn(prod.recipe, v)?.form ?? null) : null;
  },
};

// ---------- the registry ----------

/**
 * Transitivity: pick the verb for an English cue.
 *
 * The one-way, MC-only shape is not a limitation to route around, it is the
 * whole question. See the header of lib/transitivity.ts: the only gradable
 * thing here is "given this English meaning, is it the happens-verb or the
 * doIt-verb", so the direction is fixed to en2jp and the two sides of the pair
 * ARE the two options. There is never a third option and never a typed answer.
 */
const transitivityQuestions: QuestionType = {
  id: TRANSITIVITY_SUBJECT,
  mcOnly: true,
  fixedDir: "en2jp",
  prompt(fact) {
    const side = transitivitySide(fact);
    // The English cue is the glyph — the big line the drill halo shows — and it
    // is English, so `jp` is false and it gets no JP font. `context` is the
    // fixed instruction that turns a bare sentence into a question.
    return {
      glyph: side?.en ?? factInfo(fact)?.meaning ?? "",
      jp: false,
      context: TRANSITIVITY_PROMPT,
      hint: null,
    };
  },
  check(fact, _dir, given) {
    const side = transitivitySide(fact);
    if (!side) return false;
    const g = given.trim();
    return g === side.word || g === side.reading;
  },
  distractors(fact, n) {
    const side = transitivitySide(fact);
    if (!side || n <= 0) return [];
    // The one distractor is the partner side — the other verb of the pair. It
    // always exists (both sides are minted) and is always the single plausible
    // wrong answer, so the board is exactly two choices.
    return factInfo(side.partner) ? [side.partner] : [];
  },
};

const BY_SUBJECT: Record<string, QuestionType> = {
  [KANA_SUBJECT]: kanaQuestions,
  [KANJI_SUBJECT]: kanjiQuestions,
  [VOCAB_SUBJECT]: wordQuestions,
  [GRAMMAR_SUBJECT]: grammarQuestions,
  [TRANSITIVITY_SUBJECT]: transitivityQuestions,
};

/**
 * How to ask this fact. Falls back to kana's rules for a subject nobody
 * registered — a new subject renders mechanically rather than crashing the
 * drill, which is the right failure: you see a slightly dumb question instead
 * of a blank screen, and the missing registration is obvious.
 */
export function questionsFor(fact: FactId): QuestionType {
  const subject = factInfo(fact)?.subject ?? "";
  return BY_SUBJECT[subject] ?? kanaQuestions;
}

function shuffled<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
