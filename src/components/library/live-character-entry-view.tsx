"use client";

// Live-only adapter for the teach walk and /dev/views. Those routes already
// build ContentItems from the full curriculum dictionary; SAK-104 moved the
// actual payload derivation (characterEntryPayload) behind a Server Action
// (resolveCharacterEntryPayload, in server-lookups.ts) since it reads
// server-only dictionaries the client bundle must not carry — so this adapter
// fetches it for the item it already holds, once per glyph, instead of
// calling the guarded function directly. Keeping this adapter out of the
// Library detail route is what lets that route import the shared renderer
// without also bundling the live source registries.

import { CharacterEntryView as CharacterEntryRenderer } from "@/components/library/character-entry-view";
import { resolveCharacterEntryPayload } from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import type { ContentItem } from "@/lib/content/item";

export function CharacterEntryView({
  item,
  lesson = false,
}: {
  item: ContentItem;
  lesson?: boolean;
}) {
  const live = useServerLookup(resolveCharacterEntryPayload, [item]);
  return (
    <CharacterEntryRenderer
      item={item}
      live={live}
      lesson={lesson}
    />
  );
}
