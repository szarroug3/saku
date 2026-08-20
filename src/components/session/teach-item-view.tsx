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
// (buildGlyphItem for a single Han glyph, buildItem for the rest) — SAK-104:
// those builders read guarded dictionaries, so the build now happens behind
// one Server Action (resolveTeachItem, in server-lookups.ts) that carries the
// exact same per-kind branch this file used to run inline. `built` is
// undefined for one render while it resolves; every branch below already
// renders null for "no item" (the builders' own undefined contract), so the
// loading gap reads the same as a step with nothing to teach.

import { CharacterEntryView } from "@/components/library/live-character-entry-view";
import {
  CounterEntryView,
  GrammarEntryView,
  KanaEntryView,
  KeigoEntryView,
  VerbPairEntryView,
} from "@/components/library/live-item-entry-views";
import { resolveTeachItem } from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import { numberConstructionFor } from "@/data/number-construction";
import { COUNTER_ENTRIES } from "@/data/counters";
import type { LessonItem } from "@/lib/lesson-items";

export function TeachItemView({ item }: { item: LessonItem }) {
  const built = useServerLookup(resolveTeachItem, [item]);
  if (!built) return null;

  switch (item.kind) {
    case "kana":
      // SAK-30: the teach walk still gates confusables/related links to
      // taught material — only the standalone Library page shows everything.
      return <KanaEntryView item={built} gateToReachable />;
    // A single Han glyph is one cohesive character item across every role it
    // plays, whichever track the step arrived on. `lesson` caps the word block to
    // the pronunciation being taught.
    case "radical":
    case "kanji":
      return <CharacterEntryView item={built} lesson />;
    case "word":
      // A COUNTER shares the `word` fact subject but is a different page — the
      // numbers track teaches 〜つ natives (ひとつ) and generative rules (11–99,
      // 〜本), and rendering them as a plain word shows an empty page. This
      // mirrors the exact check resolveTeachItem made to decide WHICH builder
      // to call server-side — both sides must agree on which kind of page
      // renders. Everything else is a real word.
      if (numberConstructionFor(item.entry) || COUNTER_ENTRIES.has(item.entry)) {
        return <CounterEntryView item={built} />;
      }
      return <CharacterEntryView item={built} lesson />;
    case "grammar":
      return <GrammarEntryView item={built} />;
    case "transitivity":
      return <VerbPairEntryView item={built} />;
    case "keigo":
      // SAK-30: same lesson-only gate as the "kana" case above.
      return <KeigoEntryView item={built} gateToReachable />;
  }
}
