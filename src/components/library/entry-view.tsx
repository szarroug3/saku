"use client";

// The interactive half of /library/[...entry] — see page.tsx for what's
// resolved server-side (the entry, breadcrumb strings, group-nav neighbours)
// and handed down here as plain props. This keeps only what's genuinely
// interactive: useHistory, and the claim/unclaim actions.

import Link from "next/link";
import { useState } from "react";

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
import { postClaim } from "@/lib/progress-fetch";
import { useHistory } from "@/lib/use-history";
import type { EntryId, FactId } from "@/types";
import type { Kind } from "@/lib/library/entries";

export interface GroupNavData {
  readonly groupLabel: string | null;
  readonly isRangeLabel: boolean;
  readonly prev: { href: string; name: string } | null;
  readonly next: { href: string; name: string } | null;
}

export function EntryView({
  entryId,
  entryKind,
  entryName,
  breadcrumbKindHref,
  breadcrumbKindLabel,
  groupNav,
}: {
  entryId: EntryId;
  entryKind: Kind;
  entryName: string;
  breadcrumbKindHref: string;
  breadcrumbKindLabel: string;
  groupNav: GroupNavData | null;
}) {
  const { history, loaded: historyLoaded, refresh } = useHistory();
  const [now] = useState(() => Date.now());
  const claims = history.claims ?? {};

  const claim = async (ids: FactId[]) => {
    // postClaim routes a signed-out claim (401) into this browser's local history;
    // refresh() re-reads whichever store answered.
    await postClaim(ids, true);
    await refresh();
  };

  // SAK-61: "mark as not known" — the inverse of `claim` above, through the
  // exact same postClaim/refresh path with `known: false`. That flag is what
  // routes the write to dropClaims/applyDropClaims (see src/app/api/claim's
  // route and src/lib/history-ops.ts): there is no separate unclaim write to
  // invent, only the existing claim mechanism's own inverse.
  const unclaim = async (ids: FactId[]) => {
    await postClaim(ids, false);
    await refresh();
  };

  return (
    <FlatSurfaceProvider>
      {/* min-h-[calc(100vh-3rem)] (the shell's py-6 top+bottom): a short
          entry (a two-line word) still fills the column, so the sticky bar
          below reaches the viewport's bottom instead of settling right under
          two lines of content with dead space beneath it. */}
      <div className="flex min-h-[calc(100vh-3rem)] flex-col">
        <div>
          <p className="mb-3 text-[11.5px] text-text-muted">
            <Link href="/library" className="text-text-muted no-underline">
              Library
            </Link>
            {" › "}
            {/* `breadcrumbKindHref/Label`, not `entry.kind` directly: a
                construction page browses on the counters shelf, so its crumb
                links there — resolved server-side via shelfKindOf. */}
            <Link href={breadcrumbKindHref} className="text-text-muted no-underline">
              {breadcrumbKindLabel}
            </Link>
            {" › "}
            {entryName}
          </p>

          <GroupNav groupNav={groupNav} />

          <EntryBody entry={entryId} kind={entryKind} />
        </div>

        {/* Frozen at the bottom of the viewport — `sticky`, not `fixed
            inset-x-0`: the page itself is the only scroll container (see
            layout.tsx's note on that), so `sticky bottom-0` pins this exactly
            like `fixed` the instant it reaches the bottom, but stays a normal
            block inside <main>'s own column instead of stretching over the
            sidebar the way a viewport-wide fixed bar would — the same
            sticky-not-fixed choice layout.tsx's own top dock already makes.
            The chrome itself (kq-band, border, padding, mt-auto) lives inside
            SliceBar's own entry-variant branch, not here: an entry with
            nothing to claim, unclaim or quiz renders no bar at all, and this
            wrapper rendering it anyway would leave an empty bordered footer
            sitting mid-column instead of nothing. */}
        <SliceBar
          variant="entry"
          slice={{ label: entryName, entries: [entryId] }}
          showLabel={false}
          // The committed aggregate on purpose: the bar plans a drill, which
          // is a query over what you durably know, not the run you are in.
          facts={history.facts}
          claims={claims}
          history={history}
          now={now}
          onClaim={claim}
          onUnclaim={unclaim}
          progressReady={historyLoaded}
        />
      </div>
    </FlatSurfaceProvider>
  );
}

/**
 * Prev/next within THIS ENTRY'S GROUP — see group-nav.ts for how a group and
 * its order are decided. Resolved server-side into plain {href, name} pairs
 * (page.tsx) so this component never touches the guarded index itself.
 */
function GroupNav({ groupNav }: { groupNav: GroupNavData | null }) {
  if (!groupNav) return null;
  const { groupLabel, isRangeLabel, prev, next } = groupNav;
  return (
    <nav
      aria-label={groupLabel ? `${groupLabel} navigation` : "Nearby entries"}
      className="mb-4 flex items-center justify-between gap-3 text-[13px]"
    >
      {prev ? (
        <Link href={prev.href} className="min-w-0 truncate text-text no-underline">
          ‹ {prev.name}
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      {groupLabel && !isRangeLabel ? (
        <span className="shrink-0 text-[10px] uppercase tracking-[0.06em] text-text-muted">
          {groupLabel}
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
      {next ? (
        <Link href={next.href} className="min-w-0 truncate text-right text-text no-underline">
          {next.name} ›
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

/**
 * The one redesigned view for this entry's precomputed kind. Every branch
 * takes the entry id; each view either fetches its seeded payload or resolves
 * its small, content-light source data via server-lookups.ts. The live
 * registries are deliberately absent here.
 */
function EntryBody({ entry, kind }: { entry: EntryId; kind: Kind }) {
  switch (kind) {
    case "kana":
      return <KanaEntryView entry={entry} />;
    // A single Han glyph is ONE cohesive character item across every role it plays.
    // Its seeded payload contains buildGlyphItem's exact output whichever role id
    // opened it; multi-character words carry buildItem's exact word output.
    case "kanji":
    case "radical":
    case "word":
      return <CharacterEntryView entry={entry} />;
    case "counter":
    case "numbers":
      return <CounterEntryView entry={entry} />;
    case "keigo":
      return <KeigoEntryView entry={entry} />;
    case "transitivity":
      return <VerbPairEntryView entry={entry} />;
    case "grammar":
      return <GrammarEntryView entry={entry} />;
    case "grammar-concept":
      return <GrammarConceptEntryView entry={entry} />;
    case "sentence-rule":
      return <SentenceEntryView entry={entry} />;
    case "writing-rule":
      return <MarkEntryView entry={entry} />;
    case "term":
      return <TermEntryView entry={entry} />;
    default:
      return null;
  }
}
