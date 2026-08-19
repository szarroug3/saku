// Per-piece chunk-role positions for a sentence, shared by the Library's
// sentence-rule pages (mark-view.tsx, hand-authored examples matched by text
// search) and the assembly quiz's reveal (SAK-50 changes-requested pass,
// canonical pieces matched by cumulative length — see `assemblyRoleSpans`
// below). Both feed the same colored-words-plus-labeled-boxes presentation
// (components/quiz/sentence-part-breakdown.tsx), so both produce the same
// `PositionedSentencePart` shape.

import {
  CHUNK_ROLE_LABELS,
  SENTENCE_ORDERING_CHUNK_ROLES,
  type ChunkRoleKey,
  type SentenceOrderingTierId,
} from "@/data/sentence-ordering-guides";

export interface PositionedSentencePart {
  part: ChunkRoleKey;
  text: string;
  start: number;
  end: number;
}

/**
 * Role spans for an assembly item's CANONICAL pieces, positioned by
 * cumulative piece length rather than a text search — the pieces concatenate
 * to form the canonical sentence exactly (AssemblyItem.jp), so no search can
 * disagree with the pieces themselves the way it could for the Library's
 * hand-authored examples.
 *
 * Null when the tier is unknown or its role count doesn't match the piece
 * count — the same guard `chunkRoleLabels` (assembly-check.ts) uses, because
 * naming a piece's role in that case would be a guess, not a fact.
 */
export function assemblyRoleSpans(
  pieces: readonly { readonly t: string }[],
  tierId: SentenceOrderingTierId | null,
): {
  spans: readonly PositionedSentencePart[];
  labels: Partial<Record<ChunkRoleKey, string>>;
} | null {
  if (!tierId) return null;
  const roles = SENTENCE_ORDERING_CHUNK_ROLES[tierId];
  if (!roles || roles.length !== pieces.length) return null;
  let cursor = 0;
  const spans = pieces.map((piece, i) => {
    const start = cursor;
    const end = start + piece.t.length;
    cursor = end;
    return { part: roles[i], text: piece.t, start, end };
  });
  return { spans, labels: CHUNK_ROLE_LABELS[tierId] ?? {} };
}
