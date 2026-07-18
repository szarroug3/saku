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
import { RECIPES, isProducible } from "@/data/grammar/recipes";
import { buildExample } from "@/lib/grammar/example";
import { apply } from "@/lib/grammar/apply";
import { pickVehicle, type Rng, type Vehicle } from "@/lib/grammar/vehicles";
import type { WordClass } from "@/lib/conjugate";
import {
  KANJI_SUBJECT,
  READING_INDEX,
  meaningFactId,
  readingFactId,
} from "@/data/kanji";
import { VOCAB_SUBJECT, wordReadingFactId } from "@/data/vocab";
import { factInfo } from "@/lib/facts";
import { isKanaOnly, romajiMatches } from "@/lib/romaji";
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
}

/** A verb picked to carry a grammar production question this showing. Plain
 * data (no functions) so it can ride in the drill's serialized runtime. */
export interface GrammarVehicle {
  readonly surface: string;
  readonly kana: string;
  readonly cls: WordClass | null;
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
   */
  answerReveal?(fact: FactId, ctx?: PromptContext): string | null;
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
  const glyph = glyphOfFact(fact);
  if (given.trim() === glyph) return true;
  return isKanaOnly(glyph) && romajiMatches(given, glyph);
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
      : checkEn2jp(fact, given);
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
      ? accepts(fact, given)
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
    return { glyph: answerOf(fact), jp: reading, context: null, hint: null };
  },
  check(fact, dir, given) {
    return dir === "jp2en"
      ? accepts(fact, given)
      : checkEn2jp(fact, given);
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

// ---------- grammar ----------
//
// Two aspects, ONE direction-insensitive question each — grammar does not flip
// jp2en/en2jp the way a character does. "What does 〜てから mean" and "build
// 〜てから on 行く" have one answer whichever way the drill turns the card, so
// prompt and check ignore `dir` and grade against the fact's own answer strings
// (the gloss for a meaning; the built form, in kanji and in kana, for a
// production — baked into the fact in data/grammar/index.ts).
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
): GrammarVehicle | null {
  const v = ctx?.grammarVehicle;
  return v && apply(r, v.surface, v.cls).ok ? v : null;
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
 */
export function grammarVehicleFor(
  fact: FactId,
  rng: Rng = Math.random,
): GrammarVehicle | null {
  const prod = grammarProduction(fact);
  if (!prod) return null;
  const picked: Vehicle | null = pickVehicle(prod.recipe, rng);
  return picked
    ? { surface: picked.surface, kana: picked.kana, cls: picked.cls }
    : null;
}

const grammarQuestions: QuestionType = {
  id: "grammar",
  prompt(fact, _dir, ctx) {
    const prod = grammarProduction(fact);
    if (prod) {
      // The vehicle verb is the big glyph; the pattern names the target, which
      // is what makes production a question with ONE answer. The vehicle is the
      // showing's (varied) one when present and legal, else the baked 行く.
      const v = variedVehicle(prod.recipe, ctx);
      return {
        glyph: v ? v.surface : prod.lemma,
        jp: true,
        context: `${prod.recipe.pattern} form`,
        hint: null,
      };
    }
    // A meaning fact (or an unrecognised grammar fact): show the pattern, ask
    // what it means.
    const mean = grammarMeaning(fact);
    return {
      glyph: mean?.recipe.pattern ?? glyphOfFact(fact),
      jp: true,
      context: "meaning",
      hint: null,
    };
  },
  check(fact, _dir, given, ctx) {
    const prod = grammarProduction(fact);
    if (prod) {
      // Grade against the pattern built on THIS showing's vehicle, not the
      // fixed answer baked in the fact — otherwise a 食べる showing would only
      // accept 行ってから. Both scripts count, as the baked path does. No legal
      // vehicle → the baked answers, unchanged.
      const v = variedVehicle(prod.recipe, ctx);
      if (v) {
        const built = builtOn(prod.recipe, v);
        if (built) {
          const g = given.trim();
          return g === built.form || g === built.kanaForm;
        }
      }
    }
    return accepts(fact, given);
  },
  distractors(fact, n, ctx) {
    const prod = grammarProduction(fact);
    if (prod) {
      const v = variedVehicle(prod.recipe, ctx);
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
          out.push(patternProductionFactId(r.id));
          if (out.length >= n) break;
        }
        return out;
      }
      // No varied vehicle: the pre-variety same-fixed-lemma filter, verbatim.
      for (const r of RECIPES) {
        if (r.id === prod.recipe.id || !isProducible(r)) continue;
        const ex = buildExample(r);
        if (!ex || ex.lemma !== prod.lemma) continue;
        out.push(patternProductionFactId(r.id));
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
  optionLabel(fact, _dir, ctx) {
    // Only a VARIED production option needs a per-vehicle label. Without a legal
    // vehicle, or for a meaning option, the fact's own glyph/answer is already
    // right, so return null and let the drill use it.
    const prod = grammarProduction(fact);
    if (!prod) return null;
    const v = variedVehicle(prod.recipe, ctx);
    return v ? (builtOn(prod.recipe, v)?.form ?? null) : null;
  },
  answerReveal(fact, ctx) {
    const prod = grammarProduction(fact);
    if (!prod) return null;
    const v = variedVehicle(prod.recipe, ctx);
    return v ? (builtOn(prod.recipe, v)?.form ?? null) : null;
  },
};

// ---------- the registry ----------

const BY_SUBJECT: Record<string, QuestionType> = {
  [KANA_SUBJECT]: kanaQuestions,
  [KANJI_SUBJECT]: kanjiQuestions,
  [VOCAB_SUBJECT]: wordQuestions,
  [GRAMMAR_SUBJECT]: grammarQuestions,
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
