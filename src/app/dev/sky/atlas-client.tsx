"use client";

// The Atlas's client side: the route's shelves or the browser's, the four
// lookups bound to whose history they read, and the claims through the
// app's own calls.

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { HearButton } from "@/components/ui/hear-button";
import { SkyAtlas, type AtlasLookup, type SkyAtlasData } from "@/sky/components/sky-atlas";

import { atlasEntry, atlasSearch, atlasSections, atlasTiles, loadAtlas } from "./actions";
import { SkyLoading, useLoaded, useWho } from "./local";
import { PitchMark } from "./pitch-reading";
import { WrittenBlock } from "./written-block";
import { claimIds, unclaimIds } from "./writes";

export function AtlasClient({ sample, signedIn, initial, entry }: { sample: boolean; signedIn: boolean; initial: SkyAtlasData | null; entry?: string }) {
  const router = useRouter();
  const who = useWho(sample, signedIn);
  const data = useLoaded(who, loadAtlas, initial);
  const lookup = useMemo<AtlasLookup | null>(() => who && ({
    search: (q) => atlasSearch(who, q),
    entry: (id) => atlasEntry(who, id),
    tiles: (ids) => atlasTiles(who, ids),
    sections: (shelfId, status) => atlasSections(who, shelfId, status),
  }), [who]);
  if (!data || !lookup) return <SkyLoading />;
  const claim = async (ids: readonly string[]) => { await claimIds(ids); router.refresh(); };
  const unclaim = async (ids: readonly string[]) => { await unclaimIds(ids); router.refresh(); };
  return (
    <SkyAtlas
      data={data}
      lookup={lookup}
      observatoryHref={sample ? "/dev/sky/observatory?sample" : "/dev/sky/observatory"}
      quizHref={sample ? "/dev/sky/quiz?sample" : "/dev/sky/quiz"}
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
