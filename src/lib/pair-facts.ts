// The text relationships Match pairs can honestly deal, grouped into
// homogeneous HEADED boards (task #33).

import { KANA_SUBJECT } from "@/data/characters";
import { patternMeaningFactId } from "@/data/grammar";
import { jp2enResponse } from "@/lib/ask-forms";
import { questionsFor, revealFor } from "@/lib/engine/question";
import { factInfo } from "@/lib/facts";
import { readableRecognition } from "@/lib/listen-sentence";
import {
  definitionResponse,
  groupBoards,
  type BoardKey,
  type BoardResponse,
} from "@/lib/quiz-boards";
import type { FactId, HistoryFile, PairResponse } from "@/types";

const HAS_KANJI = /\p{Script=Han}/u;

export interface PairSpec {
  /** Stable within a run; variants of one fact must remain distinct. */
  id: string;
  fact: FactId;
  kind: PairResponse;
  japanese: string;
  answer: string;
  context?: string | null;
  /** The header of the board this spec belongs to ("Kanji → meaning"). Carried
   * on the spec so the screen, which walks a flat deck, can title the physical
   * board and detect a board boundary without re-deriving it. */
  header: string;
}

/** A headed board: one source type, one response, and the specs on it. */
export interface PairBoard extends BoardKey {
  header: string;
  specs: PairSpec[];
}

function definitionSpec(fact: FactId): Omit<PairSpec, "header"> | null {
  const info = factInfo(fact);
  // "Japanese + English" is the natural Latin/English counterpart: a kana's
  // romanization, or a meaning-bearing item's English definition.
  if (
    !info ||
    (info.subject !== KANA_SUBJECT && jp2enResponse(fact) !== "definition")
  ) {
    return null;
  }
  const prompt = questionsFor(fact).prompt(fact, "jp2en");
  return {
    id: `definition:${fact}`,
    fact,
    kind: "definition",
    japanese: prompt.glyph,
    answer: revealFor(fact, "jp2en"),
    context: prompt.context,
  };
}

function romajiSpec(fact: FactId): Omit<PairSpec, "header"> | null {
  const info = factInfo(fact);
  if (!info || jp2enResponse(fact) !== "romaji" || !HAS_KANJI.test(info.glyph)) {
    return null;
  }
  const prompt = questionsFor(fact).prompt(fact, "jp2en");
  return {
    id: `romaji:${fact}`,
    fact,
    kind: "romaji",
    japanese: prompt.glyph,
    answer: revealFor(fact, "jp2en"),
    context: prompt.context,
  };
}

/** The board a pair spec belongs to. The kind resolves the response directly —
 * a definition of a kana answers in romaji (Kana → romaji), otherwise a meaning
 * (Kanji → meaning); a romaji spec is a reading (Words → reading); a sentence is
 * its own source, whose cards are whole sentences matched to their meaning. */
function pairBoardKey(spec: Omit<PairSpec, "header">): BoardKey | null {
  if (spec.kind === "sentence") return { source: "sentence", response: "meaning" };
  const info = factInfo(spec.fact);
  if (!info) return null;
  if (spec.kind === "romaji") {
    return { source: info.subject, response: "reading" };
  }
  return {
    source: info.subject,
    response: definitionResponse(info.subject === KANA_SUBJECT),
  };
}

/** Every selected pair variant, ungrouped and undeduped. */
function rawSpecs(
  facts: readonly FactId[],
  kinds: readonly PairResponse[],
  history: HistoryFile,
): Array<Omit<PairSpec, "header">> {
  const wanted = new Set(facts);
  const out: Array<Omit<PairSpec, "header">> = [];
  if (kinds.includes("definition")) {
    for (const f of facts) {
      const spec = definitionSpec(f);
      if (spec) out.push(spec);
    }
  }
  if (kinds.includes("romaji")) {
    for (const f of facts) {
      const spec = romajiSpec(f);
      if (spec) out.push(spec);
    }
  }
  if (kinds.includes("sentence")) {
    const usedJp = new Set<string>();
    const usedEn = new Set<string>();
    const usedFact = new Set<FactId>();
    for (const ex of readableRecognition(history)) {
      if (!ex.jp.trim() || !ex.en.trim()) continue;
      if (usedJp.has(ex.jp) || usedEn.has(ex.en)) continue;
      const fact = ex.p
        .map(patternMeaningFactId)
        .find((f) => wanted.has(f) && !usedFact.has(f));
      if (!fact) continue;
      out.push({
        id: `sentence:${fact}:${ex.id}`,
        fact,
        kind: "sentence",
        japanese: ex.jp,
        answer: ex.en.trim(),
      });
      usedFact.add(fact);
      usedJp.add(ex.jp);
      usedEn.add(ex.en);
    }
  }
  return out;
}

