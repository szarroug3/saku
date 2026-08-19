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

import { CharacterEntryView } from "@/components/library/live-character-entry-view";
import {
  CounterEntryView,
  GrammarEntryView,
  KanaEntryView,
  KeigoEntryView,
  VerbPairEntryView,
} from "@/components/library/live-item-entry-views";
import { buildGlyphItem, buildItem } from "@/lib/content/build-item";
import { numberConstructionFor } from "@/data/number-construction";
import { COUNTER_ENTRIES } from "@/data/counters";
import type { LessonItem } from "@/lib/lesson-items";

export function TeachItemView({ item }: { item: LessonItem }) {
  switch (item.kind) {
    case "kana": {
      const built = buildItem(item.entry, "kana");
      // SAK-30: the teach walk still gates confusables/related links to
      // taught material — only the standalone Library page shows everything.
      return built ? <KanaEntryView item={built} gateToReachable /> : null;
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
      // A COUNTER shares the `word` fact subject but is a different page — the
      // numbers track teaches 〜つ natives (ひとつ) and generative rules (11–99,
      // 〜本), and rendering them as a plain word shows an empty page. Dispatch to
      // CounterEntryView the same way the Library route does (a generative rule
      // resolves before a plain counter form). Everything else is a real word.
      if (numberConstructionFor(item.entry)) {
        const built = buildItem(item.entry, "generative-rule");
        return built ? <CounterEntryView item={built} /> : null;
      }
      if (COUNTER_ENTRIES.has(item.entry)) {
        const built = buildItem(item.entry, "counter");
        return built ? <CounterEntryView item={built} /> : null;
      }
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
      // SAK-30: same lesson-only gate as the "kana" case above.
      return built ? <KeigoEntryView item={built} gateToReachable /> : null;
    }
  }
}
