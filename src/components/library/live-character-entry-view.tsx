"use client";

// Live-only adapter for the teach walk and /dev/views. Those routes already
// build ContentItems from the full curriculum dictionary, so they derive the
// exact character payload synchronously and never fetch. Keeping this adapter
// out of the Library detail route is what lets that route import the shared
// renderer without also bundling the live source registries.

import { CharacterEntryView as CharacterEntryRenderer } from "@/components/library/character-entry-view";
import { characterEntryPayload } from "@/lib/library/character-entry-content";
import type { ContentItem } from "@/lib/content/item";

export function CharacterEntryView({
  item,
  lesson = false,
}: {
  item: ContentItem;
  lesson?: boolean;
}) {
  return (
    <CharacterEntryRenderer
      item={item}
      live={characterEntryPayload(item)}
      lesson={lesson}
    />
  );
}
