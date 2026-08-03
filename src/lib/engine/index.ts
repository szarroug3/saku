// Quiz engine — pure TypeScript, no React. Ports the deck/answer/stats logic
// from legacy/app.html. Question types are pluggable: the v2 roadmap
// (write-a-word, listen) and v3 (stroke order, draw) implement QuestionType
// as pure data + logic additions.

import { BEHAVIOR } from "@/lib/config";
import { enabledDirs } from "@/lib/ask-config";
import {
  answerIsJapanese,
  questionsFor,
  type PromptContext,
} from "@/lib/engine/question";
import { ALL_FACTS, entryOf, factInfo } from "@/lib/facts";
import { spread } from "@/lib/engine/spread";
import type {
  Direction,
  EntryId,
  FactId,
  FactSessionDetail,
  QuizConfig,
} from "@/types";

export {
  answerIsJapanese,
  en2jpTypeable,
  fixedDirOf,
  mcOnlyIn,
  questionsFor,
  revealFor,
  grammarVehicleFor,
  grammarSelectionFor,
  type Prompt,
  type PromptContext,
  type QuestionType,
  type GrammarVehicle,
  type GrammarSelection,
} from "@/lib/engine/question";

// The pure totals/stats math lives in engine/results.ts — no registry, no
// subject data — so a caller that only needs it can import it from there
// without pulling this barrel's facts.ts + question.ts weight. Re-exported here
// so `@/lib/engine` consumers are unchanged.
export {
  computeResults,
  missedFacts,
  type ResultsSummary,
} from "@/lib/engine/results";

// The grammar MULTIPLE-CHOICE seam: selection ("which pattern?") and
// transitivity ("which verb?") normalised into one options+correct-index card
// the drill's MC control renders without a fork. See lib/grammar/mc.ts.
export {
  nextGrammarMc,
  selectionMc,
  selectionMcsFor,
  transitivityMc,
  transitivityMcs,
  type GrammarMc,
  type GrammarChoice,
} from "@/lib/grammar/mc";

// ---------- deck ----------

/** Fisher–Yates, returns the same (mutated) array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// spread lives in ./spread (a zero-import leaf) so ask-forms can use it without
// pulling this barrel; re-exported here so @/lib/engine consumers are unchanged.
export { spread };

/**
 * Build the starting deck for drill/pairs from the selected FACTS,
 * honoring length=limited + limType=count.
 *
 * The CAP applies to BOTH modes — a Count of N means at most N cards, whether
 * they are drill questions or pairs. The REPEAT-FILL is drill-only: a drill of
 * "20 questions" over 5 facts asks each ~4 times, which is a fine thing to do to
 * a flashcard and a nonsense thing to do to a matching board (you cannot put the
 * same pair on the table twice), so pairs takes min(pool, N) and stops. Pairs
 * that runs short of N is honest — there simply are not N distinct pairs to make.
 *
 * In the normal flow the budget (src/lib/budget.ts) has already capped `facts`
 * to the count before this sees them, so the slice is a no-op there; it is here
 * so buildDeck's own contract holds for any caller, not only that one path.
 *
 * Facts, not characters: a deck of 生 is not one card, it is however many of
 * 生's readings you selected, and each is separately gradeable.
 */
export function buildDeck(facts: FactId[], cfg: QuizConfig): FactId[] {
  let deck = shuffle(facts.slice());
  if (cfg.length === "limited" && cfg.limType === "count") {
    if (cfg.mode === "drill") {
      while (facts.length > 0 && deck.length < cfg.limCount) {
        deck = deck.concat(shuffle(facts.slice()));
      }
    }
    deck = deck.slice(0, cfg.limCount);
  }
  // Spread AFTER the count-fill: count mode concatenates whole shuffled copies
  // of the fact list, so a fact's repeats share an entry and must be pushed
  // apart too, not just its sibling cards. Keying on entryOf keeps any two cards
  // of the same word (reading/meaning, and a word's per-reading cards) from
  // landing adjacent.
  return spread(deck, entryOf);
}

