// KANA entry — the redesigned Library page for one kana, on the content model.
//
// The reference "stuff" a kana page shows — the drawing, the sound analogy, the
// story, the proving word — is the authored mnemonic, now carried ON the item
// (ContentItem.mnemonic), so this view reads it off the item instead of a
// separate lookup. It reuses the shared MnemonicView (the same block the lesson
// walk-through renders) inside the glass entry surface.

import { GlassSheen, glassSurface } from "@/components/ui/frost";
import { MnemonicView } from "@/components/lesson/mnemonic-view";
import { kanaScript } from "@/data/mnemonics";
import type { ContentItem } from "@/lib/content/item";

export function KanaEntryView({ item }: { item: ContentItem }) {
  // A kana with no authored mnemonic yet — nothing to show here.
  if (!item.mnemonic) return null;
  const script = kanaScript(item.glyph);
  const descriptor = script === "katakana" ? "Katakana" : "Hiragana";
  return (
    <article className={`${glassSurface} p-6`}>
      <GlassSheen />
      <MnemonicView
        m={item.mnemonic}
        glyph={item.glyph}
        voiceName=""
        descriptor={descriptor}
      />
    </article>
  );
}
