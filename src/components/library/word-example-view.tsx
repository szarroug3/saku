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
// THE ID IS THE ATTRIBUTION. Every sentence links to its Tatoeba page, where
// the contributors who wrote and translated it are named. The licence
// acknowledgement is the AttributionLink at the foot of the page — its label
// already names sentence data and Tatoeba — and this link is the provenance on
// top of it: it is how a reader checks a sentence, and how they report a bad
// one.

import { Card, Lbl } from "@/components/ui";
import { tatoebaHref, type WordExample } from "@/data/word-examples";

export function WordExampleView({ example }: { example: WordExample }) {
  return (
    <Card>
      <Lbl>In a sentence</Lbl>
      <p lang="ja" className="text-[22px] leading-relaxed text-text">
        {example.jp}
      </p>
      <p className="mt-1.5 text-sm text-text-muted">{example.en}</p>
      <p className="mt-2.5 text-xs text-text-muted">
        <a
          href={tatoebaHref(example.id)}
          target="_blank"
          rel="noreferrer"
          className="text-text-muted underline"
        >
          Sentence {example.id} from Tatoeba
        </a>
      </p>
    </Card>
  );
}
