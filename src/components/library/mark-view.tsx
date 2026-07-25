"use client";

import type { ReactNode } from "react";

// A MARK'S PAGE — and it is deliberately the least designed page in the Library.
//
// WHAT THIS COMPONENT IS ALLOWED TO DO
// ====================================
// Almost nothing. The owner is choosing per-kind entry-page layouts right now
// and has not decided, so this arranges EXISTING pieces in the plainest honest
// order and invents no chrome: a Card per section with a Lbl on it, which is what
// every other reference surface in this app already looks like. If a mark page
// ends up wanting a layout of its own, it should get one from that decision and
// not from this file having quietly made one first.
//
// EVERY SENTENCE HERE COMES FROM THE LESSON
// =========================================
// `IntroBody` is the component the teach walk renders a phase intro's paragraphs
// with, over the very PhaseIntro objects the walk uses. `ConversionCard` is the
// card the dakuten phase teaches with, over the very DakutenRow objects it
// teaches. Nothing is retyped, so nothing can drift: change the copy in
// src/data/phase-intros.ts and the lesson and this page both change, because
// there is one copy of it.
//
// That is the whole point of the shelf. A learner who was told in a lesson that
// ゛ voices the consonant and then looks up ゛ must not be told something subtly
// different — two descriptions of one rule diverge, and the divergence is
// invisible until the day they contradict each other.
//
// WHY BOTH SCRIPTS, ALWAYS
// ========================
// Each rule is taught twice, once per script, and the Library entry is one page
// for the rule rather than two. The naive fix is to show the hiragana card and
// call the katakana one redundant — which is right for combos, nearly right for
// dakuten, and WRONG for long vowels, where the two scripts genuinely do
// different things (a doubled vowel kana vs one ー). A page that showed only the
// hiragana half of that would teach half a rule. So both, labelled, every time,
// and the near-duplicate cases cost a reader one short scroll.

import { Callout } from "@/components/lesson/callout";
import { ConversionCard } from "@/components/lesson/conversion-card";
import {
  IntroBody,
  IntroExamples,
  PunctuationTable,
} from "@/components/lesson/phase-intro-view";
import { Card, Lbl } from "@/components/ui";
import {
  TIER_EXAMPLES,
  type SentenceOrderingTierId,
} from "@/components/session/sentence-ordering-teach-walk";
import { bodyFor, scriptLabel, type Mark } from "@/data/marks";
import { SENTENCE_ORDERING_GUIDES } from "@/data/sentence-ordering-guides";

type SentencePart =
  | "topic"
  | "core"
  | "ending"
  | "context"
  | "target"
  | "action"
  | "condition"
  | "resultTopic";

const DEFAULT_SENTENCE_PARTS: readonly SentencePart[] = ["topic", "core", "ending"];
const REQUEST_SENTENCE_PARTS: readonly SentencePart[] = ["context", "target", "action", "ending"];
const CONDITIONAL_SENTENCE_PARTS: readonly SentencePart[] = [
  "condition",
  "resultTopic",
  "core",
  "ending",
];

const PART_COLOR: Record<SentencePart, string> = {
  topic: "sentence-part-topic",
  core: "sentence-part-core",
  ending: "sentence-part-ending",
  context: "sentence-part-topic",
  target: "sentence-part-core",
  action: "sentence-part-action",
  condition: "sentence-part-topic",
  resultTopic: "sentence-part-action",
};

const SENTENCE_PART_LABELS: Record<
  SentenceOrderingTierId,
  Partial<Record<SentencePart, string>>
> = {
  simple: { topic: "Topic", core: "Object/detail", ending: "Final predicate" },
  conditional: {
    condition: "If part",
    resultTopic: "Who the result is about",
    core: "Other result information",
    ending: "What happens",
  },
  causal: { topic: "Who the result is about", core: "Reason", ending: "What happened" },
  obligation: { topic: "Who and when", core: "Required action", ending: "Must / have to" },
  sequential: { topic: "Who", core: "Where or what", ending: "Action + added meaning" },
  desire: { topic: "Who or what", core: "Action", ending: "Want / easy / hard" },
  giving: { topic: "Whose side", core: "Who does what for whom", ending: "Giving / receiving" },
  reported: { topic: "Who, what, or when", core: "Basic statement", ending: "Speaker's view" },
  contrast: { topic: "Who the result is about", core: "First situation", ending: "What happened" },
  request: {
    context: "Time or place",
    target: "What the action affects",
    action: "Action",
    ending: "Request / suggestion",
  },
};

