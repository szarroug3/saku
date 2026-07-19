// The two confusion lines, and the rule that they are two.
//
// An entry page says two different things about what a glyph gets mixed up with,
// and they come from different places and mean different things:
//
//   "You've mixed up with"     — HISTORY. A report. It happened, and the app
//                                watched it happen.
//   "Commonly mixed up with"   — SHAPE. A prediction. LOOK_GROUP for kana,
//                                CONFUSABLE_WITH for kanji. Nobody has done
//                                anything; the app is guessing from geometry.
//
// THE MISTAKE THIS MODULE EXISTS TO PREVENT
// =========================================
// The obvious implementation of the history line is "take the shape list and
// keep the ones you've actually missed". It is one line of code, it type-checks,
// it produces a plausible list, and it is WRONG — it can only ever return glyphs
// that already look alike, so it silently discards every confusion between two
// things that look nothing alike.
//
// Those are the valuable ones. A shape analysis was never going to find them,
// which is precisely why the fact that you made them is worth knowing: it is
// information the app could not have predicted and cannot get any other way. An
// implementation that quietly drops them looks like it works, because the list
// it returns is never empty and never obviously wrong.
//
// So the history line is built from history ALONE, over every entry you actually
// answered with, and the shape line is then filtered to remove anything the
// history line already claimed. The subtraction runs in that direction only: a
// glyph appears in one line or the other, never both, because once a confusion
// is real, predicting it is beside the point.

import { confusableWith, type LibEntry } from "@/lib/library/entries";
import type { EntryId, FactId, HistoryFile } from "@/types";

export interface Mixups {
  /**
   * What you have ACTUALLY answered with instead, most-confused first.
   *
   * EMPTY IS THE NORMAL CASE and the page renders no line at all for it — no
   * placeholder, no "you haven't mixed this up yet". An absent line is already
   * legible; a line explaining its own absence is the app talking about itself.
   *
   * Expect this to stay empty for most kanji for a while. A confusion is only
   * recorded when the app can name what you picked: reliably from a
   * multiple-choice option, and from a typed answer only when exactly one entry
   * in the deck has it (`confusedWith`). Reverse kanji questions are
   * multiple-choice only, so that is the path that fills this.
   */
  readonly confused: readonly EntryId[];
  /** What merely LOOKS alike, minus anything above. A guess, and the page says so. */
  readonly lookalike: readonly EntryId[];
}

/**
 * Both lines for one entry.
 *
 * `facts` is the entry's own facts. Scoping to them is what makes this a
 * statement about THIS glyph: `detail` is keyed by fact and covers the whole
 * session, so walking all of it would report every confusion anyone made in any
 * run and print it on whichever page you happened to open.
 */
export function mixupsOf(
  entry: LibEntry,
  facts: readonly FactId[],
  history: HistoryFile,
): Mixups {
  const mine = new Set<FactId>(facts);
  const counts = new Map<EntryId, number>();

  for (const session of history.sessions) {
    const detail = session.detail;
    if (!detail) continue;
    for (const fact of mine) {
      const confused = detail[fact]?.confused;
      if (!confused) continue;
      for (const [other, n] of Object.entries(confused) as [EntryId, number][]) {
        // Guard against an entry recorded as confused with itself. It should not
        // happen, and if it ever does, a page listing 生 under "you've mixed 生
        // up with" is a nonsense the reader has no way to interpret.
        if (n > 0 && other !== entry.id) {
          counts.set(other, (counts.get(other) ?? 0) + n);
        }
      }
    }
  }

  // Most-confused first: the pair costing you the most is the one to look at.
  const confused = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);

  const claimed = new Set(confused);
  const lookalike = confusableWith(entry).filter((id) => !claimed.has(id));

  return { confused, lookalike };
}
