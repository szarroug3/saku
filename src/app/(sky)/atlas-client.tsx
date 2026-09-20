"use client";

// The Atlas's client side: the route's shelves or the browser's, the four
// lookups bound to whose history they read, and the claims through the
// app's own calls.
//
// Two things arrive, not one (SAK-381). The learner's own Atlas is small: the
// standings and the shelves' counts. The tiles and the shelves themselves are
// the same for everybody and come from /api/atlas-catalogue, once per
// browser, cached under a version that only changes when they do.

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { HearButton } from "./hear-button";
import { SkyAtlas, type AtlasLookup } from "@/sky/components/sky-atlas";

import { atlasEntry, atlasSearch, atlasSections, atlasTiles, loadAtlas } from "./actions";
import { joinAtlas, type AtlasCatalogue, type AtlasPayload } from "./atlas-payload";
import { skyHref } from "./hrefs";
import { useCatalogue } from "./use-catalogue";
import { useSkyData } from "./local";
import { PitchMark } from "./pitch-reading";
import { useStored, writeStored } from "./stored";
import { WrittenBlock } from "./written-block";
import { claimIds, unclaimIds } from "./writes";

/** How wide the entry panel was last left (SAK-471). This browser's, not this
 * account's, for the reason the lesson's height is: it is how a learner likes
 * to read on the screen in front of them, not something the account syncs. The
 * pretend learner keeps it too, since it is a choice about the window and not
 * about what anyone has learned. */
const ATLAS_PANEL_KEY = "sky:atlas:panel";

export function AtlasClient({ sample, signedIn, initial, entry }: { sample: boolean; signedIn: boolean; initial: AtlasPayload | null; entry?: string }) {
  const router = useRouter();
  // read live rather than once: nothing in the Atlas depends on the width but
  // the layout, so a second tab changing it is not a problem
  const stored = useStored<unknown>(ATLAS_PANEL_KEY, null);
  const startWidth = typeof stored === "number" ? stored : undefined;
  const onWidth = useCallback((width: number) => writeStored(ATLAS_PANEL_KEY, width), []);
  const { who, data: payload, loading } = useSkyData({ sample, signedIn, load: loadAtlas, initial, eyebrow: "Atlas", title: "What would you like to know?" });
  const shelves = useCatalogue<AtlasCatalogue>("/api/atlas-catalogue", payload?.version);
  const lookup = useMemo<AtlasLookup | null>(() => who && ({
    search: (q) => atlasSearch(who, q),
    entry: (id) => atlasEntry(who, id),
    tiles: (ids) => atlasTiles(who, ids),
    sections: (shelfId, status) => atlasSections(who, shelfId, status),
  }), [who]);
  if (!payload || !shelves || !lookup) return loading;
  const data = joinAtlas(shelves, payload);
  const claim = async (ids: readonly string[]) => { await claimIds(ids); router.refresh(); };
  const unclaim = async (ids: readonly string[]) => { await unclaimIds(ids); router.refresh(); };
  return (
    <SkyAtlas
      data={data}
      lookup={lookup}
      picksHref={(ids) => skyHref("/observatory", { sample, picks: ids })}
      quizHref={(ids) => skyHref("/quiz", { sample, from: "atlas", picks: ids })}
      written={WrittenBlock}
      hear={HearButton}
      pitch={PitchMark}
      initialEntry={entry}
      onClaim={sample ? undefined : claim}
      onUnclaim={sample ? undefined : unclaim}
      startWidth={startWidth}
      onWidth={onWidth}
    />
  );
}