interface SentenceRowPart {
  part: SentencePart;
  text: string;
}

type SentenceExampleParts = Partial<Record<SentencePart, string>>;

interface SentenceLibraryExample {
  englishNatural: string;
  englishOrdered: string;
  japanese: string;
  partsNaturalEn: SentenceExampleParts;
  partsOrderedEn: SentenceExampleParts;
  partsJp: SentenceExampleParts;
}

const SENTENCE_LIBRARY_EXAMPLES: Partial<Record<string, readonly SentenceLibraryExample[]>> = {
  "sentence-rule-simple": [
    {
      englishNatural: "Saku went to the store.",
      englishOrdered: "As for Saku, to the store, she went.",
      japanese: "サクは店に行った。",
      partsNaturalEn: { topic: "Saku", core: "to the store", ending: "went" },
      partsOrderedEn: { topic: "As for Saku", core: "to the store", ending: "went" },
      partsJp: { topic: "サクは", core: "店に", ending: "行った" },
    },
    {
      englishNatural: "Saku played with the red ball.",
      englishOrdered: "As for Saku, with the red ball, she played.",
      japanese: "サクは赤いボールで遊んだ。",
      partsNaturalEn: { topic: "Saku", core: "with the red ball", ending: "played" },
      partsOrderedEn: { topic: "As for Saku", core: "with the red ball", ending: "played" },
      partsJp: { topic: "サクは", core: "赤いボールで", ending: "遊んだ" },
    },
  ],
  "sentence-rule-conditional": [
    {
      englishNatural: "I will stay home if it rains.",
      englishOrdered: "If it rains, as for me, at home, I stay.",
      japanese: "雨が降ったら、私は家にいる。",
      partsNaturalEn: { topic: "I", core: "home", ending: "stay" },
      partsOrderedEn: { topic: "as for me", core: "at home", ending: "stay" },
      partsJp: { topic: "私は", core: "家に", ending: "いる" },
    },
    {
      englishNatural: "I will go if I have time.",
      englishOrdered: "If I have time, as for me, I go.",
      japanese: "時間があれば、私は行く。",
      partsNaturalEn: { topic: "I", core: "if I have time", ending: "go" },
      partsOrderedEn: { topic: "as for me", core: "If I have time", ending: "go" },
      partsJp: { topic: "私は", core: "時間があれば", ending: "行く" },
    },
  ],
  "sentence-rule-causal": [
    {
      englishNatural: "I do not run because it is raining.",
      englishOrdered: "Because it is raining, as for me, I do not run.",
      japanese: "雨だから、私は走らない。",
      partsNaturalEn: { topic: "I", core: "because it is raining", ending: "do not run" },
      partsOrderedEn: { topic: "as for me", core: "Because it is raining", ending: "do not run" },
      partsJp: { topic: "私は", core: "雨だから", ending: "走らない" },
    },
    {
      englishNatural: "Saku sleeps early because she is tired.",
      englishOrdered: "Because she is tired, as for Saku, she sleeps early.",
      japanese: "疲れたので、サクは早く寝る。",
      partsNaturalEn: { topic: "Saku", core: "because she is tired", ending: "sleeps" },
      partsOrderedEn: { topic: "as for Saku", core: "Because she is tired", ending: "sleeps" },
      partsJp: { topic: "サクは", core: "疲れたので", ending: "寝る" },
    },
  ],
  "sentence-rule-obligation": [
    {
      englishNatural: "I must wake up early tomorrow.",
      englishOrdered: "Tomorrow, as for me, wake up early, must.",
      japanese: "明日、私は早く起きなければならない。",
      partsNaturalEn: { topic: "I", core: "wake up early", ending: "must" },
      partsOrderedEn: { topic: "as for me", core: "wake up early", ending: "must" },
      partsJp: { topic: "私は", core: "早く起き", ending: "なければならない" },
    },
    {
      englishNatural: "Saku has to finish her homework.",
      englishOrdered: "As for Saku, her homework, finish, has to.",
      japanese: "サクは宿題を終えなければいけない。",
      partsNaturalEn: { topic: "Saku", core: "finish her homework", ending: "has to" },
      partsOrderedEn: { topic: "As for Saku", core: "her homework, finish", ending: "has to" },
      partsJp: { topic: "サクは", core: "宿題を終え", ending: "なければいけない" },
    },
  ],
  "sentence-rule-sequential": [
    {
      englishNatural: "After doing homework, I sleep.",
      englishOrdered: "After doing homework, as for me, I sleep.",
      japanese: "宿題をしてから、私は寝る。",
      partsNaturalEn: { topic: "I", core: "After doing homework", ending: "sleep" },
      partsOrderedEn: { topic: "as for me", core: "After doing homework", ending: "sleep" },
      partsJp: { topic: "私は", core: "宿題をしてから", ending: "寝る" },
    },
    {
      englishNatural: "Saku is studying at the library.",
      englishOrdered: "At the library, as for Saku, she is studying.",
      japanese: "図書館で、サクは勉強している。",
      partsNaturalEn: { topic: "Saku", core: "at the library", ending: "is studying" },
      partsOrderedEn: { topic: "as for Saku", core: "At the library", ending: "is studying" },
      partsJp: { topic: "サクは", core: "図書館で", ending: "している" },
    },
  ],
  "sentence-rule-desire": [
    {
      englishNatural: "I want to go to Japan.",
      englishOrdered: "As for me, to Japan, want to go.",
      japanese: "私は日本へ行きたい。",
      partsNaturalEn: { topic: "I", core: "to Japan", ending: "want to go" },
      partsOrderedEn: { topic: "As for me", core: "to Japan", ending: "want to go" },
      partsJp: { topic: "私は", core: "日本へ", ending: "行きたい" },
    },
    {
      englishNatural: "This book is easy to read.",
      englishOrdered: "As for this book, easy to read, it is.",
      japanese: "この本は読みやすい。",
      partsNaturalEn: { topic: "This book", core: "easy to read", ending: "is" },
      partsOrderedEn: { topic: "As for this book", core: "easy to read", ending: "is" },
      partsJp: { topic: "この本は", core: "読み", ending: "やすい" },
    },
  ],
  "sentence-rule-giving": [
    {
      englishNatural: "I lend a book to my friend.",
      englishOrdered: "As for me, to my friend, a book, I lend.",
      japanese: "私は友達に本を貸してあげる。",
      partsNaturalEn: { topic: "I", core: "a book to my friend", ending: "lend" },
      partsOrderedEn: { topic: "As for me", core: "to my friend, a book", ending: "lend" },
      partsJp: { topic: "私は", core: "友達に本を", ending: "貸してあげる" },
    },
    {
      englishNatural: "Saku made dinner for me.",
      englishOrdered: "As for Saku, for me, dinner, she made.",
      japanese: "サクは私に夕飯を作ってくれた。",
      partsNaturalEn: { topic: "Saku", core: "dinner for me", ending: "made" },
      partsOrderedEn: { topic: "As for Saku", core: "for me, dinner", ending: "made" },
      partsJp: { topic: "サクは", core: "私に夕飯を", ending: "作ってくれた" },
    },
  ],
  "sentence-rule-reported": [
    {
      englishNatural: "I think he will come.",
      englishOrdered: "As for me, he will come, I think.",
      japanese: "私は彼が来ると思う。",
      partsNaturalEn: { topic: "I", core: "he will come", ending: "think" },
      partsOrderedEn: { topic: "As for me", core: "he will come", ending: "think" },
      partsJp: { topic: "私は", core: "彼が来る", ending: "と思う" },
    },
    {
      englishNatural: "It might rain tomorrow.",
      englishOrdered: "Tomorrow, rain, it might.",
      japanese: "明日は雨かもしれない。",
      partsNaturalEn: { topic: "It", core: "rain tomorrow", ending: "might" },
      partsOrderedEn: { topic: "it", core: "Tomorrow, rain", ending: "might" },
      partsJp: { topic: "明日は", core: "雨", ending: "かもしれない" },
    },
  ],
  "sentence-rule-contrast": [
    {
      englishNatural: "Even though it is raining, he went out.",
      englishOrdered: "Even though it is raining, as for him, he went out.",
      japanese: "雨なのに、彼は出かけた。",
      partsNaturalEn: { topic: "he", core: "Even though it is raining", ending: "went out" },
      partsOrderedEn: { topic: "as for him", core: "Even though it is raining", ending: "went out" },
      partsJp: { topic: "彼は", core: "雨なのに", ending: "出かけた" },
    },
    {
      englishNatural: "I left without eating breakfast.",
      englishOrdered: "Without eating breakfast, as for me, I left.",
      japanese: "朝ごはんを食べないで、私は出た。",
      partsNaturalEn: { topic: "I", core: "without eating breakfast", ending: "left" },
      partsOrderedEn: { topic: "as for me", core: "Without eating breakfast", ending: "left" },
      partsJp: { topic: "私は", core: "食べないで", ending: "出た" },
    },
  ],
  "sentence-rule-request": [
    {
      englishNatural: "Please read this sentence.",
      englishOrdered: "This sentence, please read.",
      japanese: "この文を読んでください。",
      partsNaturalEn: { topic: "this sentence", core: "read", ending: "Please" },
      partsOrderedEn: { topic: "This sentence", core: "read", ending: "please" },
      partsJp: { topic: "この文を", core: "読んで", ending: "ください" },
    },
    {
      englishNatural: "Let us start now.",
      englishOrdered: "Now, let us start.",
      japanese: "今、始めましょう。",
      partsNaturalEn: { topic: "now", core: "start", ending: "Let us" },
      partsOrderedEn: { topic: "Now", core: "start", ending: "let us" },
      partsJp: { topic: "今", core: "始め", ending: "ましょう" },
    },
  ],
};

