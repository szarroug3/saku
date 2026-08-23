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
import type { HistoryFile } from "@/types";

export function CharacterEntryView({
  item,
  lesson = false,
  history,
}: {
  item: ContentItem;
  lesson?: boolean;
  /** SAK-157: threaded through to `resolveCharacterEntryPayload` so a
   * multi-reading word's rows carry a real `fresh` flag instead of merely
   * `taught` — see character-entry-content.ts's `characterEntryPayload`. Only
   * the teach walk (teach-item-view.tsx) has a learner history to pass;
   * /dev/views omits it, same as before this fix. */
  history?: HistoryFile;
}) {
  const live = useServerLookup(resolveCharacterEntryPayload, [item, history]);
  return (
    <CharacterEntryRenderer
      item={item}
      live={live}
      lesson={lesson}
    />
  );
}
