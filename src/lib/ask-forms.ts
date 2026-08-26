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
// SUPPORTED, not merely enabled. A config may ask for Audio, but most non-word
// facts have no audio form and a meaning fact has no romaji response. Each
// candidate form is checked
// against what the FACT can actually be asked (fixedDirOf / listenKind /
// en2jpTypeable / mcOnlyIn — the same predicates the drill already trusts) and
// dropped if the fact can't carry it. The result is deduped on the RESOLVED
// shape, so two intents that collapse to the same card (kana en→jp typed and mc
// both become mc) yield one card, not two.
//
// Pure: no React, no clock, no storage. A function of (ask, fact) and nothing
// else, so it is unit-tested directly.

import {
  VOCAB_SUBJECT,
  isKanaWord,
  isWordReadingFact,
  vocabRow,
  wordMeaningFactId,
} from "@/data/vocab";
import { KANA_SUBJECT } from "@/data/characters";
import { constructionConfigForFact } from "@/data/counter-categories";
import { grammarMeaning } from "@/data/grammar";
import { READING_INDEX } from "@/data/kanji";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import {
  answerIsJapanese,
  en2jpTypeable,
  fixedDirOf,
  mcOnlyIn,
} from "@/lib/engine/question";
import { entryOf, factInfo } from "@/lib/facts";
import { spread } from "@/lib/engine/spread";
import { listenKind } from "@/lib/listen";
import { meaningMustShowGlyph } from "@/lib/homophone";
import { pickRecognitionForFact } from "@/lib/listen-sentence";
import type {
  AnswerStyle,
  AskConfig,
  Direction,
  FactId,
  HistoryFile,
  QuizConfig,
  ResponseKind,
} from "@/types";

/**
 * One way to ask a card, frozen onto the showing.
 *
 * `answer` is the learner's chosen format and an INTENT — a subject constraint
 * can still force multiple choice (visible kana en→jp, an un-typeable en→jp
 * answer). Use `formIsMc` for the resolved truth; the drill does.
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
  /** SAK-129: set only on a form the drill screen PINS into the deck itself
   * (see drill-screen.tsx's queuePitchCard) to force one specific slot to
   * render as a pitch-accent question — an ADDITIONAL card for an eligible
   * word's fact, never a substitute for its ordinary meaning-card showing.
   * Never set by enabledFormsFor/buildCoverageDeck/buildDeck; those still
   * produce only ordinary forms, exactly as before. */
  pitch?: boolean;
}

/** Whether this fact is a kanji reading fact (keyed on kanji+anchor word). */
function isKanjiReadingFact(fact: FactId): boolean {
  return READING_INDEX.has(fact);
}

function isKanaFact(fact: FactId): boolean {
  return factInfo(fact)?.subject === KANA_SUBJECT;
}

function isKeigoFact(fact: FactId): boolean {
  return factInfo(fact)?.subject === KEIGO_SUBJECT;
}

function isTransitivityFact(fact: FactId): boolean {
  return factInfo(fact)?.subject === TRANSITIVITY_SUBJECT;
}

function isKanaOnlyWordMeaningFact(fact: FactId): boolean {
  const info = factInfo(fact);
  if (!info || info.subject !== VOCAB_SUBJECT) return false;
  const row = vocabRow(info.glyph);
  return (
    !!row &&
    isKanaWord(row) &&
    wordMeaningFactId(info.glyph) === fact
  );
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
  return !(
    styleTyped &&
    !romajiUnanswerable &&
    !mcOnlyIn(fact, form.dir)
  );
}

/** The directions a fact can be asked in, before the config narrows them. A
 * subject may pin one (a kanji reading is jp→en only);
 * otherwise both, EXCEPT a fact whose jp→en answer is already Japanese and is
 * not a word reading (a grammar production) has no distinct English-prompt
 * card, so it stays jp→en only rather than being asked twice identically. */
function candidateDirs(fact: FactId): Direction[] {
  const fixed = fixedDirOf(fact);
  if (fixed) return [fixed];
  if (answerIsJapanese(fact, "jp2en") && !isWordReadingFact(fact)) return ["jp2en"];
  return ["jp2en", "en2jp"];
}