interface PositionedSentencePart extends SentenceRowPart {
  start: number;
  end: number;
}

function findChunkStart(sentence: string, chunk: string): number {
  const sentenceLower = sentence.toLowerCase();
  const chunkLower = chunk.toLowerCase();
  const needsStartBoundary = /^[a-z0-9]/i.test(chunk);
  const needsEndBoundary = /[a-z0-9]$/i.test(chunk);
  let from = 0;
  while (from <= sentenceLower.length - chunkLower.length) {
    const candidate = sentenceLower.indexOf(chunkLower, from);
    if (candidate < 0) break;
    const before = sentence[candidate - 1] ?? "";
    const after = sentence[candidate + chunk.length] ?? "";
    const startsCleanly = !needsStartBoundary || !/[a-z0-9]/i.test(before);
    const endsCleanly = !needsEndBoundary || !/[a-z0-9]/i.test(after);
    if (startsCleanly && endsCleanly) return candidate;
    from = candidate + 1;
  }

  if (chunkLower.startsWith("as for ")) {
    const withoutAsFor = chunk.replace(/^as for\s+/i, "").trim();
    const fromBare = sentence.indexOf(withoutAsFor);
    if (fromBare >= 0) return fromBare;
    const fromBareCi = sentenceLower.indexOf(withoutAsFor.toLowerCase());
    if (fromBareCi >= 0) return fromBareCi;
  }

  return -1;
}

