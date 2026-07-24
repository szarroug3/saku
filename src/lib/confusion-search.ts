// The confusion search space, made ENTRY-COMPLETE.
//
// `knownFactIds` answers which FACTS the learner has a record for — the keys of
// `facts`, `claims` and `seen`. But a confusion is a mix-up between two ENTRIES,
// and knowing an entry by ONE of its facts means you know the whole word: someone
// who has answered 可's MEANING can still confuse its READING with 何's. So the
// search space `confusedWith` scans should be every fact of every entry the
// learner has met — not only the individual facts that happen to carry a record.
//
// TASK 20'S SILENT DROP
// =====================
// Sam was drilled on 何 and, on a typed READING card, typed か — the reading of
// 可, a word she looked like she had confused 何's glyph with. Nothing surfaced.
//
// The only 可 fact whose ANSWER is か is `word:可/reading`. Her known set held
// `word:可/meaning` (answers "acceptable", …) but NOT `word:可/reading`: a word's
// reading and meaning are separate facts with separate records, and she had met
// one without the other (answered the meaning, never reached the reading). So the
// widened `confusedWith(何reading, "か", deck, knownFactIds(history))` — correct
// in isolation — searched a known set in which no fact read か, and claimed
// nothing. The reading confusion was invisible while the meaning one would have
// surfaced, purely because of which of the word's two facts had a record.
//
// Expanding each known fact to its entry's facts fixes that: the moment ANY of
// 可's facts is known, all of them are candidates, so a reading miss finds 可's
// reading and a meaning miss finds its meaning, alike.
//
// STILL HONEST. `confusedWith` claims a pair only when EXACTLY ONE known ENTRY
// answers what was typed, and it counts in entry space (a Set<EntryId>). Adding
// more facts of an already-known entry introduces no NEW entry — it only lets
// more of a met entry's answers match. A pair can still only be claimed for an
// entry the learner has genuinely met, and two met entries that both answer stay
// silent, exactly as before. The widening cannot fabricate; it can only stop
// dropping.
//
// entryOf/factsOf pull the fact registry, which is why this lives here and not in
// known-facts.ts — that file is kept data-free so a light client bundle can call
// it. The drill already carries the registry, and it is this function's only
// caller.

import { entryOf, factsOf } from "@/lib/facts";
import { knownFactIds } from "@/lib/known-facts";
import type { FactId, HistoryFile } from "@/types";

/**
 * Every fact of every entry the learner has met — the confusion search space.
 *
 * Each known fact is expanded to its entry's full fact set. An id whose data is
 * gone (history outlives the dictionaries) has no entry facts to expand to, so it
 * is kept as itself rather than dropped — the same "render ugly, never vanish"
 * rule the rest of the history walk follows.
 */
export function confusionKnownFacts(history: HistoryFile): FactId[] {
  const out = new Set<FactId>();
  for (const f of knownFactIds(history)) {
    const siblings = factsOf(entryOf(f));
    if (siblings.length) for (const g of siblings) out.add(g);
    else out.add(f);
  }
  return [...out];
}
