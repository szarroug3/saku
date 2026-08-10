// DEV gallery for the meaning-model views — each surface of the app, by content
// type, so we can build them cohesively. Not shipped UI. Route: /dev/views
//
// Building one surface at a time: Learn (next-lesson previews) first; Lesson and
// Library sections follow.

import type { ReactNode } from "react";

import { ItemPreview } from "@/components/learn/item-preview";
import { NextLessonPreview } from "@/components/learn/next-lesson-preview";
import { GlyphView } from "@/components/library/glyph-view";
import { nextCurriculumLesson } from "@/lib/curriculum-lesson";
import { characterRoleTitle } from "@/lib/character-role";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { buildGlyphItem, buildItem } from "@/lib/content/build-item";
import { formItem, unitItem } from "@/lib/content/numbers-track";
import { sentenceItems } from "@/lib/content/sentence-track";
import { keigoItems } from "@/lib/content/keigo-unit";
import { grammarItems } from "@/lib/content/grammar-unit";
import { transitivityItems } from "@/lib/content/verb-pair-unit";
import { wordEntry } from "@/data/vocab";
import { GENERATIVE_UNITS } from "@/lib/counter-lesson";
import { COUNTER_CURRICULUM } from "@/data/counters";
import type { ContentItem } from "@/lib/content/item";

const tsu1 = COUNTER_CURRICULUM.find((f) => f.key === "counter:tsu:1");
const tens = GENERATIVE_UNITS.find((u) => u.id === "tens");

// One representative real item per content type — the Learn tile shows glyph + type.
const keigo = keigoItems().find((i) => String(i.entry) === "keigo:eat");
const grammar = grammarItems().find((i) => i.glyph === "〜たい");
const verbPair = transitivityItems().find((i) => String(i.entry) === "transitivity:開く/開ける");

const LEARN: { label: string; item: ContentItem | undefined }[] = [
  { label: "Character", item: buildGlyphItem("人") },
  { label: "Number", item: buildGlyphItem("三") },
  { label: "Word", item: buildItem(wordEntry("先生"), "word") },
  { label: "Counter", item: tsu1 ? formItem(tsu1) : undefined },
  { label: "Generative rule", item: tens ? unitItem(tens) : undefined },
  { label: "Keigo", item: keigo },
  { label: "Grammar", item: grammar },
  { label: "Transitivity", item: verbPair },
  { label: "Building sentences", item: sentenceItems()[0] },
];

const LIBRARY_SAMPLES = ["人", "三", "主", "日", "耳"];

// A representative curriculum lesson for the "Up next" redesign — walk forward
// from empty until the next lesson carries a kanji, so the sample shows the
// mixed radical/kanji/word tiles the card is designed for (not the opening
// kana-word lessons).
function sampleLesson() {
  let history = emptyHistory();
  let fallback = null;
  for (let i = 0; i < 120; i++) {
    const lesson = nextCurriculumLesson(history, LESSON_RANGE_DEFAULT);
    if (!lesson) break;
    const hasKanji = lesson.cards.some((c) => (characterRoleTitle(c.glyph) ?? "").includes("Kanji"));
    if (hasKanji) {
      fallback ??= lesson;
      if (lesson.cards.length >= 3) return lesson; // a richer, multi-tile lesson
    }
    history = applyClaims(history, lesson.facts, i + 1);
  }
  return fallback;
}
const UP_NEXT = sampleLesson();

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
        title="Learn &mdash; up next (redesign)"
        note="The curriculum lesson preview, frosted — same information as today's card, translucent body + soft shadow on the card and each tile, no backdrop blur."
      >
        {UP_NEXT ? (
          <div className="max-w-[560px]">
            <NextLessonPreview lesson={UP_NEXT} />
          </div>
        ) : (
          <Missing />
        )}
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