function spansForSentence(
  sentence: string,
  parts: SentenceExampleParts,
  partOrder: readonly SentencePart[],
): PositionedSentencePart[] {
  const positioned = partOrder.map((part) => {
    const text = parts[part]?.trim() ?? "";
    if (!text) return null;
    const start = findChunkStart(sentence, text);
    if (start < 0) return null;
    return { part, text, start, end: start + text.length } satisfies PositionedSentencePart;
  }).filter((v): v is PositionedSentencePart => v != null);

  positioned.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.text.length - a.text.length;
  });

  const placed: PositionedSentencePart[] = [];
  for (const candidate of positioned) {
    const overlaps = placed.some(
      (p) => !(candidate.end <= p.start || candidate.start >= p.end),
    );
    if (!overlaps) placed.push(candidate);
  }

  placed.sort((a, b) => a.start - b.start);
  return placed;
}

function colorizeSentence(sentence: string, spans: readonly PositionedSentencePart[]) {
  if (spans.length === 0) return sentence;
  const out: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, i) => {
    if (span.start > cursor) out.push(sentence.slice(cursor, span.start));
    out.push(
      <span
        key={`${span.part}-${span.start}-${i}`}
        className={`font-medium ${PART_COLOR[span.part]}`}
      >
        {sentence.slice(span.start, span.end)}
      </span>,
    );
    cursor = span.end;
  });
  if (cursor < sentence.length) out.push(sentence.slice(cursor));
  return out;
}

