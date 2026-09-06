// The set of synonym-pool keys the app's CURRENT content actually needs.
//
// Pulled out of scripts/build-en-synonyms.mjs (SAK-272) so the audit script
// (scripts/audit-en-synonyms.mjs) computes "what's needed" the exact same way
// the build script does — imported, not re-implemented, for the same reason
// build-en-synonyms.mjs already imports `synonymKeyOf` from en-match.ts rather
// than restating it: two independent reductions of the same gloss data WILL
// drift, and a drifted audit is worse than no audit (false confidence).

import { ALL_FACTS, factInfo } from "@/lib/facts";
import { isEnglishGloss, stripParentheticals, synonymKeyOf } from "@/lib/en-text";

/** Every distinct queryable synonym-pool key the app's current fact data
 * (ALL_FACTS/factInfo — vocab, kanji, radicals, grammar, keigo, counters,
 * everything matchesEnglish ever compares against) reduces to. Sorted. */
export function collectSynonymKeys() {
  const keys = new Set();
  for (const id of ALL_FACTS) {
    const info = factInfo(id);
    if (!info) continue;
    for (const a of info.answers) {
      if (!isEnglishGloss(a)) continue;
      const stripped = stripParentheticals(a);
      for (const piece of [a, stripped, ...stripped.split(",")]) {
        const key = synonymKeyOf(piece);
        if (key) keys.add(key);
      }
    }
  }
  return [...keys].sort();
}