/**
 * Build the selected variants and GROUP them into homogeneous headed boards
 * keyed by (source × response). The dedup-within-a-board guard runs PER BOARD:
 * a matching board must never hold two visually-correct destinations, but the
 * SAME 電話 legitimately appears once on "Words → meaning" (→ "phone") and once
 * on "Words → reading" (→ "でんわ"), because those are two different boards.
 *
 * Context is part of the Japanese cell's identity ("meaning" vs "reading", or
 * an anchor word); the answer text stands alone and must be unique on its board.
 */
export function pairBoards(
  facts: readonly FactId[],
  kinds: readonly PairResponse[],
  history: HistoryFile,
): PairBoard[] {
  const grouped = groupBoards(rawSpecs(facts, kinds, history), pairBoardKey);
  const boards: PairBoard[] = [];
  for (const { items, header, ...key } of grouped) {
    const left = new Set<string>();
    const right = new Set<string>();
    const specs: PairSpec[] = [];
    for (const spec of items) {
      const l = `${spec.japanese}\u0000${spec.context ?? ""}`;
      const r = spec.answer.trim().toLowerCase();
      if (!r || left.has(l) || right.has(r)) continue;
      left.add(l);
      right.add(r);
      specs.push({ ...spec, header });
    }
    if (specs.length) boards.push({ ...key, header, specs });
  }
  return boards;
}

/**
 * The fewest pairs a Match-pairs board can BE a matching game with. One pair is
 * not a board — there is no other pair on it to match against, so the "game" is
 * "click the only two cells", which teaches nothing and cannot be got wrong.
 */
export const MIN_PAIRS_PER_BOARD = 2;

/**
 * The boards Match-pairs can actually DEAL: the (source × response) grouping of
 * `pairBoards`, minus any degenerate board with fewer than two pairs.
 *
 * Grouping and playability are deliberately separate. `pairBoards` is the honest
 * grouping — a lone radical still HAS a "Radicals ↔ Meaning" key, and #33's board
 * tests read that grouping directly. But a one-pair board is not a matching game,
 * so the matching SCREEN builds its deck from this filtered view instead, and the
 * setup screen gates Start on it. This rule is Match-pairs-only: Grid deals typed
 * single-glyph cards (a one-card Grid is fine) and must NOT use this.
 */
export function playablePairBoards(
  facts: readonly FactId[],
  kinds: readonly PairResponse[],
  history: HistoryFile,
): PairBoard[] {
  return pairBoards(facts, kinds, history).filter(
    (b) => b.specs.length >= MIN_PAIRS_PER_BOARD,
  );
}

/**
 * A Count-limited pairs deck can slice through a board and leave its last one a
 * lone pair — a degenerate board the invariant forbids just as much as a lone
 * board does. The deck is laid out board-CONTIGUOUS (see boardDeck), so the tail
 * is the trailing run of specs sharing the last header; drop it when it is a
 * single pair. (An exactly-on-boundary slice leaves a full board and no-ops.)
 */
export function dropClippedTail(deck: readonly PairSpec[]): PairSpec[] {
  if (deck.length === 0) return [...deck];
  const lastHeader = deck[deck.length - 1].header;
  let tail = 0;
  for (let i = deck.length - 1; i >= 0 && deck[i].header === lastHeader; i--) {
    tail++;
  }
  return tail < MIN_PAIRS_PER_BOARD ? deck.slice(0, deck.length - tail) : [...deck];
}

/**
 * Every selected pair variant, deduped per board and in board order — a flat
 * view of `pairBoards` for callers that only need the specs. Consecutive specs
 * of one board stay contiguous, so a caller can still see the boards.
 */
export function pairSpecs(
  facts: readonly FactId[],
  kinds: readonly PairResponse[],
  history: HistoryFile,
): PairSpec[] {
  return pairBoards(facts, kinds, history).flatMap((b) => b.specs);
}

/** Facts that can produce at least one selected variant, for Start gating. */
export function pairFacts(
  facts: readonly FactId[],
  kinds: readonly PairResponse[],
  history: HistoryFile,
): FactId[] {
  return [...new Set(pairSpecs(facts, kinds, history).map((p) => p.fact))];
}

export type { BoardResponse };
