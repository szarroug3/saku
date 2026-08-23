// TRANSITIVITY track — the ContentItems and VerbPairUnits of the verb pairs.
//
// A transitivity pair (src/data/transitivity-facts.ts) is one entry carrying two
// facts, one per side (happens = intransitive, doIt = transitive). `buildItem`
// turns the entry into a valid ContentItem; this file enumerates CURRICULUM_PAIRS
// (transitivity-lesson.ts) — not the raw, unfiltered VERB_PAIRS — and reads the
// pair's two members back off the data for the unit.
//
// WHY CURRICULUM_PAIRS, NOT VERB_PAIRS DIRECTLY. `transitivity.ts` curates 69
// pairs; not all of them have both member verbs actually reachable in VOCAB
// under the exact spelling the pair uses (see transitivity.ts's own notes on
// 産む and 濡れる/濡らす). This file used to build a ContentItem for all 69
// unconditionally and rely ENTIRELY on `blockedBy` to hold back the ones that
// can't be learned — which works for a pair whose verbs are merely rare and
// will eventually clear, but produces a permanently-stuck ghost item for one
// whose verb can NEVER clear. `CURRICULUM_PAIRS` already computes exactly the
// right membership (`isCurriculumWord` on both verbs) and was already the
// Library shelf's source (`shelves.tsx`) for this reason; this file simply
// wasn't wired to it, so the /learn track and the Library shelf silently
// disagreed about which pairs "the app teaches". Building from the same list
// both places read means a pair that can never be learned is absent from the
// schedule entirely, not present-but-permanently-blocked — the difference
// interleaved-schedule.test.ts's reachability check exists to catch.
//
// BLOCKING PREREQUISITE + ORDER. The transitivity SKILL — knowing which of a pair
// is intransitive vs transitive — is worth teaching only once you know the verbs
// themselves. So each pair is BLOCKED BY its two member verbs (the vocab words
// 開く and 開ける), not taught with the kanji pulled in ahead. The track then
// orders pairs by whichever of its two verbs is taught LAST in the vocab spine —
// the actual moment the pair's blockedBy gate clears, not a proxy for it.
//
// NOT the shared kanji's own position, which was tried first and stalled the
// whole track: a kanji can be extremely common (見, position ~350 of ~9,140)
// while the specific compound VERBS built from it are not (見つかる/見つける,
// positions ~9,018/9,019 — CEJC-observed rarely, so they rank near the very
// tail once the curriculum widened to essentially all of VOCAB). Sorting by 見's
// position put that pair 12th of 69, decades before its own words were ever
// taught — and since a due-but-blocked unit is never skipped by the scheduler's
// own cursor (only a fully-learned one is), every pair behind it had to be
// re-scanned past every round until it finally cleared, producing multi-hundred-
// round dead spots elsewhere in the track (see interleaved-schedule.test.ts's
// reported max gap). Sorting by the SLOWER verb's own position instead makes
// the list's order track its actual unlock order directly.

import { buildItem } from "./build-item.ts";
import { pairEntry, pairForEntry, sharedStem } from "@/data/transitivity-facts";
import { CURRICULUM_PAIRS } from "@/lib/transitivity-lesson";
import { wordEntry } from "@/data/vocab";
import { curriculumPosition } from "@/lib/curriculum-sequence";
import type { ContentItem } from "./item.ts";
import type { VerbPairUnit } from "./teach-unit.ts";

/** A curriculum position for ordering, with an untaught glyph (-1) sunk to the
 * end — works for a single kanji or a whole word glyph alike. */
function pos(glyph: string): number {
  const p = curriculumPosition(glyph);
  return p < 0 ? Infinity : p;
}

/**
 * The distinct transitivity pairs as ContentItems — one per CURRICULUM_PAIRS
 * entry (§ header: only pairs whose both verbs are actually reachable), each
 * BLOCKED BY its two member verbs, ordered by whichever verb the vocab spine
 * teaches LAST (§ header, "NOT the shared kanji's own position"). Undefined
 * builds are skipped.
 */
export function transitivityItems(): ContentItem[] {
  const rows: { item: ContentItem; sortKey: number }[] = [];
  for (const pair of CURRICULUM_PAIRS) {
    const entry = pairEntry(pair);
    const built = buildItem(entry, "transitivity");
    if (!built) continue;
    const verbs = [pair.happens.word, pair.doIt.word];
    // The gate clears when the SLOWER of the two verbs is learned, so that is
    // what the order tracks — not the shared kanji, which can clear decades
    // before either compound verb does (§ header).
    const sortKey = Math.max(...verbs.map(pos), 0);
    rows.push({
      // `built.glyph` is the happens-side word — same glyph every other view of
      // this item already uses (the Library index, the live teach card), so
      // this item agrees with them rather than carrying its own display rule.
      item: { ...built, blockedBy: verbs.map((w) => wordEntry(w)) },
      sortKey,
    });
  }
  rows.sort((a, b) => a.sortKey - b.sortKey);
  return rows.map((r) => r.item);
}

/**
 * The VerbPairUnit of a transitivity item — one unit per item. `intransitive`
 * and `transitive` come from the pair data itself (`pairForEntry`): the
 * intransitive is the `happens` member (開く), the transitive the `doIt` member
 * (開ける) — the same order the entry key encodes (`transitivity:開く/開ける`,
 * intransitive first). Falls back to splitting that key on "/" if the pair
 * lookup misses (item.glyph alone is only the intransitive side).
 */
export function verbPairUnitsOf(item: ContentItem): VerbPairUnit[] {
  const pair = pairForEntry(item.entry);
  let intransitive: string;
  let transitive: string;
  if (pair) {
    intransitive = pair.happens.word;
    transitive = pair.doIt.word;
  } else {
    // The entry key is `transitivity:開く/開ける` — the pair half after the
    // subject prefix splits intransitive-first, matching the data order above.
    const key = String(item.entry).split(":").slice(1).join(":");
    [intransitive = "", transitive = ""] = key.split("/");
  }
  // The base is the leading run the two verbs share (開く/開ける → 開) — the true
  // common anchor, since a clean shared English word often doesn't exist. Empty
  // for the one suppletive pair that shares no stem (生まれる/産む).
  const base = sharedStem(intransitive, transitive);
  return [
    {
      kind: "verb-pair" as const,
      item,
      intransitive,
      transitive,
      base,
      facts: item.facts.map((f) => f.id),
      cost: 2, // both verbs are learned — the intransitive and the transitive
    },
  ];
}
