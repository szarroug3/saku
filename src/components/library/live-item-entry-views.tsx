"use client";

// Live-only adapters for the teach walk and /dev/views. These routes already
// have the full curriculum dictionary and a built ContentItem, so compute the
// display output synchronously and pass it into content-light shared renderers.
// Library detail pages import the renderers directly and fetch the same seeded
// output, keeping headline/grammar source dependencies off the route.

import { CounterEntryView as CounterEntryRenderer } from "@/components/library/counter-entry-view";
import { GrammarEntryView as GrammarEntryRenderer } from "@/components/library/grammar-entry-view";
import { KanaEntryView as KanaEntryRenderer } from "@/components/library/kana-entry-view";
import { KeigoEntryView as KeigoEntryRenderer } from "@/components/library/keigo-entry-view";
import { VerbPairEntryView as VerbPairEntryRenderer } from "@/components/library/verbpair-entry-view";
import { itemHeadline } from "@/lib/content/headline";
import { formLibraryPages } from "@/data/grammar/lessons";
import { autoPatternPage } from "@/data/grammar/auto-page";
import { isFormRecipe } from "@/data/grammar";
import { cluster as clusterById, membersOf } from "@/data/grammar/clusters";
import { buildRow } from "@/lib/grammar/build";
import { primaryHost } from "@/lib/grammar/example";
import { recipesOf } from "@/lib/library/library-index";
import type { ContentItem } from "@/lib/content/item";

export function KanaEntryView({ item }: { item: ContentItem }) {
  return <KanaEntryRenderer item={item} liveHeadline={itemHeadline(item)} />;
}

export function CounterEntryView({
  item,
  lesson = false,
}: {
  item: ContentItem;
  lesson?: boolean;
}) {
  return (
    <CounterEntryRenderer
      item={item}
      liveHeadline={itemHeadline(item)}
      lesson={lesson}
    />
  );
}

export function GrammarEntryView({ item }: { item: ContentItem }) {
  const liveTeachings = Object.fromEntries(
    recipesOf(item.entry).map((pattern) => [
      pattern.id,
      isFormRecipe(pattern.id)
        ? { kind: "form" as const, pages: formLibraryPages(pattern.id) }
        : { kind: "pattern" as const, pages: [autoPatternPage(pattern)] },
    ]),
  );
  const primary = recipesOf(item.entry)[0];
  const family = primary?.cluster ? clusterById(primary.cluster) : undefined;
  const liveFamilyBuilds = Object.fromEntries(
    (family ? membersOf(family) : []).map((pattern) => {
      const row = buildRow(pattern, primaryHost(pattern) ?? undefined);
      return [pattern.id, row?.built ?? ""];
    }),
  );
  return (
    <GrammarEntryRenderer
      item={item}
      liveHeadline={itemHeadline(item)}
      liveTeachings={liveTeachings}
      liveFamilyBuilds={liveFamilyBuilds}
    />
  );
}

export function KeigoEntryView({ item }: { item: ContentItem }) {
  return <KeigoEntryRenderer item={item} liveHeadline={itemHeadline(item)} />;
}

export function VerbPairEntryView({ item }: { item: ContentItem }) {
  return <VerbPairEntryRenderer item={item} liveHeadline={itemHeadline(item)} />;
}
