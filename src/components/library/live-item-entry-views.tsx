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
import { formLibraryPages } from "@/data/grammar/lessons";
import { autoPatternPage } from "@/data/grammar/auto-page";
import { isFormRecipe } from "@/data/grammar";
import { cluster as clusterById, membersOf } from "@/data/grammar/clusters";
import { buildRow } from "@/lib/grammar/build";
import { primaryHost } from "@/lib/grammar/example";
import { getRecipesOf, resolveItemHeadline } from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import type { ContentItem } from "@/lib/content/item";

export function KanaEntryView({
  item,
  gateToReachable = false,
}: {
  item: ContentItem;
  /** SAK-30: forwarded to the shared renderer so the teach walk (the only
   * caller that passes true, via teach-item-view.tsx) keeps gating
   * confusables/related links to taught material, while /dev/views (which
   * never passes this) stays ungated like the Library page. */
  gateToReachable?: boolean;
}) {
  const headline = useServerLookup(resolveItemHeadline, [item]);
  return (
    <KanaEntryRenderer
      item={item}
      liveHeadline={headline}
      gateToReachable={gateToReachable}
    />
  );
}

export function CounterEntryView({
  item,
  lesson = false,
}: {
  item: ContentItem;
  lesson?: boolean;
}) {
  const headline = useServerLookup(resolveItemHeadline, [item]);
  return (
    <CounterEntryRenderer
      item={item}
      liveHeadline={headline}
      lesson={lesson}
    />
  );
}

export function GrammarEntryView({ item }: { item: ContentItem }) {
  // SAK-104: recipesOf reads library-index.ts (server-only), so this item's
  // recipe list is fetched once per entry rather than imported. Both uses
  // below want the SAME list, so one call replaces the two separate
  // `recipesOf(item.entry)` calls this used to make.
  const recipes = useServerLookup(getRecipesOf, [item.entry]) ?? [];
  const headline = useServerLookup(resolveItemHeadline, [item]);
  const liveTeachings = Object.fromEntries(
    recipes.map((pattern) => [
      pattern.id,
      isFormRecipe(pattern.id)
        ? { kind: "form" as const, pages: formLibraryPages(pattern.id) }
        : { kind: "pattern" as const, pages: [autoPatternPage(pattern)] },
    ]),
  );
  const primary = recipes[0];
  const family = primary?.cluster ? clusterById(primary.cluster) : undefined;
  const liveFamilyBuilds = Object.fromEntries(
    (family ? membersOf(family) : []).map((pattern) => {
      const row = buildRow(pattern, primaryHost(pattern) ?? undefined);
      // SAK-33: reading rides alongside the built string so PatternFamily can
      // gloss a kanji-spelled build (行かなければならない) the way the rest of
      // the app glosses a word beside its reading. Absent when buildRow found
      // no reading to build (see BuiltRow.builtReading in lib/grammar/build.ts).
      return [pattern.id, { built: row?.built ?? "", reading: row?.builtReading }];
    }),
  );
  return (
    <GrammarEntryRenderer
      item={item}
      liveHeadline={headline}
      liveTeachings={liveTeachings}
      liveFamilyBuilds={liveFamilyBuilds}
    />
  );
}

export function KeigoEntryView({
  item,
  gateToReachable = false,
}: {
  item: ContentItem;
  /** SAK-30: see KanaEntryView above — same forwarding, same default. */
  gateToReachable?: boolean;
}) {
  const headline = useServerLookup(resolveItemHeadline, [item]);
  return (
    <KeigoEntryRenderer
      item={item}
      liveHeadline={headline}
      gateToReachable={gateToReachable}
    />
  );
}

export function VerbPairEntryView({ item }: { item: ContentItem }) {
  return <VerbPairEntryRenderer item={item} />;
}
