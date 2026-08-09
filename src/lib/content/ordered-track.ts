// orderedTrack — the common Track shape: a FIXED curriculum sequence.
//
// Most tracks teach a hand-authored list in a set order (the number-words and
// counter-forms of the numbers track, a grammar syllabus, …). This turns such a
// list into a Track: each (entry, kind) is built through `buildItem` once, and
// the order is that sequence verbatim. Dueness/prereqs/budget are NOT its job —
// the shared scheduler handles them; a track only orders (see track.ts).
//
// A spec entry with no facts is DROPPED (buildItem → undefined), so a stale list
// entry can't mint a hollow item — the same refusal buildItem makes. Tracks with
// units that have no normal entry (a generative-rule) build those items
// themselves and concatenate; orderedTrack covers the entry-backed majority.

import { buildItem } from "./build-item";
import type { ContentItem, ContentKind } from "./item";
import type { Track } from "./track";
import type { EntryId } from "@/types";

/** One position in a fixed curriculum: which entry, taught as which kind. */
export interface OrderSpec {
  readonly entry: EntryId;
  readonly kind: ContentKind;
}

/**
 * A Track whose order is the given sequence, built once. History is ignored: the
 * sequence is static and the scheduler filters what's already learned. Extra
 * items (e.g. generative-rule units) can be appended by the caller before this,
 * or a track can spread `orderedTrack(...).order(h)` and add its own.
 */
export function orderedTrack(id: string, spec: readonly OrderSpec[]): Track {
  const items: ContentItem[] = [];
  for (const s of spec) {
    const item = buildItem(s.entry, s.kind);
    if (item) items.push(item);
  }
  return { id, order: () => items };
}
