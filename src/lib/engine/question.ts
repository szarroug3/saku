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
  KANJI_SUBJECT,
  READING_INDEX,
  meaningFactId,
  readingFactId,
} from "@/data/kanji";
import { VOCAB_SUBJECT, wordReadingFactId } from "@/data/vocab";
import { factInfo } from "@/lib/facts";
import type { Direction, FactId } from "@/types";

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
  /** What to show, asking `fact` in `dir`. */
  prompt(fact: FactId, dir: Direction): Prompt;
  /** Whether `given` answers `fact` in `dir`. */
  check(fact: FactId, dir: Direction, given: string): boolean;
  /**
   * Plausible WRONG answers for a multiple-choice `fact`, as facts.
   *
   * Returns fewer than `n` — or none — rather than padding with randoms. An
   * option nobody would ever pick is not a distractor, it is a free point, and
   * four options where three are absurd is a one-option question wearing a
   * costume.
   */
  distractors(fact: FactId, n: number): FactId[];
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
  check(fact, dir, given) {
    return dir === "jp2en"
      ? accepts(fact, given)
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
  prompt(fact, dir) {
    const glyph = glyphOfFact(fact);
    const anchor = anchorOf(fact);
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
      ? accepts(fact, given)
      : given.trim() === glyphOfFact(fact);
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
    return { glyph: answerOf(fact), jp: reading, context: null, hint: null };
  },
  check(fact, dir, given) {
    return dir === "jp2en"
      ? accepts(fact, given)
      : given.trim() === glyphOfFact(fact);
  },
  distractors(fact, n) {
    // No word-level confusable data exists, and inventing "random other words"
    // would be padding — see the doc on `distractors`. Typed answering is
    // unaffected; MC on a word simply has nothing plausible to offer yet.
    void fact;
    void n;
    return [];
  },
};

function isWordReading(fact: FactId): boolean {
  const info = factInfo(fact);
  return !!info && wordReadingFactId(info.glyph) === fact;
}

// ---------- the registry ----------

const BY_SUBJECT: Record<string, QuestionType> = {
  [KANA_SUBJECT]: kanaQuestions,
  [KANJI_SUBJECT]: kanjiQuestions,
  [VOCAB_SUBJECT]: wordQuestions,
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
