// The writing drill's pool, from the grammar corpus (#BuildHybridAI). Short
// sentences with a pattern tag, a few from each pattern so one run is not
// twenty sentences of 〜ましょう, handed to the Sky's model
// (src/sky/lib/write-drill.ts). Built once: the same for every learner,
// since the drill reads no history. The screen shuffles it.
//
// Short means six tokens or fewer: 3,635 sentences pass, and a beginner
// writing a sentence from scratch is not writing a fourteen-token one. The
// pool is capped so the page carries a few dozen kilobytes, not the corpus.

import { corpus, type Example } from "@/data/grammar/corpus";
import { recipe } from "@/data/grammar/recipes";
import type { WriteItem } from "@/sky/lib/write-drill";

import { sentenceWords } from "./teach";

/** The longest sentence offered, in tokens. */
export const MAX_TOKENS = 6;
/** How many sentences the page gets. */
export const POOL_SIZE = 200;

/** The sentence's content words in the order it says them. The corpus lists
 * them sorted. A conjugated word is found by its stem (食べ of 食べる in
 * 食べた), and a word not found at all goes last. */
function inSentenceOrder(ex: Example): string[] {
  const at = (w: string) => {
    let i = ex.jp.indexOf(w);
    if (i < 0 && w.length > 1) i = ex.jp.indexOf(w.slice(0, -1));
    return i < 0 ? ex.jp.length : i;
  };
  return [...ex.v].sort((a, b) => at(a) - at(b));
}

/** A corpus sentence as a drill item, by its first tag that names a pattern,
 * or null when none does. */
function toItem(ex: Example): WriteItem | null {
  for (const id of ex.p) {
    const r = recipe(id);
    if (!r) continue;
    const words = sentenceWords({ id: ex.id, jp: ex.jp, en: ex.en, span: [0, 0], words: inSentenceOrder(ex), gloss: r.gloss });
    return { id: ex.id, en: ex.en, jp: ex.jp, pattern: r.pattern, gloss: r.gloss, words };
  }
  return null;
}

/** Up to `size` items, taken a round at a time across patterns: the shortest
 * sentence of every pattern, then the next shortest of every pattern, and so
 * on. Shortest first inside a pattern keeps the easy ones in. */
export function writePool(examples: readonly Example[], size = POOL_SIZE, maxTokens = MAX_TOKENS): WriteItem[] {
  const byPattern = new Map<string, WriteItem[]>();
  const short = examples.filter((ex) => ex.n <= maxTokens).sort((a, b) => a.n - b.n || a.id - b.id);
  for (const ex of short) {
    const item = toItem(ex);
    if (!item) continue;
    const list = byPattern.get(item.pattern) ?? [];
    list.push(item);
    byPattern.set(item.pattern, list);
  }
  const lists = [...byPattern.keys()].sort().map((k) => byPattern.get(k)!);
  const out: WriteItem[] = [];
  for (let round = 0; out.length < size; round++) {
    let took = false;
    for (const list of lists) {
      if (round < list.length && out.length < size) {
        out.push(list[round]);
        took = true;
      }
    }
    if (!took) break;
  }
  return out;
}

let built: WriteItem[] | undefined;

/** The drill's sentences, for the route. */
export function writeDrill(): WriteItem[] {
  built ??= writePool(corpus());
  return built;
}
