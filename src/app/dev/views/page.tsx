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
import { TRANSITIVITY_INTRO } from "@/data/phase-intros";
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

// One hiragana (あ, has an authored mnemonic) and one katakana (ア), for the two
// kana sections' content pages.
const KANA_A = kanaItems().find((i) => i.glyph === "あ");
const KANA_KATA = kanaItems().find((i) => i.glyph === "ア");
// A yōon combination (きゃ), for the yōon section's content page.
const KANA_YOON = kanaItems().find((i) => i.glyph === "きゃ");
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
        title="Library / Lesson &mdash; by concept"
        note="One section per concept. Each shows the term page (which is both the intro and the term's own library page — the same page), then the concept's content page. A page that reads the same across contexts is shown once ('… & …'); one that differs shows each. Concepts that are never introduced — reference terms people just come across — are collected at the very end."
      >
        <Sub title="Kana">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("kana")} />
          </Slot>
        </Sub>

        <Sub title="Hiragana">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("hiragana")} />
          </Slot>
          <Slot tag="Content — library & lesson">
            {KANA_A ? <KanaEntryView item={KANA_A} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Katakana">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("katakana")} />
          </Slot>
          <Slot tag="Content — library & lesson">
            {KANA_KATA ? <KanaEntryView item={KANA_KATA} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Dakuten">
          {/* The mark page is the intro AND the library — it has everything, so
              there is no separate term page. It differs by context: the lesson
              narrows to the one script being taught and drops the script labels. */}
          <Slot tag="Intro & library — both scripts">
            <MarkEntryView entry={MARK} />
          </Slot>
          <Slot tag="Lesson — one script">
            <MarkEntryView entry={MARK} set="hiragana" />
          </Slot>
        </Sub>

        <Sub title="Handakuten">
          <Slot tag="Intro & library — both scripts">
            <MarkEntryView entry={HANDAKUTEN_MARK} />
          </Slot>
          <Slot tag="Lesson — one script">
            <MarkEntryView entry={HANDAKUTEN_MARK} set="hiragana" />
          </Slot>
        </Sub>

        <Sub title="Yōon">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("yoon")} />
          </Slot>
          <Slot tag="Content — library & lesson">
            {KANA_YOON ? <KanaEntryView item={KANA_YOON} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Radical">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("radical")} />
          </Slot>
          {/* Radical only (禾): the single-role case — no kanji or word sections,
              no "As a …" header. */}
          <Slot tag="Content — radical only — library & lesson">
            {RADICAL_KI ? <CharacterEntryView item={RADICAL_KI} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Kanji">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("kanji")} />
          </Slot>
          {/* Kanji only (明): the single-role case — one "As a kanji" section, no
              "As a …" header. */}
          <Slot tag="Content — kanji only — library & lesson">
            {KANJI_MEI ? <CharacterEntryView item={KANJI_MEI} /> : <Missing />}
          </Slot>
          {/* All three roles (水): radical · kanji · word, so all three sections
              show with their "As a …" headers. */}
          <Slot tag="Content — radical · kanji · word — library & lesson">
            {RADICAL_MIZU ? <CharacterEntryView item={RADICAL_MIZU} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Kun’yomi & on’yomi">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("kunyomi-onyomi")} />
          </Slot>
        </Sub>

        <Sub title="Word">
          {/* Pitch accent, then a mora — introduced in the word track in that
              order, because a pitch is drawn over the morae of a word. */}
          <Slot tag="Term intros">
            <TermIntros ids={["pitch-accent", "mora"]} />
          </Slot>
          {/* Word only (先生): the single-role case — one word section, no "As a …"
              header. This is the multi-character word page. */}
          <Slot tag="Content — word only (先生) — library & lesson">
            {WORD_SENSEI ? <CharacterEntryView item={WORD_SENSEI} /> : <Missing />}
          </Slot>
          {/* Kanji + word (生): two sections, so the "As a kanji" / "As a word"
              headers appear. なま diverges from the kanji's core sense. */}
          <Slot tag="Content — kanji + word (生) — library & lesson">
            {SEI ? <CharacterEntryView item={SEI} /> : <Missing />}
          </Slot>
          {/* 主 has four word readings, so the lesson caps to one — the one case a
              character page differs between library and lesson. */}
          <Slot tag="Content — kanji + word (主) — library (all readings)">
            {NUSHI ? <CharacterEntryView item={NUSHI} /> : <Missing />}
          </Slot>
          <Slot tag="Content — kanji + word (主) — lesson (one pronunciation)">
            {NUSHI ? <CharacterEntryView item={NUSHI} lesson /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Counter / Number">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("counter")} />
          </Slot>
          {/* A non-term additional intro, shown after the counter term intro and
              before the first 〜つ form. It isn't a glossary term, so it lives as
              its own intro card rather than on a term page. */}
          <Slot tag="Additional intro — non-term">
            <div className={`${glassSurface} p-6`}>
              <GlassSheen />
              <PhaseIntroView intro={TSU_INTRO} />
            </div>
          </Slot>
          <Slot tag="Content — library & lesson">
            <div className="flex flex-col gap-4">
              {COUNTER_TSU ? <CounterEntryView item={COUNTER_TSU} /> : <Missing />}
              {NUMBER_TENS ? <CounterEntryView item={NUMBER_TENS} /> : <Missing />}
            </div>
          </Slot>
        </Sub>

        <Sub title="Grammar (particles)">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("particle")} />
          </Slot>
          {/* The verb-types concept follows the particle intro — it's the next
              idea the grammar track leans on before any pattern conjugates. */}
          <Slot tag="Concept — verb types">
            <GrammarConceptEntryView entry={CONCEPT} />
          </Slot>
          <Slot tag="Content — library & lesson">
            {grammar ? <GrammarEntryView item={grammar} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Keigo">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("keigo")} />
          </Slot>
          <Slot tag="Content — library & lesson">
            {keigo ? <KeigoEntryView item={keigo} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Okurigana">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("okurigana")} />
          </Slot>
        </Sub>

        <Sub title="Rendaku">
          <Slot tag="Term — intro & library">
            <TermEntryView entry={termEntry("rendaku")} />
          </Slot>
        </Sub>

        <Sub title="Verb pairs (transitivity)">
          <Slot tag="Intro — non-term">
            <div className={`${glassSurface} p-6`}>
              <GlassSheen />
              <PhaseIntroView intro={TRANSITIVITY_INTRO} />
            </div>
          </Slot>
          <Slot tag="Content — library & lesson">
            {verbPair ? <VerbPairEntryView item={verbPair} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Sentences">
          <Slot tag="Content — library & lesson">
            {sentenceItems()[0] ? <SentenceEntryView item={sentenceItems()[0]!} /> : <Missing />}
          </Slot>
        </Sub>

        <Sub title="Terms only — reference, never introduced">
          {/* Words a learner comes across (JLPT levels, furigana, romaji) but
              that no lesson introduces as a step. Their library page still exists
              for when someone looks them up. */}
          <Slot tag="Library only">
            <TermIntros ids={["romaji", "furigana", "jlpt"]} />
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
