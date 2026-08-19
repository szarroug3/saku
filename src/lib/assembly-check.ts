// Wrong-answer mismatch detection for the ASSEMBLY ("build the sentence")
// question type. gradeAssembly (src/data/assembly.ts) answers only right/wrong
// for the whole tray; this module answers the more specific question a wrong
// check leaves open — WHICH chunk is out of place, named with the same
// plain-English role labels the sentence-ordering teach walkthrough already
// uses for that tier (SENTENCE_ORDERING_CHUNK_ROLES / CHUNK_ROLE_LABELS in
// src/data/sentence-ordering-guides.ts), so a wrong check can say "Final
// predicate is out of place" instead of only reddening the tray.
//
// The role labels are keyed by TIER + POSITION, not by individual piece — the
// assembly corpus has no per-piece role field, and adding one would mean
// hand-tagging thousands of generated corpus pieces. Tying a role to a
// canonical index is safe only when the item's piece count matches the tier's
// expected role count; a fixed sentence with a different chunk count (an
// extra clause, a dropped topic) makes a positional label a guess rather than
// a fact, so it is withheld — see `chunkRoleLabels`.

import { canonicalOrder, type AssemblyItem } from "@/data/assembly";
import {
  CHUNK_ROLE_LABELS,
  SENTENCE_ORDERING_CHUNK_ROLES,
  type SentenceOrderingTierId,
} from "@/data/sentence-ordering-guides";

/** The learner-facing role label for each canonical piece of this item, in
 * canonical order — or null when the tier is unknown or its role count
 * doesn't line up with this item's actual piece count, in which case naming a
 * chunk by role would be a guess. */
export function chunkRoleLabels(
  tierId: SentenceOrderingTierId | null,
  pieceCount: number,
): readonly (string | null)[] | null {
  if (!tierId) return null;
  const roles = SENTENCE_ORDERING_CHUNK_ROLES[tierId];
  if (!roles || roles.length !== pieceCount) return null;
  const labels = CHUNK_ROLE_LABELS[tierId];
  return roles.map((role) => labels?.[role] ?? null);
}

/** The trailing sentence punctuation a canonical sentence's LAST piece alone
 * carries (。！？ — the assembly ingest tags pieces by word boundary, and
 * punctuation rides with whichever piece it follows, which is always the
 * final one). Stripped for DISPLAY on the draggable pieces only (SAK-50
 * changes-requested: Sam's own words, "remove the ending punctuation from the
 * sentence quiz draggable pieces. it makes it obvious which word goes last").
 * The underlying piece surface — what's stored in the pool/tray arrays,
 * compared against canonicalOrder, and joined back into the sentence — is
 * untouched, so grading and the assembled `item.jp` reveal are unaffected. */
export function pieceLabel(surface: string): string {
  return surface.replace(/[。！？]+$/u, "");
}

export interface AssemblyMismatch {
  /** Index into the CANONICAL order where the misplaced piece actually belongs. */
  canonIndex: number;
  /** Index into the learner's tray where the misplaced piece currently sits. */
  trayIndex: number;
  /** The piece surface that's out of place. */
  surface: string;
  /** This chunk's role label (e.g. "Topic", "Final predicate"), when known —
   * see `chunkRoleLabels`. Null when the item carries no usable role data. */
  label: string | null;
}

/**
 * Find the first position where the learner's built tray diverges from the
 * canonical order — the most specific, honest description of what's wrong,
 * rather than just "the whole thing is wrong". Returns null when the tray
 * already matches the canonical order, or when the lengths differ (shouldn't
 * happen in practice: the Check button is disabled until the tray is full).
 */
export function findAssemblyMismatch(
  item: AssemblyItem,
  tray: readonly string[],
  tierId: SentenceOrderingTierId | null,
): AssemblyMismatch | null {
  const canon = canonicalOrder(item);
  if (tray.length !== canon.length) return null;

  const labels = chunkRoleLabels(tierId, canon.length);

  for (let i = 0; i < canon.length; i++) {
    if (tray[i] === canon[i]) continue;
    const foundAt = canon.indexOf(tray[i]);
    const canonIndex = foundAt >= 0 ? foundAt : i;
    return {
      canonIndex,
      trayIndex: i,
      surface: tray[i],
      label: labels?.[canonIndex] ?? null,
    };
  }
  return null;
}

/** A short, learner-facing sentence naming the misplaced chunk — the labeled
 * form when one is known, a positional fallback ("Chunk 2") when it is not,
 * so a wrong check always says something specific rather than nothing. */
export function assemblyMismatchMessage(mismatch: AssemblyMismatch): string {
  return mismatch.label
    ? `${mismatch.label} is out of place.`
    : `Chunk ${mismatch.canonIndex + 1} is out of place.`;
}
