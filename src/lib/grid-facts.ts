import { KANA_SUBJECT } from "@/data/characters";
import { jp2enResponse } from "@/lib/ask-forms";
import { factInfo } from "@/lib/facts";
import {
  definitionResponse,
  groupBoards,
  type BoardKey,
  type FactBoard,
} from "@/lib/quiz-boards";
import type { FactId, GridResponse } from "@/types";

const HAS_KANJI = /\p{Script=Han}/u;

/**
 * The single board a grid fact belongs to under the selected responses, or null
 * if none. A glyph has exactly one home: a meaning-bearing fact answers on its
 * subject's MEANING board (Kanji → meaning), a kana on its ROMAJI board (Kana →
 * romaji), a kanji-bearing reading on its subject's READING board (Words →
 * reading). That single-home rule is what fixes the word-vs-kanji collision —
 * kanji-可 and word-可 have different subjects, so different boards.
 */
export function gridBoardKey(
  fact: FactId,
  wanted: Set<GridResponse>,
): BoardKey | null {
  const info = factInfo(fact);
  if (!info) return null;
  const response = jp2enResponse(fact);
  // "definition" admits meaning-bearing facts and kana (which has no meaning
  // and answers in romaji) — exactly the split the header then names.
  if (
    wanted.has("definition") &&
    (response === "definition" || info.subject === KANA_SUBJECT)
  ) {
    return {
      source: info.subject,
      response: definitionResponse(info.subject === KANA_SUBJECT),
    };
  }
  // "romaji" admits kanji-bearing readings — a reading typed in romaji.
  if (wanted.has("romaji") && response === "romaji" && HAS_KANJI.test(info.glyph)) {
    return { source: info.subject, response: "reading" };
  }
  return null;
}

/**
 * The selected facts that Grid can deal, grouped into homogeneous HEADED boards
 * keyed by (source × response). Each board asks ONE thing of ONE type, named in
 * its header, and is run as its own consecutive round by the grid screen. No
 * board mixes source types or responses, and empty groups are absent.
 */
export function gridBoards(
  facts: readonly FactId[],
  responses: readonly GridResponse[],
): FactBoard[] {
  const wanted = new Set(responses);
  // Grid is a typed glyph→answer card — one-directional, so its header uses →.
  return groupBoards(facts, (fact) => gridBoardKey(fact, wanted), "→").map(
    ({ items, ...board }) => ({ ...board, facts: items }),
  );
}

/**
 * The flat pool of facts Grid can deal for the requested responses, in input
 * order — the count the Start tile and run name describe. Board grouping is a
 * presentation concern handled by `gridBoards`; the pool it draws from is the
 * same facts this returns.
 */
export function gridFacts(
  facts: readonly FactId[],
  responses: readonly GridResponse[],
): FactId[] {
  const wanted = new Set(responses);
  return facts.filter((fact) => gridBoardKey(fact, wanted) !== null);
}
