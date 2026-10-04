// The readings drill's pool, from the app's kanji table (SAK-495). Every kanji
// the table has readings for, in the app's teaching order, handed to the
// Sky's model (src/sky/lib/readings-drill.ts), which decides which readings
// each shows and puts the kanji in the drill's order. Built once: it is the
// same for every learner, since the drill reads no history.

import { KANJI_ORDER, READINGS } from "@/data/kanji";
import { drillPool, type DrillKanji, type TableKanji } from "@/sky/lib/readings-drill";

/** Every kanji with readings, as plain rows: the teaching order first, then
 * anything the order does not list, by character. Each kanji's readings keep
 * the table's own order. */
function readingsTable(): TableKanji[] {
  const byKanji = new Map<string, TableKanji["readings"][number][]>();
  for (const r of READINGS) {
    const list = byKanji.get(r.k) ?? [];
    // an untyped row says nothing to sort by (none ship untyped)
    if (!r.type) continue;
    list.push({ reading: r.base, kind: r.type, words: r.nWords });
    byKanji.set(r.k, list);
  }
  const ordered = KANJI_ORDER.map((o) => o.c).filter((c) => byKanji.has(c));
  const listed = new Set(ordered);
  const rest = [...byKanji.keys()].filter((c) => !listed.has(c)).sort();
  return [...ordered, ...rest].map((kanji) => ({ kanji, readings: byKanji.get(kanji)! }));
}

let built: { pool: DrillKanji[]; skipped: string[] } | undefined;

/** The drill's kanji in the order they are asked, and the ones skipped. */
export function readingsDrill(): { pool: DrillKanji[]; skipped: string[] } {
  built ??= drillPool(readingsTable());
  return built;
}