/** Random requeue gap: BEHAVIOR.requeueMin–requeueMax inclusive. */
export function requeueGap(): number {
  return (
    BEHAVIOR.requeueMin +
    Math.floor(Math.random() * (BEHAVIOR.requeueMax - BEHAVIOR.requeueMin + 1))
  );
}

/** Random direction inferred from the enabled source groups. */
export function pickDir(cfg: QuizConfig): Direction {
  const d: Direction[] = [];
  const dirs = enabledDirs(cfg.ask);
  if (dirs.jp2en) d.push("jp2en");
  if (dirs.en2jp) d.push("en2jp");
  return d[Math.floor(Math.random() * d.length)] ?? "jp2en";
}

// ---------- answers ----------
//
// All three delegate to the fact's subject (see engine/question.ts). They stay
// here as the drill screen's front door, but they no longer know what a kana
// is, and none of them takes a character.

/** Case/whitespace-forgiving check of a typed answer for `fact` in `dir`.
 * `ctx` carries the showing's presentation (a grammar production is graded on
 * the vehicle it was prompted with — see PromptContext). */
export function checkTyped(
  fact: FactId,
  given: string,
  dir: Direction = "jp2en",
  ctx?: PromptContext,
): boolean {
  return questionsFor(fact).check(fact, dir, given, ctx);
}

/**
 * The ENTRY a typed wrong answer names, for confusion tracking — or null.
 *
 * Entry, not fact, and not a character: a confusion is a failure to tell two
 * things apart, and the things you mix up are 生 and 先, never one of 生's
 * readings with one of 先's.
 *
 * RESOLVED WITHIN WHAT THE LEARNER KNOWS, AND ONLY WHEN UNAMBIGUOUS
 * =================================================================
 * `deck` is the cards on screen this session; `known` is every fact the learner
 * has already LEARNED (claimed, asked to be quizzed on, or answered before —
 * the caller reads it off history). Together they are the search space, and the
 * union is the defence: a confusion is something the user could actually have
 * MEANT, so the only candidates are the things they are being shown now or have
 * demonstrably met before. Searching a prediction table (the confusable pairs)
 * or the whole dictionary instead lets a reading that a hundred kanji share, or
 * a meaning that sits in a lookalike table, manufacture a pair from material the
 * user has never encountered.
 *
 * `known` is why task 20's 何↔可 was being missed. Sam typed "acceptable" — the
 * gloss of the WORD 可 (か), which she had learned but which was not in the 何
 * deck. Deck-only, that word was invisible and the confusion went unrecorded;
 * with her known facts in the search space, the one entry whose meaning she gave
 * is found. A different reading of the SAME entry is still not a confusion
 * (answering 生's ショウ when its セイ was asked is a wrong answer about 生), so
 * the asked entry is excluded.
 *
 * And only EXACTLY ONE match counts. Over kana a romaji is near-unique, but
 * over kanji "shou" is a reading of ~200 entries; if the typed answer names more
 * than one KNOWN entry, which one the user meant is unknowable, so we claim
 * none. This guard is what keeps the wider `known` search space honest: a
 * reading or gloss shared by two learned entries stays silent rather than
 * guessing. Zero matches: a plain miss, no pair. Silence beats invention — a
 * wrong confusion pair poisons the mix-ups card, Patterns, and the weakness
 * ranking, and it looks identical to the app working.
 */
