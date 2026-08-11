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
import { CounterEntryView } from "@/components/library/counter-entry-view";
import { GrammarEntryView } from "@/components/library/grammar-entry-view";
import { KeigoEntryView } from "@/components/library/keigo-entry-view";
import { GrammarConceptEntryView } from "@/components/library/grammar-concept-entry-view";
import { VerbPairEntryView } from "@/components/library/verbpair-entry-view";
import { SentenceEntryView } from "@/components/library/sentence-entry-view";
import { MarkEntryView } from "@/components/library/mark-entry-view";
import { TermEntryView } from "@/components/library/term-entry-view";
import { PhaseIntroView } from "@/components/lesson/phase-intro-view";
import { markEntry } from "@/data/marks";
import { termEntry } from "@/data/terms";
import { TSU_INTRO } from "@/data/track-intros";
import { grammarConceptEntry } from "@/data/grammar-concepts";
import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { glassSurface, GlassSheen } from "@/components/ui/frost";
import { kanaItems } from "@/lib/content/kana-unit";
import { UNIT_TRACKS, simulateLessons } from "@/lib/content/unit-tracks";
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

// Marks, terms and grammar concepts have no buildItem path — they're referenced
// by entry id only, and their views take the entry id directly (no fabricated
// ContentItem — they render a glyph-less name header off their own data).
const MARK = markEntry("dakuten");
const HANDAKUTEN_MARK = markEntry("handakuten");
const CONCEPT = grammarConceptEntry("verb-classes");

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
        title="Library / Lesson &mdash; by content type"
        note="One page per item, grouped by type. Each type opens with its intro pages (the term/library page shown before that content is first taught, plus any non-term intro), then the entry page. A page that reads the same in both contexts is shown once as 'Library & Lesson'; one that differs shows a 'Library' and a 'Lesson' side by side."
      >
        <Sub title="Kana">
          <Slot tag="Intro — term pages">
            <TermIntros ids={["kana", "hiragana", "katakana", "romaji", "mora", "pitch-accent"]} />
          </Slot>
          <Slot tag="Library & Lesson">
            {KANA_A ? <KanaEntryView item={KANA_A} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Marks">
          <Slot tag="Intro — term pages">
            <TermIntros ids={["yoon", "okurigana", "rendaku"]} />
          </Slot>
          {/* Dakuten and handakuten have no separate intro: their library page is
              the intro — it has everything. The page differs by context, so the
              lesson narrows the conversion to the one script being taught and drops
              the "in hiragana/katakana" labels. */}
          <Slot tag="Dakuten — Library (both scripts)">
            <MarkEntryView entry={MARK} />
          </Slot>
          <Slot tag="Dakuten — Lesson (one script)">
            <MarkEntryView entry={MARK} set="hiragana" />
          </Slot>
          <Slot tag="Handakuten — Library (both scripts)">
            <MarkEntryView entry={HANDAKUTEN_MARK} />
          </Slot>
          <Slot tag="Handakuten — Lesson (one script)">
            <MarkEntryView entry={HANDAKUTEN_MARK} set="hiragana" />
          </Slot>
        </Sub>

        <Sub title="Radical">
          <Slot tag="Intro — term pages">
            <TermIntros ids={["radical"]} />
          </Slot>
          <Slot tag="Library & Lesson">
            {RADICAL_KI ? <CharacterEntryView item={RADICAL_KI} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Kanji">
          <Slot tag="Intro — term pages">
            <TermIntros ids={["kanji", "kunyomi-onyomi", "furigana", "jlpt"]} />
          </Slot>
          {/* 明 (kanji only) and 水 (radical · kanji · word, one word reading) both
              read identically in both contexts. */}
          <Slot tag="Library & Lesson">
            <div className="flex flex-col gap-4">
              {KANJI_MEI ? <CharacterEntryView item={KANJI_MEI} /> : <Missing />}
              {RADICAL_MIZU ? <CharacterEntryView item={RADICAL_MIZU} /> : <Missing />}
            </div>
          </Slot>
        </Sub>

        <Sub title="Word">
          {/* 生 (one reading, divergent sense) and 先生 (multi-character, one
              reading) don't change under lesson. 主 has four word readings, so the
              lesson caps to one — the one case a character page differs. */}
          <Slot tag="Library & Lesson">
            <div className="flex flex-col gap-4">
              {SEI ? <CharacterEntryView item={SEI} /> : <Missing />}
              {WORD_SENSEI ? <CharacterEntryView item={WORD_SENSEI} /> : <Missing />}
            </div>
          </Slot>
          <Slot tag="Library — all readings">
            {NUSHI ? <CharacterEntryView item={NUSHI} /> : <Missing />}
          </Slot>
          <Slot tag="Lesson — one pronunciation">
            {NUSHI ? <CharacterEntryView item={NUSHI} lesson /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Counter / Number">
          <Slot tag="Intro — term page">
            <TermIntros ids={["counter"]} />
          </Slot>
          {/* A non-term additional intro, shown after the counter term intro and
              before the first 〜つ form. It isn't a glossary term, so it lives as
              its own intro card rather than on a term page. */}
          <Slot tag="Intro — additional (non-term)">
            <div className={`${glassSurface} p-6`}>
              <GlassSheen />
              <PhaseIntroView intro={TSU_INTRO} />
            </div>
          </Slot>
          <Slot tag="Library & Lesson">
            <div className="flex flex-col gap-4">
              {COUNTER_TSU ? <CounterEntryView item={COUNTER_TSU} /> : <Missing />}
              {NUMBER_TENS ? <CounterEntryView item={NUMBER_TENS} /> : <Missing />}
            </div>
          </Slot>
        </Sub>

        <Sub title="Grammar">
          <Slot tag="Intro — term page">
            <TermIntros ids={["particle"]} />
          </Slot>
          <Slot tag="Library & Lesson">
            <div className="flex flex-col gap-4">
              {grammar ? <GrammarEntryView item={grammar} /> : <Missing />}
              <GrammarConceptEntryView entry={CONCEPT} />
            </div>
          </Slot>
        </Sub>

        <Sub title="Keigo">
          <Slot tag="Intro — term page">
            <TermIntros ids={["keigo"]} />
          </Slot>
          <Slot tag="Library & Lesson">
            {keigo ? <KeigoEntryView item={keigo} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Verb pairs (transitivity)">
          <Slot tag="Library & Lesson">
            {verbPair ? <VerbPairEntryView item={verbPair} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Sentences">
          <Slot tag="Library & Lesson">
            {sentenceItems()[0] ? <SentenceEntryView item={sentenceItems()[0]!} /> : <Missing />}
          </Slot>
        </Sub>
      </Section>
    </main>
  );
}

/** A titled content-type block inside the Library / Lesson gallery. */
function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-10 first:mt-2">
      <h3 className="border-b border-border/60 pb-1.5 text-[15px] font-semibold text-text">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** One labelled variant inside a Sub — an intro slot, or a Library / Lesson /
 * "Library & Lesson" render of an entry page. */
function Slot({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-accent/80">
        {tag}
      </div>
      {children}
    </div>
  );
}

/** The term/library pages that open a content type, stacked in intro order. */
function TermIntros({ ids }: { ids: string[] }) {
  return (
    <div className="flex flex-col gap-4">
      {ids.map((id) => (
        <TermEntryView key={id} entry={termEntry(id)} />
      ))}
    </div>
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