/** Drop the redundant multiple-choice card when a typed one asks the same thing.
 *
 * Within each (source · response · listen · dir) group, a genuinely-TYPED form
 * (formIsMc=false) and its explicit MC sibling (formIsMc=true) used to survive
 * as two cards — a text box AND a separate board for the identical fact. They
 * are the same question. The typed card now carries a "Show choices" button that
 * turns it into that very board in place (see drill-screen), so the standalone
 * MC card is pure redundancy: drop every mc-RESOLVED form whose group also holds
 * a typed-RESOLVED one, and keep the typed.
 *
 * A group that is ALL-mc keeps its card — that is the ONLY way to ask it, not a
 * duplicate of anything: kana en→jp (mcOnly), a kanji/word meaning en→jp whose
 * written target can't be typed, a grammar-meaning selection. There is no typed
 * sibling to defer to, so nothing is dropped; the existing `dedup` still
 * collapses such a group to one card.
 *
 * Pure, like everything else here — a filter on (fact, forms). */
function dropRedundantMc(fact: FactId, forms: CardForm[]): CardForm[] {
  const groupKey = (f: CardForm) =>
    `${f.source}|${f.response}|${f.listen ? 1 : 0}|${f.dir}`;
  const typedGroups = new Set<string>();
  for (const f of forms) {
    if (!formIsMc(fact, f)) typedGroups.add(groupKey(f));
  }
  return forms.filter(
    (f) => !(formIsMc(fact, f) && typedGroups.has(groupKey(f))),
  );
}

/** Dedup forms on their RESOLVED shape (listen · dir · mc) so intents that
 * collapse to the same card don't produce two. */
