"use client";

// The teach walk's item step, on the content model — the lesson twin of the
// Library entry page. It hands the step's item to the SAME redesigned view its
// Library page uses, with `lesson` set: one component per kind, so the walk and
// the reference cannot draw an item two different ways. What `lesson` does is
// narrow — a word shows the one pronunciation being taught rather than every
// reading (see CharacterEntryView) — everything else is identical.
//
// A LessonItem carries a glyph, an entry and a LessonKind; the ContentItem it
// needs is built the same way the Library route and /dev/views build theirs
// (buildGlyphItem for a single Han glyph, buildItem for the rest). A builder that
// answers undefined (no facts) renders nothing, the refusal the builders make.

import { CharacterEntryView } from "@/components/library/character-entry-view";
import { GrammarEntryView } from "@/components/library/grammar-entry-view";
import { KanaEntryView } from "@/components/library/kana-entry-view";
import { KeigoEntryView } from "@/components/library/keigo-entry-view";
import { VerbPairEntryView } from "@/components/library/verbpair-entry-view";
import { buildGlyphItem, buildItem } from "@/lib/content/build-item";
import type { LessonItem } from "@/lib/lesson-items";

export function TeachItemView({ item }: { item: LessonItem }) {
  switch (item.kind) {
    case "kana": {
      const built = buildItem(item.entry, "kana");
      return built ? <KanaEntryView item={built} /> : null;
    }
    // A single Han glyph is one cohesive character item across every role it
    // plays, whichever track the step arrived on. `lesson` caps the word block to
    // the pronunciation being taught.
    case "radical":
    case "kanji": {
      const built = buildGlyphItem(item.glyph);
      return built ? <CharacterEntryView item={built} lesson /> : null;
    }
    case "word": {
      const built = buildItem(item.entry, "word");
      return built ? <CharacterEntryView item={built} lesson /> : null;
    }
    case "grammar": {
      const built = buildItem(item.entry, "grammar");
      return built ? <GrammarEntryView item={built} /> : null;
    }
    case "transitivity": {
      const built = buildItem(item.entry, "transitivity");
      return built ? <VerbPairEntryView item={built} /> : null;
    }
    case "keigo": {
      const built = buildItem(item.entry, "keigo");
      return built ? <KeigoEntryView item={built} /> : null;
    }
  }
}