export function confusedWith(
  fact: FactId,
  given: string,
  deck: FactId[],
  known: readonly FactId[] = [],
): EntryId | null {
  const g = given.trim().toLowerCase();
  if (!g) return null;
  const self = entryOf(fact);
  const matches = new Set<EntryId>();
  const seen = new Set<FactId>();
  // Deck first, then the learner's known facts — one pass over both. `seen`
  // dedupes the overlap (a deck card is usually already known) so a fact isn't
  // weighed twice; the entry Set makes double-counting harmless anyway, but the
  // early-out on ambiguity reads cleaner without it.
  for (const other of [...deck, ...known]) {
    if (seen.has(other)) continue;
    seen.add(other);
    const otherEntry = entryOf(other);
    if (otherEntry === self) continue;
    const info = factInfo(other);
    if (!info) continue;
    if (info.answers.some((a) => a.trim().toLowerCase() === g)) {
      matches.add(otherEntry);
      // Two distinct entries already answers it: ambiguous, so no claim.
      if (matches.size > 1) return null;
    }
  }
  return matches.size === 1 ? [...matches][0] : null;
}

/**
 * Multiple-choice options for `fact`, as FACTS: the answer plus its subject's
 * distractors, shuffled, at most BEHAVIOR.mcOptions.
 *
 * May return fewer — a word has no confusable data, so it gets no distractors
 * and MC degrades to a single option rather than three absurd ones. The drill
 * screen checks the length and falls back to typed.
 *
 * NO TWO OPTIONS MAY BE CO-CORRECT. A distractor that shares an answer with the
 * asked fact is unanswerable: en2jp asks "ka" and puts both か and カ on the
 * board — two right glyphs, one credited — and jp2en shows two options reading
 * "ka". So any distractor sharing an answer (case- and space-forgiving) is
 * dropped, in either direction. Over-request and slice AFTER filtering, so the
 * subject's lookalikes-first ordering survives and the board still fills.
 */
export function buildMcOptions(
  fact: FactId,
  dir: Direction = "jp2en",
  ctx?: PromptContext,
  known: readonly FactId[] = [],
): FactId[] {
  const qt = questionsFor(fact);
  const optionLimit = qt.maxOptions ?? BEHAVIOR.mcOptions;
  // What the option will READ AS in THIS card's render direction.
  //
  // This used to claim labels in BOTH directions. For a kanji-reading card,
  // every sibling reading shares the same en2jp glyph (the kanji itself), so
  // they were all dropped as duplicates before jp2en could show their distinct
  // readings. That collapsed the board and triggered unrelated fallback options.
  const labelKey = (f: FactId): string[] => {
    const keys: string[] = [];
    const push = (s: string | null | undefined) => {
      const k = s?.trim().toLowerCase();
      if (k) keys.push(k);
    };
    const shown = qt.optionLabel?.(f, dir, ctx);
    if (shown != null) push(shown);
    else if (dir === "en2jp") push(factInfo(f)?.glyph);
    else for (const a of factInfo(f)?.answers ?? []) push(a);
    return keys;
  };

  const info = factInfo(fact);
  const isKanjiReadingCard =
    dir === "jp2en" &&
    info?.subject === "kanji" &&
    answerIsJapanese(fact, "jp2en");
  const askedAnswersAreJapanese = answerIsJapanese(fact, dir);

  const knownSet = new Set(known);
  const preferKnown = (a: FactId, b: FactId) => {
    const ak = knownSet.has(a) ? 1 : 0;
    const bk = knownSet.has(b) ? 1 : 0;
    return bk - ak;
  };

  const rankedDistractorCandidates = qt
    .distractors(fact, optionLimit * 4, ctx)
    .slice()
    .sort(isKanjiReadingCard ? preferKnown : () => 0);

  const taken = new Set(labelKey(fact));
  const distractors: FactId[] = rankedDistractorCandidates
    .filter((d) => {
      if (!factInfo(d)) return false;
      const keys = labelKey(d);
      // Drop a co-correct/duplicate-label option; otherwise claim its label so
      // two distractors reading alike can't both survive.
      if (keys.some((k) => taken.has(k))) return false;
      for (const k of keys) taken.add(k);
      return true;
    })
    .slice(0, optionLimit - 1);
  // THE BACKSTOP. A board of one is not a board — DrillScreen turns it back into
  // a typed box, and for a card whose answer contains kanji there is no romaji
  // that can answer it, so the learner is shown a question they cannot get
  // right. That is how 一 came to be asked with a text box.
  //
  // Every subject that can run out of sharp distractors now fills from its own
  // corpus first (see nearbyMeaningFill), but "can this subject always find
  // one?" is a question each subject answers separately and can quietly stop
  // answering — a new subject, a counter set with five members, a pattern with
  // no siblings. So the guarantee is made HERE, once, where the board is
  // actually built: same subject, any fact, deduped by rendered label like
  // everything else.
  //
  // It is a floor, not a strategy. Reaching it means the distractors were poor;
  // it only ensures they were not absent. So it fires ONLY when the board would
  // otherwise be a board of one — never to pad a real board up to the limit.
  // Padding is each subject's own job (its `distractors` tops up from its own
  // corpus); doing it here mixes shapes that do not belong on one board — a
  // grammar PRODUCTION board built on 高い got a bare 〜てください citation stapled
  // on, an option that is not the adjective transformed at all.
  if (distractors.length === 0) {
    const subject = info?.subject;
    const backfill = ALL_FACTS
      .filter((other) => {
        if (other === fact) return false;
        const otherInfo = factInfo(other);
        if (!otherInfo) return false;
        // Reading cards should be filled with pronunciation options only.
        if (isKanjiReadingCard) {
          return (
            otherInfo.subject === "kanji" && answerIsJapanese(other, "jp2en")
          );
        }
        return (
          otherInfo.subject === subject &&
          answerIsJapanese(other, dir) === askedAnswersAreJapanese
        );
      })
      .sort(isKanjiReadingCard ? preferKnown : () => 0);

    for (const other of backfill) {
      const keys = labelKey(other);
      if (keys.some((k) => taken.has(k))) continue;
      for (const k of keys) taken.add(k);
      distractors.push(other);
      if (distractors.length >= optionLimit - 1) break;
    }
  }
  return shuffle([fact, ...distractors].slice(0, optionLimit));
}

