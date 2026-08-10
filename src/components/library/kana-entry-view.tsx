"use client";

// KANA entry — the redesigned Library page for one kana, on the content model.
//
// The reference "stuff" a kana page shows — the header (glyph, reading, standing,
// sound), then the drawing, the sound analogy, the story, the proving word — is
// read off the ITEM: its reading from the mnemonic, its memory hook from
// ContentItem.mnemonic. It reuses the shared header (EntryHeader) and mnemonic
// block (MnemonicView), the same components the shipped page and the lesson walk
// render, inside the glass entry surface.

import { EntryHeader } from "@/components/library/entry-header";
import { MnemonicView } from "@/components/lesson/mnemonic-view";
import { GlassSheen, glassSurface } from "@/components/ui/frost";
import { kanaScript } from "@/data/mnemonics";
import { speak } from "@/lib/speech";
import type { ContentItem } from "@/lib/content/item";

export function KanaEntryView({ item }: { item: ContentItem }) {
  const m = item.mnemonic;
  // A kana with no authored mnemonic yet — nothing to show here.
  if (!m) return null;
  const descriptor = kanaScript(item.glyph) === "katakana" ? "Katakana" : "Hiragana";
  return (
    <article className={`${glassSurface} p-6`}>
      <GlassSheen />
      <EntryHeader
        glyph={item.glyph}
        title={m.romaji}
        sub={descriptor}
        sound={{ text: m.romaji, speak: item.glyph }}
        onSpeak={(t) => speak(t, "")}
      />
      <div className="mt-5 border-t border-border/50 pt-6">
        {/* Descriptor omitted — the header above already carries "Hiragana". */}
        <MnemonicView m={m} glyph={item.glyph} voiceName="" />
      </div>
    </article>
  );
}
