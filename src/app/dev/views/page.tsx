// DEV gallery for the meaning-model views — each surface of the app, by content
// type, so we can build them cohesively. Not shipped UI. Route: /dev/views
//
// Building one surface at a time: Learn (next-lesson previews) first; Lesson and
// Library sections follow.

import type { ReactNode } from "react";

import { ItemPreview } from "@/components/learn/item-preview";
import { NextLessonPreview } from "@/components/learn/next-lesson-preview";
import { KanaEntryView } from "@/components/library/kana-entry-view";
import { CharacterEntryView } from "@/components/library/character-entry-view";
import { WordEntryView } from "@/components/library/word-entry-view";
import { CounterEntryView } from "@/components/library/counter-entry-view";
import { CharacterTeachView, KanaTeachView } from "@/components/library/lesson-teach-view";
import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { glassSurface, GlassSheen } from "@/components/ui/frost";
import { kanaItems } from "@/lib/content/kana-unit";
import { UNIT_TRACKS, simulateLessons } from "@/lib/content/unit-tracks";
import { teachUnitsOf } from "@/lib/content/teach-unit";
import type { PronunciationUnit } from "@/lib/content/teach-unit";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
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

// A sample next-lesson from the NEW content model — the vocab track's first
// lesson (人 口 可 何 一: mixed radical/kanji/word tiles), what the redesign is
// built to render.
const VOCAB_TRACK = UNIT_TRACKS.find((t) => t.id === "vocab")!;
const UP_NEXT = simulateLessons(VOCAB_TRACK, LESSON_RANGE_DEFAULT, 1)[0] ?? null;

// The kana whose Library entry page we redesign first (has an authored mnemonic).
const KANA_A = kanaItems().find((i) => i.glyph === "あ");
// Two radicals for the radical entry page: 禾 (bushu name のぎへん, no variant
// forms) and 水 (bushu name みず, with the positional variants 氵 / 氺).
const RADICAL_KI = buildGlyphItem("禾");
const RADICAL_MIZU = buildGlyphItem("水");
// A kanji with components + etymology + kanji built on it, for the kanji page.
const KANJI_MEI = buildGlyphItem("明");
// Multi-sense words for the "As a word" table: 生 (せい life / なま raw — a word
// sense that diverges from the kanji's core meaning) and 主 (four lord readings).
const SEI = buildGlyphItem("生");
const NUSHI = buildGlyphItem("主");
// A multi-character word for the word page (kanji pieces 先 せん · 生 せい + a
// corpus example sentence).
const WORD_SENSEI = buildItem(wordEntry("先生"), "word");

/** The primary pronunciation unit a lesson would teach for an item (the first). */
function primaryUnit(item: ContentItem | undefined): PronunciationUnit | undefined {
  if (!item) return undefined;
  return teachUnitsOf(item).find((u): u is PronunciationUnit => u.kind === "pronunciation");
}
// Counter/number shelf: a counted form (ひとつ) and a generative rule (11–99).
const COUNTER_TSU = tsu1 ? formItem(tsu1) : undefined;
const NUMBER_TENS = tens ? unitItem(tens) : undefined;

// One item of each type, to show the shared entry header is consistent.
const HEADER_SAMPLES = [
  KANA_A,
  buildGlyphItem("人"),
  buildGlyphItem("三"),
  buildItem(wordEntry("先生"), "word"),
  tsu1 ? formItem(tsu1) : undefined,
  tens ? unitItem(tens) : undefined,
  keigo,
  grammar,
  verbPair,
  sentenceItems()[0],
].filter((i): i is NonNullable<typeof i> => Boolean(i));

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
            <div key={s.label} className="w-[116px]">
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
          <div className="max-w-[720px]">
            <NextLessonPreview lesson={UP_NEXT} />
          </div>
        ) : (
          <Missing />
        )}
      </Section>

      <Section
        title="Entry header &mdash; one shape, every type"
        note="Big glyph, then the main line (a spoken reading, or a meaning/rule with no sound), then the type. Read off the item via itemHeadline."
      >
        <div className="flex flex-col gap-3">
          {HEADER_SAMPLES.map((item) => (
            <div key={String(item.entry)} className={`${glassSurface} p-4`}>
              <GlassSheen />
              <ContentEntryHeader item={item} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Library &mdash; entry page (redesign, by type)"
        note="The full reference for one item, on the content model — starting with kana: the mnemonic (drawing, sound analogy, story, proving word) read off item.mnemonic, in the glass surface."
      >
        {KANA_A ? <KanaEntryView item={KANA_A} /> : <Missing />}
        {/* Composed-by-role character page: 禾 (radical only, lean), 明 (kanji),
            水 (radical · kanji · word — readings AND bushu AND variants). */}
        {RADICAL_KI ? (
          <div className="mt-4">
            <CharacterEntryView item={RADICAL_KI} />
          </div>
        ) : null}
        {KANJI_MEI ? (
          <div className="mt-4">
            <CharacterEntryView item={KANJI_MEI} />
          </div>
        ) : null}
        {RADICAL_MIZU ? (
          <div className="mt-4">
            <CharacterEntryView item={RADICAL_MIZU} />
          </div>
        ) : null}
        {/* Multi-sense words: 生 (divergent word sense なま = raw) and 主 (four
            lord readings) exercise the "As a word" polysemy table. */}
        {SEI ? (
          <div className="mt-4">
            <CharacterEntryView item={SEI} />
          </div>
        ) : null}
        {NUSHI ? (
          <div className="mt-4">
            <CharacterEntryView item={NUSHI} />
          </div>
        ) : null}
      </Section>

      <Section
        title="Library &mdash; word page (redesign)"
        note="A multi-character word: how it's said and what it means, the kanji it's built from with each reading, and a sentence."
      >
        {WORD_SENSEI ? (
          <WordEntryView item={WORD_SENSEI} />
        ) : (
          <Missing />
        )}
      </Section>

      <Section
        title="Library &mdash; counter / number page (redesign)"
        note="Two shelf shapes: a counted form (how you say it + meaning) and a generative rule (how the number is built)."
      >
        <div className="flex flex-col gap-4">
          {COUNTER_TSU ? <CounterEntryView item={COUNTER_TSU} /> : <Missing />}
          {NUMBER_TENS ? <CounterEntryView item={NUMBER_TENS} /> : <Missing />}
        </div>
      </Section>

      <Section
        title="Lesson &mdash; teach view (redesign)"
        note="The trimmed teaching card: only the ONE reading being taught (not the full reference). Kana lesson == kana library."
      >
        <div className="flex flex-col gap-4">
          {KANA_A ? <KanaTeachView item={KANA_A} /> : <Missing />}
          {SEI && primaryUnit(SEI) ? (
            <CharacterTeachView item={SEI} unit={primaryUnit(SEI)!} />
          ) : (
            <Missing />
          )}
          {WORD_SENSEI && primaryUnit(WORD_SENSEI) ? (
            <CharacterTeachView item={WORD_SENSEI} unit={primaryUnit(WORD_SENSEI)!} />
          ) : (
            <Missing />
          )}
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
