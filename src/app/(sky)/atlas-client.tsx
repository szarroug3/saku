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
import { useMemo } from "react";

import { HearButton } from "@/components/ui/hear-button";
import { SkyAtlas, type AtlasLookup } from "@/sky/components/sky-atlas";

import { atlasEntry, atlasSearch, atlasSections, atlasTiles, loadAtlas } from "./actions";
import { joinAtlas, type AtlasCatalogue, type AtlasPayload } from "./atlas-payload";
import { useCatalogue } from "./use-catalogue";
import { SkyLoading, useLoaded, useWho } from "./local";
import { PitchMark } from "./pitch-reading";
import { WrittenBlock } from "./written-block";
import { claimIds, unclaimIds } from "./writes";

export function AtlasClient({ sample, signedIn, initial, entry }: { sample: boolean; signedIn: boolean; initial: AtlasPayload | null; entry?: string }) {
  const router = useRouter();
  const who = useWho(sample, signedIn);
  const payload = useLoaded(who, loadAtlas, initial);
  const shelves = useCatalogue<AtlasCatalogue>("/api/atlas-catalogue", payload?.version);
  const lookup = useMemo<AtlasLookup | null>(() => who && ({
    search: (q) => atlasSearch(who, q),
    entry: (id) => atlasEntry(who, id),
    tiles: (ids) => atlasTiles(who, ids),
    sections: (shelfId, status) => atlasSections(who, shelfId, status),
  }), [who]);
  if (!payload || !shelves || !lookup) return <SkyLoading eyebrow="Atlas" title={"What would you like to know?"} />;
  const data = joinAtlas(shelves, payload);
  const claim = async (ids: readonly string[]) => { await claimIds(ids); router.refresh(); };
  const unclaim = async (ids: readonly string[]) => { await unclaimIds(ids); router.refresh(); };
  return (
    <SkyAtlas
      data={data}
      lookup={lookup}
      observatoryHref={sample ? "/observatory?sample" : "/observatory"}
      quizHref={sample ? "/quiz?sample&from=atlas" : "/quiz?from=atlas"}
      written={WrittenBlock}
      hear={HearButton}
      pitch={PitchMark}
      initialEntry={entry}
      onClaim={sample ? undefined : claim}
      onUnclaim={sample ? undefined : unclaim}
      height="100%"
    />
  );
}
