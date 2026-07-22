// A jargon word → its Library "Terms" glossary page.
//
// THE ONE PLACE A JARGON WORD BECOMES A LINK. A learner who hits "keigo" or
// "okurigana" on a surface that never defines it needs a way to the definition;
// the Terms shelf (src/data/terms.ts) has the page, and this is how a surface
// reaches it. It resolves through `entryHref` like every other Library link, so
// if the term URL scheme ever changes this follows rather than hard-codes it.
//
// IT THROWS ON AN UNKNOWN ID. A mistyped term is a typo in a link that would
// otherwise 404 quietly in a learner's face; here it is a load-time throw that
// term-href.test.ts catches, so the id is checked once, in a test, not in prod.

import { TERMS, termEntry } from "@/data/terms";
import { entryHref } from "@/lib/library/href";

const TERM_IDS: ReadonlySet<string> = new Set(TERMS.map((t) => t.id));

/** True when `id` names a real Terms glossary page. */
export function isTermId(id: string): boolean {
  return TERM_IDS.has(id);
}

/** Where a term's definition page lives — `/library/term/keigo`. Throws on an
 *  id that names no term, so a mistyped link fails a test rather than a reader. */
export function termHref(id: string): string {
  if (!TERM_IDS.has(id)) {
    throw new Error(`termHref: no such term "${id}"`);
  }
  return entryHref(termEntry(id));
}
