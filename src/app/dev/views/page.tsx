// DEV gallery for the meaning-model views — each surface of the app, by content
// type, so we can build them cohesively. Not shipped UI. Route: /dev/views
//
// Building one surface at a time: Learn (next-lesson previews) first; Lesson and
// Library sections follow.

import type { ReactNode } from "react";

import { ItemPreview } from "@/components/learn/item-preview";
import { GlyphView } from "@/components/library/glyph-view";
import { buildGlyphItem, buildItem } from "@/lib/content/build-item";
import { formItem, unitItem } from "@/lib/content/numbers-track";
import { wordEntry } from "@/data/vocab";
import { GENERATIVE_UNITS } from "@/lib/counter-lesson";
import { COUNTER_CURRICULUM } from "@/data/counters";
import { contentTypeLabel, type ContentItem, type ContentKind } from "@/lib/content/item";
import type { EntryId } from "@/types";

const tsu1 = COUNTER_CURRICULUM.find((f) => f.key === "counter:tsu:1");
const tens = GENERATIVE_UNITS.find((u) => u.id === "tens");

// A minimal stand-in for a track not yet in the content model — enough to design
// its preview (glyph + type). No facts/roles; not a real buildItem output.
function mock(kind: ContentKind, glyph: string): ContentItem {
  return {
    entry: `${kind}:${glyph}` as EntryId,
    kind,
    glyph,
    facts: [],
    roles: [],
    prereqs: [],
    blockedBy: [],
    etymology: null,
    typeLabel: contentTypeLabel(kind, []),
  };
}

const LEARN: { label: string; item: ContentItem | undefined }[] = [
  { label: "Character", item: buildGlyphItem("人") },
  { label: "Number", item: buildGlyphItem("三") },
  { label: "Word", item: buildItem(wordEntry("先生"), "word") },
  { label: "Counter", item: tsu1 ? formItem(tsu1) : undefined },
  { label: "Generative rule", item: tens ? unitItem(tens) : undefined },
  // Not yet modeled — mocks, to design their previews:
  { label: "Keigo", item: mock("keigo", "食べる") },
  { label: "Grammar", item: mock("grammar", "〜たい") },
  { label: "Transitivity", item: mock("transitivity", "開く・開ける") },
  { label: "Sentence order", item: mock("sentence-ordering", "私は学生です") },
];

const LIBRARY_SAMPLES = ["人", "三", "主", "日", "耳"];

export default function ViewsDevPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-text">
      <h1 className="text-2xl font-semibold">Meaning-model views</h1>
      <p className="mt-1 text-sm text-text-muted">
        Each surface of the app, by content type — built one at a time.
      </p>

      <Section
        title="Learn — next-lesson preview"
        note="Glyph + its type only. Pronunciation and meaning are learned inside the lesson, not on this teaser."
      >
        <div className="flex flex-wrap gap-4">
          {LEARN.map((s) => (
            <div key={s.label} className="w-[150px]">
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.06em] text-text-muted">
                {s.label}
              </div>
              {s.item ? <ItemPreview item={s.item} /> : <Missing />}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Library &mdash; glyph page"
        note="The cohesive reference: every pronunciation with its meanings. (Etymology + speak next.)"
      >
        <div className="flex flex-col gap-4">
          {LIBRARY_SAMPLES.map((g) => {
            const item = buildGlyphItem(g);
            return item ? <GlyphView key={g} item={item} /> : null;
          })}
        </div>
      </Section>

      {/* Lesson &mdash; the full teaching view: next. */}
    </main>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2
        className="text-base font-medium"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <p className="mb-4 mt-0.5 text-sm text-text-muted">{note}</p>
      {children}
    </section>
  );
}

function Missing() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-text-muted">
      no sample
    </div>
  );
}
