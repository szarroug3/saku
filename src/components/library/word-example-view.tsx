"use client";

// The word in a real sentence, with the translation a human wrote for it.
//
// WHAT THIS CLAIMS, AND WHAT IT DOES NOT
// ======================================
// This is one sentence somebody actually wrote, containing this word. It is NOT
// a model sentence, a level-appropriate sentence, or a vetted one — Tatoeba is
// a community wiki and src/data/grammar/corpus.ts is blunt about what that
// means. So the label is "In a sentence" and there is no praise attached to it.
// The chooser (src/lib/library/word-example.ts) prefers sentences whose OTHER
// words are common, which is as far as the data lets the app go.
//
// ABSENT, NOT EMPTY. Four words in five have no sentence, and the page renders
// nothing at all for them — no card, no heading, no "no example yet". Rendering
// this component is the caller's decision; see the word branch of the entry
// page. A missing section is already legible, and 9,861 pages carrying a line
// about their own gap would be the app narrating itself.
//
// ATTRIBUTION LIVES IN THE PAGE FOOTER. AttributionLink names Tatoeba and leads
// to /about/data, which identifies the contributors and CC BY 2.0 FR licence.
// Tatoeba's own reuse guidance permits one shared acknowledgement, so repeating
// a provenance line under every example is unnecessary. The source id remains
// in WordExample and the generated data for auditing or reporting a bad row.

import { Card, Lbl } from "@/components/ui";
import type { WordExample } from "@/data/word-examples";

export function WordExampleView({ example }: { example: WordExample }) {
  return (
    <Card>
      <Lbl>In a sentence</Lbl>
      <p lang="ja" className="text-[22px] leading-relaxed text-text">
        {example.jp}
      </p>
      <p className="mt-1.5 text-sm text-text-muted">{example.en}</p>
    </Card>
  );
}