function SentencePartBoxes({
  sentence,
  spans,
  labels,
  lang,
}: {
  sentence: string;
  spans: readonly PositionedSentencePart[];
  labels: Partial<Record<SentencePart, string>>;
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
          <span
            lang={lang}
            className={`text-[13px] font-medium ${PART_COLOR[span.part]}`}
          >
            {sentence.slice(span.start, span.end)}
          </span>
        </div>
      ))}
    </div>
  );
}

function hasUncoveredJapanese(sentence: string, spans: readonly PositionedSentencePart[]): boolean {
  const covered = new Array<boolean>(sentence.length).fill(false);
  for (const span of spans) {
    for (let i = span.start; i < span.end; i += 1) covered[i] = true;
  }

  for (let i = 0; i < sentence.length; i += 1) {
    if (covered[i]) continue;
    const ch = sentence[i];
    // Ignore punctuation and spacing; only require kana/kanji coverage.
    if (/\s|[、。・「」『』（）()]/.test(ch)) continue;
    if (/\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Han}/u.test(ch)) return true;
  }
  return false;
}

function SentenceRuleExamples({ markId }: { markId: string }) {
  const tierId = markId.replace("sentence-rule-", "") as SentenceOrderingTierId;
  const labels = SENTENCE_PART_LABELS[tierId];
  const partOrder =
    tierId === "request"
      ? REQUEST_SENTENCE_PARTS
      : tierId === "conditional"
        ? CONDITIONAL_SENTENCE_PARTS
        : DEFAULT_SENTENCE_PARTS;
  const shared = TIER_EXAMPLES[tierId]?.map((example) => ({
    englishNatural: example.en,
    // This line is a structural gloss, not an English translation. Commas made
    // it look like broken prose ("As for Saku, to the store, she went"), while
    // arrows make the intended chunk sequence explicit on every sentence page.
    englishOrdered: example.enOrdered.replaceAll(", ", " → "),
    japanese: example.jp,
    partsNaturalEn: Object.fromEntries(
      partOrder.map((part) => [part, example[part]?.en ?? ""]),
    ) as SentenceExampleParts,
    partsOrderedEn: Object.fromEntries(
      partOrder.map((part) => [
        part,
        (example[part]?.enOrdered ?? example[part]?.en ?? "").replaceAll(", ", " → "),
      ]),
    ) as SentenceExampleParts,
    partsJp: Object.fromEntries(
      partOrder.map((part) => [part, example[part]?.jp ?? ""]),
    ) as SentenceExampleParts,
  }));
  // The shared lesson corpus is authoritative. The old local table remains only
  // as a defensive fallback for an unknown legacy id while this branch migrates.
  const examples = shared?.length ? shared : SENTENCE_LIBRARY_EXAMPLES[markId];
  if (!examples?.length) return null;

  return (
    <div className="space-y-2.5">
      {examples.map((ex, i) => {
        const natural = spansForSentence(ex.englishNatural, ex.partsNaturalEn, partOrder);
        const ordered = spansForSentence(ex.englishOrdered, ex.partsOrderedEn, partOrder);
        const jp = spansForSentence(ex.japanese, ex.partsJp, partOrder);
        if (process.env.NODE_ENV !== "production" && hasUncoveredJapanese(ex.japanese, jp)) {
          console.warn("Sentence example has uncovered Japanese chunk(s)", {
            markId,
            exampleIndex: i,
            sentence: ex.japanese,
            partsJp: ex.partsJp,
          });
        }
        return (
          <div key={`${markId}-${i}`} className="rounded-lg border border-border/70 bg-panel/40 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Example {i + 1}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-text">
              Natural English
            </p>
            <p className="text-[14px] text-text">{colorizeSentence(ex.englishNatural, natural)}</p>
            <SentencePartBoxes sentence={ex.englishNatural} spans={natural} labels={labels} />
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-text">
              Japanese chunk order
            </p>
            <p className="text-[13px] text-text">
              {colorizeSentence(ex.englishOrdered, ordered)}
            </p>
            <SentencePartBoxes sentence={ex.englishOrdered} spans={ordered} labels={labels} />
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-text">
              Japanese
            </p>
            <p lang="ja" className="mt-1 text-[20px] font-light text-text">
              {colorizeSentence(ex.japanese, jp)}
            </p>
            <SentencePartBoxes
              sentence={ex.japanese}
              spans={jp}
              labels={labels}
              lang="ja"
            />
          </div>
        );
      })}
    </div>
  );
}

