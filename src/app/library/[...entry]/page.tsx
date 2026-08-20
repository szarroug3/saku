// One entry, opened up — on the content model.
//
// SAK-104: this page resolves the URL to a library entry, the breadcrumb and
// the group-nav neighbours SERVER-SIDE (library-index.ts/href.ts are
// server-only — the ~9.5MB dictionary they read from must never reach a client
// bundle) and hands the already-resolved, already-serializable pieces down to
// EntryView, a Client Component that keeps only what's genuinely interactive
// (useHistory, the claim/unclaim actions). See entry-view.tsx for what moved.
//
// WHAT MOVED OUT, AND WHERE IT WENT (unchanged from the prior file header)
// =================================
//  - the glyph/reading/standing header       → each view's ContentEntryHeader
//  - kana mnemonic + context + confusables    → KanaEntryView
//  - kanji/radical/word roles + confusables   → CharacterEntryView
//  - counter/number, grammar, keigo, verb
//    pairs, sentences, marks, terms, concepts → their *-entry-view
//  - the per-fact standing chips / counts     → dropped (a reference page is not a
//                                               progress readout; the bar drills)
//  - the family grid / "appears in" / "seen
//    as a part of" grids                      → dropped with the redesign
//
// WHAT STAYED: the breadcrumb and the SliceBar action (now the entry variant — a
// lone "Quiz me" when the entry is quizzable, nothing otherwise). The data-sources
// acknowledgement is no longer per-page; it lives in the global sidebar.

import { notFound } from "next/navigation";

import {
  entryName,
  KIND_LABEL,
  libEntry,
  shelfKindOf,
} from "@/lib/library/library-index";
import { entryFromParam, entryFromSlug, entryHref } from "@/lib/library/href";
import { groupNeighbors } from "@/lib/library/group-nav";
import { EntryView } from "@/components/library/entry-view";

/**
 * ONE CATCH-ALL ROUTE FOR TWO URL SHAPES — a readable two-segment URL
 * (`/library/kanji/生`) and the opaque one-segment id every older link carries
 * (`/library/kanji%3A%E7%94%9F`). Both must keep working; a URL is a promise.
 * `[...entry]` is one dynamic name for the position, and the shape is read off the
 * length. Neither branch validates: both end at a Map lookup that answers
 * undefined for a stranger, and a URL outlives the data it names, so a miss is a
 * 404 rather than an empty page.
 */
export default async function EntryPage({
  params,
}: {
  params: Promise<{ entry: string[] }>;
}) {
  const { entry: path } = await params;
  const id =
    path.length === 2 ? entryFromSlug(path[0], path[1]) : entryFromParam(path[0] ?? "");
  const entry = id ? libEntry(id) : undefined;
  if (!entry) notFound();

  const kind = shelfKindOf(entry.kind);
  const { groupLabel, isRangeLabel, prev, next } = groupNeighbors(entry);

  return (
    <EntryView
      entryId={entry.id}
      entryKind={entry.kind}
      entryName={entryName(entry)}
      breadcrumbKindHref={`/library?kind=${kind}`}
      breadcrumbKindLabel={KIND_LABEL[kind]}
      groupNav={
        prev || next
          ? {
              groupLabel,
              isRangeLabel,
              prev: prev ? { href: entryHref(prev.id), name: entryName(prev) } : null,
              next: next ? { href: entryHref(next.id), name: entryName(next) } : null,
            }
          : null
      }
    />
  );
}
