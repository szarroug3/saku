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
// WHAT STAYED: the breadcrumb, the SliceBar action bar (the drill/add-to-list the
// library has always offered), and the attribution link.

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useState } from "react";

import { AttributionLink } from "@/components/library/attribution-link";
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
import { buildGlyphItem, buildItem } from "@/lib/content/build-item";
import { sentenceItems } from "@/lib/content/sentence-track";
import { SENTENCE_ORDERING_TIERS, tierAssemblyFacts } from "@/data/assembly";
import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { grammarConceptFor } from "@/data/grammar-concepts";
import { KANJI_SUBJECT } from "@/data/kanji";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { markFor, type Mark } from "@/data/marks";
import { numberConstructionFor } from "@/data/number-construction";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { termFor } from "@/data/terms";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import {
  COUNTER_KIND,
  entryName,
  KIND_LABEL,
  libEntry,
  shelfKindOf,
  type LibEntry,
} from "@/lib/library/entries";
import { entryFromParam, entryFromSlug } from "@/lib/library/href";
import { postClaim } from "@/lib/progress-fetch";
import { sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
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

function EntryView({ entry }: { entry: LibEntry }) {
  const { history, loaded: historyLoaded, refresh } = useHistory();
  const [now] = useState(() => Date.now());
  const claims = history.claims ?? {};

  // A sentence-structure tier claims its assembly facts plus its own marker when
  // the bar's Drill leg finishes — the one bit of per-kind claim wiring the shared
  // bar needs. Undefined for every other entry.
  const mark = markFor(entry.id);
  const sentenceTier =
    mark?.shelf === "sentence"
      ? SENTENCE_ORDERING_TIERS.find((t) => t.id === mark.id.replace("sentence-rule-", ""))
      : undefined;
  const sentenceClaimFacts = sentenceTier
    ? [...tierAssemblyFacts(sentenceTier, history), sentenceTierMarkerFact(sentenceTier.id)]
    : undefined;

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

      <EntryBody entry={entry} mark={mark} />

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
        claimFacts={sentenceClaimFacts}
        progressReady={historyLoaded}
      />

      <AttributionLink />
    </FlatSurfaceProvider>
  );
}

/**
 * The one redesigned view for this entry's kind. Reference kinds (concept, term,
 * mark) take the entry id; the rest build their ContentItem the same way
 * /dev/views does. A `null` from a builder (no facts) renders nothing rather than
 * a half page — the same refusal the builders make. `mark` is threaded from the
 * caller so it is resolved once.
 */
function EntryBody({ entry, mark }: { entry: LibEntry; mark: Mark | undefined }) {
  // Reference kinds: identified by their own registries, not entry.kind, and
  // rendered off the id.
  if (grammarConceptFor(entry.id)) {
    return <GrammarConceptEntryView entry={entry.id} />;
  }
  if (termFor(entry.id)) {
    return <TermEntryView entry={entry.id} />;
  }
  if (mark) {
    if (mark.shelf === "sentence") {
      // A sentence tier's library entry IS its mark (sentence-rule-<id>); the view
      // wants the sentence-ordering item, so map across by tier id.
      const tierId = mark.id.replace("sentence-rule-", "");
      const item = sentenceItems().find((i) => String(i.entry) === `sentence-ordering:${tierId}`);
      return item ? <SentenceEntryView item={item} /> : null;
    }
    return <MarkEntryView entry={entry.id} />;
  }
  // A generative-rule (11–99, 〜本) resolves a construction before it resolves a
  // counter form, so it must be checked first.
  if (numberConstructionFor(entry.id)) {
    const item = buildItem(entry.id, "generative-rule");
    return item ? <CounterEntryView item={item} /> : null;
  }

  switch (entry.kind) {
    case KANA_SUBJECT: {
      const item = buildItem(entry.id, "kana");
      return item ? <KanaEntryView item={item} /> : null;
    }
    // A single Han glyph is ONE cohesive character item across every role it plays,
    // so radical:水 and kanji:水 render the same unified page (buildGlyphItem keys
    // on the glyph, not the entry's subject).
    case KANJI_SUBJECT:
    case RADICAL_SUBJECT: {
      const item = buildGlyphItem(entry.glyph);
      return item ? <CharacterEntryView item={item} /> : null;
    }
    case VOCAB_SUBJECT: {
      const item = buildItem(entry.id, "word");
      return item ? <CharacterEntryView item={item} /> : null;
    }
    case COUNTER_KIND: {
      const item = buildItem(entry.id, "counter");
      return item ? <CounterEntryView item={item} /> : null;
    }
    case KEIGO_SUBJECT: {
      const item = buildItem(entry.id, "keigo");
      return item ? <KeigoEntryView item={item} /> : null;
    }
    case TRANSITIVITY_SUBJECT: {
      const item = buildItem(entry.id, "transitivity");
      return item ? <VerbPairEntryView item={item} /> : null;
    }
    case GRAMMAR_SUBJECT: {
      const item = buildItem(entry.id, "grammar");
      return item ? <GrammarEntryView item={item} /> : null;
    }
    default:
      return null;
  }
}
