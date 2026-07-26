// The heart of task 30: turning "How to ask" (AskConfig) + a fact into the
// concrete CARD FORMS it should be asked as.
//
// A FORM is the trio the drill screen freezes onto a showing — is the prompt
// audio, which direction, typed or picked. Everything else (which glyph, the
// instruction, the reveal) already derives from those in engine/question.ts, so
// naming the form is the whole of what a card needs.
//
// TWO CALLERS, ONE ENUMERATOR:
//   Full coverage  — takes ALL of a fact's enabled forms, so no enabled variety
//                    (audio, above all) is ever left to a coin. This is the
//                    task's headline: turning on Audio guarantees audio cards.
//   Endless/Count  — rolls ONE of them per showing, uniformly, which reproduces
//                    the old random direction/listen behaviour without a
//                    separate code path.
//
// SUPPORTED, not merely enabled. A config may ask for Audio, but a kana has no
// audio form and a meaning fact has no romaji response; a config may ask for
// typed, but kana en→jp is multiple-choice only. Each candidate form is checked
// against what the FACT can actually be asked (fixedDirOf / listenKind /
// en2jpTypeable / mcOnlyIn — the same predicates the drill already trusts) and
// dropped if the fact can't carry it. The result is deduped on the RESOLVED
// shape, so two intents that collapse to the same card (kana en→jp typed and mc
// both become mc) yield one card, not two.
//
// Pure: no React, no clock, no storage. A function of (ask, fact) and nothing
// else, so it is unit-tested directly.

import { VOCAB_SUBJECT, wordReadingFactId } from "@/data/vocab";
import { grammarMeaning } from "@/data/grammar";
import { READING_INDEX } from "@/data/kanji";
import {
  answerIsJapanese,
  en2jpTypeable,
  fixedDirOf,
  mcOnlyIn,
} from "@/lib/engine/question";
import { factInfo } from "@/lib/facts";
import { listenKind } from "@/lib/listen";
import type {
  AnswerStyle,
  AskConfig,
  Direction,
  FactId,
  ResponseKind,
} from "@/types";

/**
 * One way to ask a card, frozen onto the showing.
 *
 * `answer` is the learner's chosen format and an INTENT — a subject constraint
 * can still force multiple choice (kana en→jp, an un-typeable en→jp answer). Use
 * `formIsMc` for the resolved truth; the drill does.
 */
export interface CardForm {
  /** Which settings card produced this form. Sentence forms use a corpus
   * vehicle; Japanese forms show/play the fact itself; English forms show its
   * definition and ask for Japanese. */
  source: "japanese" | "sentence" | "english";
  response: ResponseKind | "japanese";
  /** Audio prompt (listening): the glyph is hidden and the word is played.
   * Only ever true on a jp→en form of a listenable word. */
  listen: boolean;
  dir: Direction;
  answer: AnswerStyle;
}

/** Whether a word READING fact — its jp→en answer is a kana reading, and its
 * en→jp shows the meaning and produces that reading (a real, distinct card). */
function isWordReadingFact(fact: FactId): boolean {
  const info = factInfo(fact);
  return (
    !!info && info.subject === VOCAB_SUBJECT && wordReadingFactId(info.glyph) === fact
  );
}

/** Whether this fact is a kanji reading fact (keyed on kanji+anchor word). */
function isKanjiReadingFact(fact: FactId): boolean {
  return READING_INDEX.has(fact);
}

/**
 * Which jp→en response a fact carries — Definition (an English gloss) or Romaji
 * (a reading / pronunciation).
 *
 * Definition only when the fact HAS a meaning and its jp→en answer is that
 * English gloss; everything else — a kana (romaji answer, no meaning), a
 * reading, a produced Japanese form — is a Romaji response. This is exactly the
 * split the Japanese source's Response row offers.
 */
export function jp2enResponse(fact: FactId): "definition" | "romaji" {
  const info = factInfo(fact);
  if (info?.meaning != null && !answerIsJapanese(fact, "jp2en")) return "definition";
  return "romaji";
}

/** The resolved answer control for a form on this fact — the drill's own rule,
 * lifted so coverage can dedup on it. Typed unless a romaji box can't spell the
 * en→jp answer, or the subject is multiple-choice-only in this direction. */