/** Retries allowed under cfg: none → 0, lim → retryN, unl → Infinity. */
export function retriesAllowed(cfg: QuizConfig): number {
  return cfg.retries === "unl" ? Infinity : cfg.retries === "none" ? 0 : cfg.retryN;
}

// ---------- stats ----------

/**
 * Whether a resolved showing earned the FIRST-TRY credit — `firstTryCorrect`,
 * the strict-accuracy numerator and the thing the Library entry page calls
 * "nailed it".
 *
 * Three terms, and the third is the only new one: a hint forfeits the credit.
 * That is the whole cost of a hint. The showing still counts as SEEN and, when
 * it lands, as CORRECT — "right, with a hint" is the third outcome, and it is
 * recorded in the shape that already existed for "right on the second try". No
 * new metric, no new persisted field, no new standing.
 *
 * A function rather than three terms inlined at the call site because it is the
 * one rule that decides what a hint costs, and a rule with a name can be tested
 * on its own and pointed at from a comment.
 */
export function firstTryCredit(
  ok: boolean,
  tries: number,
  hinted: boolean,
): boolean {
  return ok && tries === 0 && !hinted;
}

/** Fresh per-fact stat record. */
export function newFactStat(): FactSessionDetail {
  return {
    seen: 0,
    misses: 0,
    everCorrect: false,
    firstTryCorrect: null,
    // The countable twin of the flag above: showings that earned the first-try
    // credit. The strict numerator, and the only one in `seen`'s unit.
    firstTryCount: 0,
    // Showings answered right. everCorrect asks "did you EVER get it" (a
    // yes/no over the run); this counts how many of the showings you landed,
    // and is the forgiving numerator — see src/lib/accuracy.ts.
    correct: 0,
    confused: {},
    showns: [],
    missedPhrases: [],
    saidByPhrase: {},
  };
}