function dedup(fact: FactId, forms: CardForm[]): CardForm[] {
  const seen = new Set<string>();
  const out: CardForm[] = [];
  for (const f of forms) {
    // A typed answer the fact can ONLY take as multiple choice (visible
    // Romaji→kana, an un-typeable en→jp target) is NOT dropped — it renders as
    // the MC card. Audio→kana is separately recognized as typeable. MC
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
 *   - audio only for a listenable word or a kana glyph,
 *   - a jp→en response the fact doesn't have (no definition on a reading, no
 *     romaji on a meaning),
 *   - a direction the subject pins away.
 *
 * Empty is a real answer: a fact none of whose forms are enabled yields no card,
 * which is how a source turned off removes its cards from the deck.
 */
export function enabledFormsFor(fact: FactId, ask: AskConfig): CardForm[] {
  if (!factInfo(fact)) return [];

  // Kana deliberately has exactly three question shapes:
  //   1. see kana    → type or pick Romaji
  //   2. hear kana   → type or pick Romaji (dictation; SAK-16)
  //   3. see Romaji  → pick kana
  //
  // Audio is wired through the SAME "japanese" jp2en/romaji shape text uses
  // (see the word listening form below and in listenKind) rather than a
  // kana-specific implementation, so it obeys the one `audioPrompts` toggle
  // exactly like every other listenable fact.
  if (isKanaFact(fact)) {
    const forms: CardForm[] = [];
    if (ask.japanese.responses.includes("romaji")) {
      if (ask.japanese.prompts.includes("text")) {
        for (const answer of ask.japanese.answers) {
          forms.push({
            source: "japanese",
            response: "romaji",
            listen: false,
            dir: "jp2en",
            answer,
          });
        }
      }
      if (ask.japanese.prompts.includes("audio")) {
        for (const answer of ask.japanese.answers) {
          forms.push({
            source: "japanese",
            response: "romaji",
            listen: true,
            dir: "jp2en",
            answer,
          });
        }
      }
    }
    if (ask.english.answers.length > 0) {
      forms.push({
        source: "english",
        response: "japanese",
        listen: false,
        dir: "en2jp",
        answer: "mc",
      });
    }
    return dedup(fact, forms);
  }

  const out: CardForm[] = [];
  for (const dir of candidateDirs(fact)) {
    if (dir === "jp2en") {
      const src = ask.japanese;
      if (!src.responses.includes(jp2enResponse(fact))) continue;
      for (const prompt of src.prompts) {
        const listen = prompt === "audio";
        // Generic audio is word-only. Kana dictation returned through the
        // closed matrix above; a kanji or ordinary grammar fact is dropped.
        if (
          listen &&
          ((!isKeigoFact(fact) &&
            !isTransitivityFact(fact) &&
            listenKind(fact) === null) ||
            isKanjiReadingFact(fact))
        )
          continue;
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

  // Kana-only words have no separate reading fact because their written form
  // already is their reading. Visible text → kana would therefore be a trivial
  // self-copy, but AUDIO → kana is honest dictation: hear これ, produce これ.
  // Carry that one useful reading form on the meaning fact without inventing a
  // second fact or allowing a visible Romaji prompt.
  if (
    isKanaOnlyWordMeaningFact(fact) &&
    ask.japanese.prompts.includes("audio") &&
    ask.japanese.responses.includes("romaji")
  ) {
    for (const answer of ask.japanese.answers) {
      out.push({
        source: "japanese",
        response: "japanese",
        listen: true,
        dir: "en2jp",
        answer,
      });
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

  // Collapse each typed+MC pair to the typed card (which now carries the
  // Show-choices button) BEFORE the resolved-shape dedup, so a config enabling
  // both answer formats no longer emits a text card and a redundant board for
  // the same fact.
  return dedup(fact, dropRedundantMc(fact, out));
}

/**
 * SAK-210 round 2: does THIS form survive the post-hoc, history-dependent drop
 * the real deck build applies on top of `enabledFormsFor`'s structural check?
 *
 * Mirrors — CONDITION FOR CONDITION — the two history-dependent tests in
 * drill-screen.tsx's `onMount` (`keep`, the coverage branch) and its
 * `usableForms` (the count/endless branch): a listening card whose meaning
 * must show its glyph (`meaningMustShowGlyph`, homophone collision), and a
 * corpus sentence-recognition card with no safe board to draw
 * (`pickRecognitionForFact` returning null). `isBoxSelected` — the THIRD
 * condition in `keep` — is deliberately NOT mirrored here: it depends on a
 * retry run's `retryBoxes`, which no caller of `coverageQuestionCount` /
 * `realQuestionCount` ever has in hand (the retry buttons in
 * round-complete.tsx / session-complete.tsx label themselves off the raw
 * picked/box count via `retryButtonLabel`, never off this module) — see
 * those two call sites and `retryLeg` in quiz-session.tsx.
 *
 * `pickRecognitionForFact` takes an `rng`; `() => 0` matches `onMount`'s own
 * choice for this same "does one exist at all" check, so the count is
 * deterministic across renders for the same history — not `Math.random`.
 */
function formSurvivesHistory(
  fact: FactId,
  form: CardForm,
  history: HistoryFile,
): boolean {
  return !(
    (form.source === "japanese" &&
      form.listen &&
      meaningMustShowGlyph(fact, history)) ||
    (form.source === "sentence" &&
      form.response === "definition" &&
      pickRecognitionForFact(fact, history, () => 0) === null)
  );
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
  // Shuffle FIRST (honouring the injected shuffle so tests can pin the input
  // order), THEN spread so no two cards of the same entry sit adjacent. A fact's
  // several forms all name one entry, so full coverage clumps them worse than a
  // plain deck; spreading on entryOf(pair.f) pulls them apart. Spread keeps the
  // fact and its form together because it reorders whole pairs, never the arrays
  // independently.
  const ordered = spread(shuffle(pairs), (p) => entryOf(p.f));
  return { deck: ordered.map((p) => p.f), forms: ordered.map((p) => p.form) };
}

/**
 * SAK-210: the real size of a full-coverage deck — `buildCoverageDeck`'s own
 * per-fact form expansion, PLUS the construction-category repeat multiplier
 * the coverage branch of the drill screen applies on top of it (see
 * drill-screen.tsx's `onMount`, the loop that turns `base.deck` into
 * `built.deck` by repeating each entry `constructionConfigForFact(fact)?.count`
 * times). Both callers of `buildCoverageDeck` for cards (drill-screen) and for
 * counting (this) must apply that SAME multiplier, or a category whose config
 * generates more than one card per slot silently outgrows any count that
 * skipped it.
 *
 * SAK-210 ROUND 2: also applies the SAME history-dependent drop `onMount`'s
 * `keep` array applies to `built.deck` — a listening card a homophone
 * collision must not ask, a sentence-recognition card with no safe corpus
 * board to draw (see `formSurvivesHistory`, above). Round 1 shipped this
 * function ignorant of `history` on the theory that gap was "a card or two";
 * a live repro (two grammar patterns, "Quiz me 34" vs an actual 30-card
 * coverage run) proved that theory wrong at real scale — the recognition
 * check in particular varies with how much of a pattern's tagged corpus the
 * learner can currently read, which is not a small, constant-per-fact
 * discount. `isBoxSelected` (a retry run's unselected box) is still not
 * checked — see `formSurvivesHistory`'s own doc for why that one is out of
 * scope rather than silently ignored.
 */
export function coverageQuestionCount(
  facts: readonly FactId[],
  ask: AskConfig,
  history: HistoryFile,
): number {
  let total = 0;
  for (const fact of facts) {
    const forms = enabledFormsFor(fact, ask).filter((form) =>
      formSurvivesHistory(fact, form, history),
    ).length;
    const repeats = constructionConfigForFact(fact)?.count ?? 1;
    total += forms * repeats;
  }
  return total;
}

/**
 * SAK-210: the real number of questions a quiz will ask, for a config already
 * resolved to what the launch will actually run with (mode/length/limType
 * included — see slice-bar.tsx's `startQuiz`, which snapshots the live
 * builder config and, for a generator pool, forces `length: "limited",
 * limType: "cov"` the same way this must be told to). This is the SAME
 * three-way branch drill-screen.tsx's `onMount` and `engine/index.ts`'s
 * `buildDeck` use to decide how big the deck is — not a second guess at their
 * number:
 *
 *   cov   — full coverage: `coverageQuestionCount`, above. History-aware
 *           since SAK-210 round 2.
 *   count — `buildDeck`'s repeat-fill tops a non-empty POST-FILTER pool up to
 *           `limCount` exactly (drill mode; see its own doc comment), so the
 *           answer is the configured count itself REGARDLESS of history —
 *           `onMount`'s `usableForms` filter (the same history-dependent
 *           checks `coverageQuestionCount` now applies) runs on `rt.pool`
 *           BEFORE `buildDeck` sees it, but the repeat-fill still lands
 *           exactly on `limCount` for any non-empty post-filter pool, so
 *           there is nothing for this branch to thread `history` into. (A
 *           pool that history-filters down to fully empty would under-fill —
 *           a pre-existing edge this ticket did not introduce and is not
 *           the reported bug: it already happens today for a *structurally*
 *           empty pool, with no history involved at all, e.g. an ask config
 *           under which every selected fact has zero enabled forms.)
 *   endless — no cap, no fill, and — unlike coverage — NO per-fact form
 *           expansion either: outside the coverage branch, drill-screen.tsx's
 *           `onMount` keeps `rt.pool` as ONE entry per fact, filtered through
 *           `usableForms` — the SAME two history-dependent checks
 *           `coverageQuestionCount` applies, at fact granularity rather than
 *           per-form — and rolls a single form for it per showing (see
 *           ask-forms.ts's own header, "Endless/Count — rolls ONE of them per
 *           showing"). SAK-210 round 2: this branch is ALSO history-aware now
 *           — a fact whose only enabled forms are all history-blocked (e.g.
 *           an ask config offering only Audio for a word whose meaning
 *           collides with a known homophone) no longer counts as an askable
 *           card, matching `usableForms` exactly.
 *
 * BOARD MODES ("pairs", "grid") are NOT covered — their card count comes from
 * page-specific board-building (`playablePairBoards`, `gridFacts`) this
 * module doesn't own. A caller launching one of those should size its own
 * button off the same board builder instead of this function.
 */
export function realQuestionCount(
  facts: readonly FactId[],
  cfg: Pick<QuizConfig, "length" | "limType" | "limCount" | "ask">,
  history: HistoryFile,
): number {
  if (facts.length === 0) return 0;
  if (cfg.length === "limited" && cfg.limType === "cov") {
    return coverageQuestionCount(facts, cfg.ask, history);
  }
  if (cfg.length === "limited" && cfg.limType === "count") {
    return cfg.limCount;
  }
  return facts.filter((f) =>
    enabledFormsFor(f, cfg.ask).some((form) =>
      formSurvivesHistory(f, form, history),
    ),
  ).length;
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
 * - Japanese source selects only audio, but the fact(s) do not support the
 *   selected audio response (generic audio is word-only; kana dictation is the
 *   explicit non-word exception)
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

  // Explain an audio-only configuration that produced no form.
  const audioOnly =
    ask.japanese.prompts.length === 1 &&
    ask.japanese.prompts[0] === "audio" &&
    hasJapaneseSetting;
  if (audioOnly) {
    const anyListenable = facts.some((f) => listenKind(f) !== null);
    if (!anyListenable) {
      return {
        isReachable: false,
        reason: "Audio selected but the selected material has no supported audio question",
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
