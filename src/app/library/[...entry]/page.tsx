"use client";

// One entry, opened up — on the content model.
//
// This page is now a THIN DISPATCH: it resolves the URL to a library entry, draws
// the breadcrumb, hands the entry to the one redesigned view for its kind (the
// SAME components /dev/views is built from and the lesson walk renders), and puts
// the shared action bar (Drill / Add to list) beneath. Every per-kind layout,
// header, standing chip and links footer that used to live here now lives inside
// the kind's own *-entry-view; there is one description of each page, and it is
// the component.
//
// WHAT MOVED OUT, AND WHERE IT WENT
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useState } from "react";

import { CharacterEntryView } from "@/components/library/character-entry-view";
import { CounterEntryView } from "@/components/library/counter-entry-view";
import { GrammarConceptEntryView } from "@/components/library/grammar-concept-entry-view";
import { GrammarEntryView } from "@/components/library/grammar-entry-view";
import { KanaEntryView } from "@/components/library/kana-entry-view";
import { KeigoEntryView } from "@/components/library/keigo-entry-view";
import { MarkEntryView } from "@/components/library/mark-entry-view";
import { SentenceEntryView } from "@/components/library/sentence-entry-view";
import { SliceBar } from "@/components/library/slice-bar";
import { TermEntryView } from "@/components/library/term-entry-view";
import { VerbPairEntryView } from "@/components/library/verbpair-entry-view";
import { FlatSurfaceProvider } from "@/components/ui";
import {
  COUNTER_KIND,
  entryName,
  GRAMMAR_CONCEPT_SUBJECT,
  GRAMMAR_SUBJECT,
  KANJI_SUBJECT,
  KIND_LABEL,
  libEntry,
  MARK_SUBJECT,
  NUMBER_CONSTRUCTION_KIND,
  SENTENCE_RULE_KIND,
  shelfKindOf,
  VOCAB_SUBJECT,
} from "@/lib/library/library-index";
import type { IndexLibEntry } from "@/lib/library/library-index-types";
import { entryFromParam, entryFromSlug } from "@/lib/library/href";
import { postClaim } from "@/lib/progress-fetch";
import { useHistory } from "@/lib/use-history";
import type { FactId } from "@/types";

/**
 * ONE CATCH-ALL ROUTE FOR TWO URL SHAPES — a readable two-segment URL
 * (`/library/kanji/生`) and the opaque one-segment id every older link carries
 * (`/library/kanji%3A%E7%94%9F`). Both must keep working; a URL is a promise.
 * `[...entry]` is one dynamic name for the position, and the shape is read off the
 * length. Neither branch validates: both end at a Map lookup that answers
 * undefined for a stranger, and a URL outlives the data it names, so a miss is a
 * 404 rather than an empty page.
 */
export default function EntryPage({ params }: { params: Promise<{ entry: string[] }> }) {
  const { entry: path } = use(params);
  const id =
    path.length === 2 ? entryFromSlug(path[0], path[1]) : entryFromParam(path[0] ?? "");
  const entry = id ? libEntry(id) : undefined;
  if (!entry) notFound();
  return <EntryView entry={entry} />;
}

function EntryView({ entry }: { entry: IndexLibEntry }) {
  const { history, loaded: historyLoaded, refresh } = useHistory();
  const [now] = useState(() => Date.now());
  const claims = history.claims ?? {};

  const claim = async (ids: FactId[]) => {
    // postClaim routes a signed-out claim (401) into this browser's local history;
    // refresh() re-reads whichever store answered.
    await postClaim(ids, true);
    await refresh();
  };

  return (
    <FlatSurfaceProvider>
      <p className="mb-3 text-[11.5px] text-text-muted">
        <Link href="/library" className="text-text-muted no-underline">
          Library
        </Link>
        {" › "}
        {/* `shelfKindOf`, not `entry.kind`: a construction page browses on the
            counters shelf, so its crumb links there. Every other kind maps to
            itself. */}
        <Link
          href={`/library?kind=${shelfKindOf(entry.kind)}`}
          className="text-text-muted no-underline"
        >
          {KIND_LABEL[shelfKindOf(entry.kind)]}
        </Link>
        {" › "}
        {entryName(entry)}
      </p>

      <EntryBody entry={entry} />

      <SliceBar
        variant="entry"
        slice={{ label: entryName(entry), entries: [entry.id] }}
        showLabel={false}
        // The committed aggregate on purpose: the bar plans a drill, which is a
        // query over what you durably know, not the run you are in.
        facts={history.facts}
        claims={claims}
        history={history}
        now={now}
        onClaim={claim}
        progressReady={historyLoaded}
      />
    </FlatSurfaceProvider>
  );
}

/**
 * The one redesigned view for this entry's precomputed kind. Every branch takes
 * the entry id; each view either fetches its seeded payload or reads its small,
 * content-light source data. The live registries are deliberately absent here.
 */
function EntryBody({ entry }: { entry: IndexLibEntry }) {
  switch (entry.kind) {
    case "kana":
      return <KanaEntryView entry={entry.id} />;
    // A single Han glyph is ONE cohesive character item across every role it plays.
    // Its seeded payload contains buildGlyphItem's exact output whichever role id
    // opened it; multi-character words carry buildItem's exact word output.
    case KANJI_SUBJECT:
    case "radical":
    case VOCAB_SUBJECT:
      return <CharacterEntryView entry={entry.id} />;
    case COUNTER_KIND:
    case NUMBER_CONSTRUCTION_KIND:
      return <CounterEntryView entry={entry.id} />;
    case "keigo":
      return <KeigoEntryView entry={entry.id} />;
    case "transitivity":
      return <VerbPairEntryView entry={entry.id} />;
    case GRAMMAR_SUBJECT:
      return <GrammarEntryView entry={entry.id} />;
    case GRAMMAR_CONCEPT_SUBJECT:
      return <GrammarConceptEntryView entry={entry.id} />;
    case SENTENCE_RULE_KIND:
      return <SentenceEntryView entry={entry.id} />;
    case MARK_SUBJECT:
      return <MarkEntryView entry={entry.id} />;
    case "term":
      return <TermEntryView entry={entry.id} />;
    default:
      return null;
  }
}