export function formIsMc(fact: FactId, form: CardForm): boolean {
  const styleTyped = form.answer === "typed";
  const romajiUnanswerable =
    styleTyped && form.dir === "en2jp" && !en2jpTypeable(fact);
  return !(styleTyped && !romajiUnanswerable && !mcOnlyIn(fact, form.dir));
}

/** The directions a fact can be asked in, before the config narrows them. A
 * subject may pin one (a kanji reading is jp→en only, transitivity en→jp only);
 * otherwise both, EXCEPT a fact whose jp→en answer is already Japanese and is
 * not a word reading (a grammar production) has no distinct English-prompt
 * card, so it stays jp→en only rather than being asked twice identically. */
function candidateDirs(fact: FactId): Direction[] {
  const fixed = fixedDirOf(fact);
  if (fixed) return [fixed];
  if (answerIsJapanese(fact, "jp2en") && !isWordReadingFact(fact)) return ["jp2en"];
  return ["jp2en", "en2jp"];
}

/** Dedup forms on their RESOLVED shape (listen · dir · mc) so intents that
 * collapse to the same card don't produce two. */
function dedup(fact: FactId, forms: CardForm[]): CardForm[] {
  const seen = new Set<string>();
  const out: CardForm[] = [];
  for (const f of forms) {
    // A typed answer the fact can ONLY take as multiple choice (kana en→jp, an
    // un-typeable en→jp target) is NOT dropped — it renders as the MC card. MC
    // is the only way that fact can be asked in that direction, and a learner
    // who chose the direction still wants it; dropping it drew an EMPTY board
    // for a kana en→jp typed selection. The resolved-shape key below carries
    // the MC resolution, so a typed-becomes-MC form and an explicit MC form
    // collapse to one card — choosing both still yields one MC.
    const key = `${f.source}|${f.response}|${f.listen ? 1 : 0}|${f.dir}|${formIsMc(fact, f) ? 1 : 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/**
 * Every card form the config enables AND the fact supports — deduped. The full
 * product of (Prompt Format × Response × Answer Format) for each source the fact
 * belongs to, minus the combinations the fact can't carry:
 *
 *   - audio only for a listenable word (kana / sentence / kanji have none),
 *   - a jp→en response the fact doesn't have (no definition on a reading, no
 *     romaji on a meaning),
 *   - a direction the subject pins away.
 *
 * Empty is a real answer: a fact none of whose forms are enabled yields no card,
 * which is how a source turned off removes its cards from the deck.
 */
export function enabledFormsFor(fact: FactId, ask: AskConfig): CardForm[] {
  if (!factInfo(fact)) return [];
  const out: CardForm[] = [];
  for (const dir of candidateDirs(fact)) {
    if (dir === "jp2en") {
      const src = ask.japanese;
      if (!src.responses.includes(jp2enResponse(fact))) continue;
      for (const prompt of src.prompts) {
        const listen = prompt === "audio";
        // Audio is word-only: a kana, a kanji, a sentence has no listenable
        // form, so an audio prompt is silently dropped for them.
        if (listen && (listenKind(fact) === null || isKanjiReadingFact(fact))) continue;
        for (const answer of src.answers) {
          out.push({
            source: "japanese",
            response: jp2enResponse(fact),
            listen,
            dir,
            answer,
          });
        }
      }
    } else {
      // en→jp is the English source: prompt is English text, response is
      // Japanese — the only choice is the answer format.
      for (const answer of ask.english.answers) {
        out.push({
          source: "english",
          response: "japanese",
          listen: false,
          dir,
          answer,
        });
      }
    }
  }

  // A corpus sentence is a second, distinct source for a grammar-meaning fact.
  // The app currently supports sentence → definition as a selection board.
  // Definition is inherently multiple-choice, as the approved panel says;
  // Type it therefore does not manufacture a form. Text and Audio are both
  // presentations of the same safe, readable sentence board.
  if (
    grammarMeaning(fact) &&
    ask.sentence.responses.includes("definition")
  ) {
    for (const prompt of ask.sentence.prompts) {
      out.push({
        source: "sentence",
        response: "definition",
        listen: prompt === "audio",
        dir: "jp2en",
        answer: "mc",
      });
    }
  }

  // Sentence+romaji is intentionally not emitted yet. It currently grades
  // against the same answer axis as Japanese+romaji and produces near-duplicate
  // cards in full-coverage runs; keep sentence forms to definition-selection
  // until sentence-specific romaji grading/prompting is distinct.
  return dedup(fact, out);
}

/** A coverage deck: cards and their pinned forms, index-aligned. The drill
 * screen carries these two arrays side by side (a card is a fact + a form). */
export interface CoverageDeck {
  deck: FactId[];
  forms: CardForm[];
}

/**
 * FULL COVERAGE: expand each fact into one card per enabled form — the whole
 * product, deduped per fact to what the fact supports. This is what guarantees
 * every enabled variety is asked rather than sampled; the deck can get large,
 * and that is the intended cost of "full coverage".
 *
 * INTERLEAVED, not clumped. Building fact-by-fact would put every audio card of
 * a run at the same offset, so the pairs are shuffled together (fact and form
 * move as one) — the audio, typed and multiple-choice cards land mixed through
 * the deck, not all the audio at the end. `shuffle` is injectable so a test can
 * pin the order and assert the product.
 */
export function buildCoverageDeck(
  facts: readonly FactId[],
  ask: AskConfig,
  shuffle: <T>(a: T[]) => T[] = fisherYates,
): CoverageDeck {
  const pairs: Array<{ f: FactId; form: CardForm }> = [];
  for (const f of facts) {
    for (const form of enabledFormsFor(f, ask)) pairs.push({ f, form });
  }
  shuffle(pairs);
  return { deck: pairs.map((p) => p.f), forms: pairs.map((p) => p.form) };
}

function fisherYates<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Diagnostic: which settings are "reachable" (will produce at least one form for
 * some fact)? and which are "unreachable" (selected but will never produce forms)?
 *
 * A setting combination is UNREACHABLE when:
 * - Japanese source selects only audio, but the fact(s) are not listenable
 *   (audio is word-only; kana, kanji, grammar, keigo, transitivity have no audio)
 * - English source is off (empty answers) when all facts are en→jp only
 * - A response kind is selected but no fact supports it
 *   (e.g., selecting "romaji" when all facts are meaning facts with no reading)
 * - Typed is selected only, but all facts are MC-forced
 *   (e.g., kana en→jp, kanji meaning en→jp, grammar en→jp)
 *
 * This is purely a diagnostic tool; enabledFormsFor already silently drops
 * unreachable combinations. Use this to document what users are selecting.
 */
export interface SettingsReachability {
  /** True if this configuration will produce at least one form for the given facts. */
  isReachable: boolean;
  /** Human-readable explanation of why unreachable (if isReachable is false). */
  reason?: string;
}

/**
 * Check whether a given AskConfig will produce any forms for the given fact set.
 *
 * @param facts The fact(s) being asked
 * @param ask The configuration (source settings, response kinds, answer styles)
 * @returns whether the config is reachable and why (if not)
 */
export function configIsReachable(
  facts: readonly FactId[],
  ask: AskConfig,
): SettingsReachability {
  if (facts.length === 0) {
    return { isReachable: false, reason: "No facts provided" };
  }

  // Check if any form is enabled for any fact
  for (const fact of facts) {
    const forms = enabledFormsFor(fact, ask);
    if (forms.length > 0) {
      return { isReachable: true };
    }
  }

  // All facts produced no forms. Diagnose why.
  const hasJapaneseSetting =
    ask.japanese.prompts.length > 0 || ask.japanese.responses.length > 0;
  const hasEnglishSetting = ask.english.answers.length > 0;
  const hasSentenceSetting =
    ask.sentence.prompts.length > 0 || ask.sentence.responses.length > 0;

  if (!hasJapaneseSetting && !hasEnglishSetting && !hasSentenceSetting) {
    return { isReachable: false, reason: "All sources disabled" };
  }

  // Check if audio-only was selected and no facts are listenable
  const audioOnly =
    ask.japanese.prompts.length === 1 &&
    ask.japanese.prompts[0] === "audio" &&
    hasJapaneseSetting;
  if (audioOnly) {
    const anyListenable = facts.some((f) => listenKind(f) !== null);
    if (!anyListenable) {
      return {
        isReachable: false,
        reason:
          "Audio selected but no facts are listenable (word-only; kana, kanji, grammar are not)",
      };
    }
  }

  // If we get here, the combination is theoretically reachable but produces no forms
  // for these specific facts (e.g., all facts are meaning-only but only romaji selected)
  return {
    isReachable: false,
    reason:
      "Settings don't match the facts (e.g., romaji selected but no reading facts, or typed-only selected but all MC-forced facts)",
  };
}