export function MarkView({ mark }: { mark: Mark }) {
  const sentenceTierId = mark.id.replace("sentence-rule-", "") as SentenceOrderingTierId;

  return (
    <>
      {mark.intros.map((intro) => {
        // The paragraphs about THIS mark. For four of the five marks that is all
        // of them; for ゛ and ゜, which share one lesson card, it is the half that
        // is about the one you opened. See `bodyFor`.
        const body = bodyFor(intro, mark.glyph).map((p) =>
          // Drop the paragraph's mark plate on the Library page. The entry header
          // already shows this rule's glyph at 76px directly above, and `bodyFor`
          // only ever keeps paragraphs whose plate IS that glyph (the ゜ half of
          // the dakuten card is filtered out on the ゛ page and vice versa), so
          // every plate that would render here is the header glyph a second time,
          // the same character twice with nothing between them. The plate still
          // earns its place in the teach walk, whose hero is a sentence, not a
          // glyph — there is no header there for it to repeat. Library-only.
          p.mark === mark.glyph ? { ...p, mark: undefined } : p,
        );
        if (body.length === 0) return null;
        const label = scriptLabel(intro.setId);
        return (
          // Prose in one Card, its worked examples in a SEPARATE Card beside it,
          // so the examples read as their own box in the row rather than a panel
          // sunk inside the prose box. A container query drives the split (this
          // column is far narrower than the viewport once the Library sidebar is
          // there, so a viewport breakpoint left it one column with room to
          // spare); it stacks below when the column is genuinely narrow. The
          // threshold is @xl (36rem) to match the walk and to clear the 148px
          // sidebar at ordinary laptop widths. `items-stretch` makes the two
          // Cards share the row's height, so the shorter examples box lines up
          // with the prose rather than floating. The prose passes no `measure`
          // cap: it sits in a sized flex column, and a 64ch cap on top of that
          // was the early word-wrap these pages had.
          <div key={intro.id} className="@container">
            {intro.punctuation?.length ? (
              // Punctuation is a catalogue, so it gets a table Card of the marks
              // with the closing sentence in a Card beneath, rather than the
              // prose-plus-examples split the other marks use.
              <div className="space-y-3.5">
                <Card>
                  {label ? <Lbl>{label}</Lbl> : null}
                  <PunctuationTable rows={intro.punctuation} />
                </Card>
                <Card>
                  <IntroBody body={body} measure="" />
                </Card>
              </div>
            ) : (
              <div className={mark.shelf === "sentence" ? "space-y-0" : "space-y-3.5"}>
                <Card className={mark.shelf === "sentence" ? "!mb-6" : undefined}>
                  {label ? <Lbl>{label}</Lbl> : null}
                  <IntroBody body={body} measure="" />
                  {mark.shelf === "sentence" ? (
                    <p className="mt-4 text-[12px] font-semibold text-accent">
                      {SENTENCE_ORDERING_GUIDES[sentenceTierId].hook}
                    </p>
                  ) : null}
                </Card>
                {mark.shelf === "sentence" ? (
                  <SentenceRuleExamples markId={mark.id} />
                ) : intro.examples?.length ? (
                    <Card>
                      <IntroExamples examples={intro.examples} bare />
                    </Card>
                ) : null}
              </div>
            )}
          </div>
        );
      })}

      {/* The conversion tables, for the two marks that have any. One card each,
          exactly as the lesson steps through them — ConversionCard already
          carries its own heading ("dakuten · one mark, five sounds"), its own
          call-outs and its own speakers, so there is nothing for this file to add
          around it and it does not get any. */}
      {mark.rows.map((row) => (
        <Card key={row.id}>
          <ConversionCard row={row} />
        </Card>
      ))}

      {/* The mark's own aside, in the shared call-out — the same treatment every
          "the rule you just read has a hole in it" remark gets, so this reads as
          an aside about the rule rather than as more of the rule. Only small
          kana has one (ぁぃぅぇぉ); see SMALL_VOWEL_NOTE for why it is a line
          here and not a sixth entry on the shelf. */}
      {mark.note ? (
        <Card>
          <Lbl>Also worth knowing</Lbl>
          <Callout label="The other small kana.">{mark.note}</Callout>
        </Card>
      ) : null}
    </>
  );
}
