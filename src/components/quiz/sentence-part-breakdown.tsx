"use client";

// The colored-words-plus-labeled-boxes sentence presentation — the Library's
// sentence-rule pages (mark-view.tsx) had it first; the assembly quiz's
// reveal (SAK-50 changes-requested pass) reuses it rather than re-inventing
// it, per Sam's explicit ask for "the same style as the sentence lesson
// where it shows the words in color and has their definition". Extracted out
// of mark-view.tsx so both callers share one definition.

import type { ReactNode } from "react";

import type { ChunkRoleKey } from "@/data/sentence-ordering-guides";
import type { PositionedSentencePart } from "@/lib/sentence-part-spans";

export const PART_COLOR: Record<ChunkRoleKey, string> = {
  topic: "sentence-part-topic",
  core: "sentence-part-core",
  ending: "sentence-part-ending",
  context: "sentence-part-topic",
  target: "sentence-part-core",
  action: "sentence-part-action",
  condition: "sentence-part-topic",
  resultTopic: "sentence-part-action",
  // Not currently produced by any tier's SENTENCE_ORDERING_CHUNK_ROLES (see
  // that record), but ChunkRoleKey includes it, so a color is defined here
  // rather than left to fall through — a role with no color would be a
  // silent, hard-to-spot styling gap the day something does use it.
  marker: "sentence-part-core",
};

/** The full sentence, with each positioned span wrapped in its role's color. */
export function colorizeSentence(
  sentence: string,
  spans: readonly PositionedSentencePart[],
): ReactNode {
  if (spans.length === 0) return sentence;
  const out: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, i) => {
    if (span.start > cursor) out.push(sentence.slice(cursor, span.start));
    out.push(
      <span key={`${span.part}-${span.start}-${i}`} className={`font-medium ${PART_COLOR[span.part]}`}>
        {sentence.slice(span.start, span.end)}
      </span>,
    );
    cursor = span.end;
  });
  if (cursor < sentence.length) out.push(sentence.slice(cursor));
  return out;
}

/** One box per span: its role's plain-English label, and the span's own text
 * in the same color colorizeSentence gave it in the sentence above — the
 * "definition" Sam's mockup shows under each colored word. */
export function SentencePartBoxes({
  sentence,
  spans,
  labels,
  lang,
}: {
  sentence: string;
  spans: readonly PositionedSentencePart[];
  labels: Partial<Record<ChunkRoleKey, string>>;
  lang?: string;
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {spans.map((span) => (
        <div
          key={`${span.part}-${span.start}`}
          className="rounded-md border border-border/70 bg-card/60 px-2 py-1"
        >
          <span className="block text-[9px] font-semibold uppercase tracking-wide text-text-muted">
            {labels[span.part]}
          </span>
          <span lang={lang} className={`text-[13px] font-medium ${PART_COLOR[span.part]}`}>
            {sentence.slice(span.start, span.end)}
          </span>
        </div>
      ))}
    </div>
  );
}
