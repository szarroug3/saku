"use client";

// SENTENCE-RULE teach walk — the in-lesson twin of the Library's sentence-rule
// reference page (sentence-entry-view.tsx, backed by MarkView). SAK-113 moved
// this out of components/session (where it sat as a hand-rolled sibling to
// TeachWalk, never touching ContentItem/buildItem/the Library entry-view
// family) and into components/library, alongside SentenceEntryView,
// TermEntryView and the other entry-view components — the same family
// TeachWalk already renders TermEntryView from directly for grammar-concept/
// term steps, without going through TeachItemView (see teach-walk.tsx).
//
// WHY NOT ROUTE THROUGH TeachItemView / LessonStep LIKE THE OTHER 7 KINDS
// =========================================================================
// TeachItemView dispatches on LessonItem.kind (LessonKind), and LessonStep
// ("intro" | "term" | "conversion" | "item") is built by resolveLessonSteps
// from a teach set's FACTS (src/lib/lesson-steps.ts / lesson-items.ts). A
// sentence-ordering round has no facts at all: it is its own session mode
// (session.snapshot.mode === "assembly", see src/app/session/page.tsx),
// stepping through a single tier's rule by tierId instead of walking a fact
// list. Folding it into LessonStep/resolveLessonSteps would mean inventing
// fake facts for a mode that structurally has none, and reworking the
// assembly round's session plumbing — a much larger, riskier change than the
// content-architecture problem this ticket is about. So this stays a second
// entry point TeachWalk's session-page caller renders directly, exactly the
// way `term` steps render TermEntryView directly — same precedent, same
// reason (a step kind that isn't a glyph/LessonKind item still deserves the
// shared library component family, not a hand-rolled tree).
//
// WHAT DID MOVE
// =============
// TIER_EXAMPLES was already the shared corpus: mark-view.tsx has imported it
// from this file (formerly components/session/sentence-ordering-teach-walk.tsx)
// as its authoritative sentence data for years, and the intro card already
// reads the same SENTENCE_ORDERING_GUIDES this file always did (shared with
// the Library and the assembly quiz — see data/sentence-ordering-guides.ts).
// The only things that were genuinely private and duplicated-in-spirit with
// mark-view.tsx were the local rendering helpers below (findChunkStart,
// positionedStepParts, focusedSentence, FocusedPartBoxes) — kept AS IS rather
// than force-merged with mark-view.tsx's own near-identical versions, because
// the two pages render a genuinely different interaction: this walk highlights
// ONE active chunk role per step and grays the rest, while MarkView's
// SentenceRuleExamples colors every role at once on a single static page.
// Unifying those two rendering strategies is a real design decision the owner
// hasn't made (see mark-view.tsx's own "least designed page" header), so it is
// left alone here rather than guessed at.
//
// LEGACY_TIER_GUIDE, which used to live in this file, was dropped: it was
// fully superseded by SENTENCE_ORDERING_GUIDES (sentenceOrderingIntro already
// only ever read the shared guide, never LEGACY_TIER_GUIDE) and had no
// remaining reference anywhere in the app.

import type { ReactNode } from "react";

import { PhaseIntroView } from "@/components/lesson/phase-intro-view";
import { FlatSurfaceProvider } from "@/components/ui";
import type { PhaseIntro } from "@/data/phase-intros";
import {
  CHUNK_ROLE_LABELS,
  SENTENCE_ORDERING_CHUNK_ROLES,
  SENTENCE_ORDERING_GUIDES,
  sentenceOrderingIntro as sharedSentenceOrderingIntro,
  type ChunkRoleKey,
  type SentenceOrderingWorkedExample,
} from "@/data/sentence-ordering-guides";

export type SentenceOrderingTierId =
  | "simple"
  | "conditional"
  | "causal"
  | "obligation"
  | "sequential"
  | "desire"
  | "giving"
  | "reported"
  | "contrast"
  | "request";

// Chunk roles and their plain-English labels live in
// src/data/sentence-ordering-guides.ts (ChunkRoleKey, SENTENCE_ORDERING_CHUNK_ROLES,
// CHUNK_ROLE_LABELS), shared with the assembly quiz's wrong-answer feedback
// (src/lib/assembly-check.ts), which names a misplaced chunk with these same labels.
type StepKey = ChunkRoleKey;

export interface TierChunk {
  en: string;
  enOrdered?: string;
  jp: string;
}

export interface TierExample {
  en: string;
  enOrdered: string;
  jp: string;
  ending: TierChunk;
  core: TierChunk;
  topic: TierChunk;
  marker: TierChunk;
  action?: TierChunk;
  target?: TierChunk;
  context?: TierChunk;
  condition?: TierChunk;
  resultTopic?: TierChunk;
}

export const TIER_EXAMPLES: Record<SentenceOrderingTierId, readonly TierExample[]> = {
  simple: [
    {
      en: "I say that.",
      enOrdered: "As for me → that → say.",
      jp: "私はそれを言う。",
      ending: { en: "say", jp: "言う" },
      core: { en: "that", jp: "それを" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "as for", jp: "は" },
    },
    {
      en: "What do I say?",
      enOrdered: "As for me → what → say?",
      jp: "私は何を言う？",
      ending: { en: "say", jp: "言う" },
      core: { en: "what", jp: "何を" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "what is affected", jp: "を" },
    },
    {
      en: "I eat this.",
      enOrdered: "As for me → this → eat.",
      jp: "私はこれを食べる。",
      ending: { en: "eat", jp: "食べる" },
      core: { en: "this", jp: "これを" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "what is affected", jp: "を" },
    },
  ],
  conditional: [
    {
      en: "If you eat that, I will say so.",
      enOrdered: "If you eat that → as for me → so → will say.",
      jp: "それを食べたら、私はそう言う。",
      ending: { en: "will say", jp: "言う" },
      core: { en: "so", jp: "そう" },
      topic: {
        en: "If you eat that, I",
        enOrdered: "If you eat that → as for me",
        jp: "それを食べたら、私は",
      },
      marker: { en: "if", jp: "たら" },
      condition: { en: "If you eat that", jp: "それを食べたら" },
      resultTopic: { en: "I", enOrdered: "as for me", jp: "私は" },
    },
    {
      en: "If I say so, the teacher will understand this.",
      enOrdered: "If I say so → as for the teacher → this → will understand.",
      jp: "私がそう言えば、先生はこれがわかる。",
      ending: { en: "will understand", jp: "わかる" },
      core: { en: "this", jp: "これが" },
      topic: {
        en: "If I say so, the teacher",
        enOrdered: "If I say so → as for the teacher",
        jp: "私がそう言えば、先生は",
      },
      marker: { en: "if", jp: "ば" },
      condition: { en: "If I say so", jp: "私がそう言えば" },
      resultTopic: { en: "the teacher", enOrdered: "as for the teacher", jp: "先生は" },
    },
    {
      en: "If this is true, I will say so.",
      enOrdered: "If this is true → as for me → so → will say.",
      jp: "これが本当なら、私はそう言う。",
      ending: { en: "will say", jp: "言う" },
      core: { en: "so", jp: "そう" },
      topic: {
        en: "If this is true, I",
        enOrdered: "If this is true → as for me",
        jp: "これが本当なら、私は",
      },
      marker: { en: "if", jp: "なら" },
      condition: { en: "If this is true", jp: "これが本当なら" },
      resultTopic: { en: "I", enOrdered: "as for me", jp: "私は" },
    },
  ],
  causal: [
    {
      en: "Because it's delicious, I eat it.",
      enOrdered: "Because it's delicious → as for me → eat.",
      jp: "おいしいから、私は食べる。",
      ending: { en: "eat", jp: "食べる" },
      core: { en: "Because it's delicious", jp: "おいしいから" },
      topic: { en: "I", enOrdered: "as for me", jp: "私は" },
      marker: { en: "because", jp: "から" },
    },
    {
      en: "Because I don't understand, I ask.",
      enOrdered: "Because I don't understand → as for me → ask.",
      jp: "わからないので、私は聞く。",
      ending: { en: "ask", jp: "聞く" },
      core: { en: "Because I don't understand", jp: "わからないので" },
      topic: { en: "I", enOrdered: "as for me", jp: "私は" },
      marker: { en: "because", jp: "ので" },
    },
    {
      en: "Because that's wrong, I say so.",
      enOrdered: "Because that's wrong → as for me → say so.",
      jp: "それは違うから、私はそう言う。",
      ending: { en: "say so", jp: "そう言う" },
      core: { en: "Because that's wrong", jp: "それは違うから" },
      topic: { en: "I", enOrdered: "as for me", jp: "私は" },
      marker: { en: "because", jp: "から" },
    },
  ],
  obligation: [
    {
      en: "I must eat this.",
      enOrdered: "As for me → eat this → must.",
      jp: "私はこれを食べなければならない。",
      ending: { en: "must", jp: "なければならない" },
      core: { en: "eat this", jp: "これを食べ" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "must", jp: "なければならない" },
    },
    {
      en: "I must say that.",
      enOrdered: "As for me → say that → must.",
      jp: "私はそれを言わなければならない。",
      ending: { en: "must", jp: "なければならない" },
      core: { en: "say that", jp: "それを言わ" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "must", jp: "なければならない" },
    },
    {
      en: "I have to eat this.",
      enOrdered: "As for this → eat → have to.",
      jp: "これは食べないといけない。",
      ending: { en: "have to", jp: "ないといけない" },
      core: { en: "eat", jp: "食べ" },
      topic: { en: "this", enOrdered: "As for this", jp: "これは" },
      marker: { en: "have to", jp: "ないといけない" },
    },
  ],
  sequential: [
    {
      en: "I accidentally said that.",
      enOrdered: "As for me → that → accidentally said.",
      jp: "私はそれを言ってしまった。",
      ending: { en: "accidentally said", jp: "言ってしまった" },
      core: { en: "that", jp: "それを" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "accidentally", jp: "てしまった" },
    },
    {
      en: "I try eating this.",
      enOrdered: "As for me → this → try eating.",
      jp: "私はこれを食べてみる。",
      ending: { en: "try eating", jp: "食べてみる" },
      core: { en: "this", jp: "これを" },
      topic: { en: "I", enOrdered: "as for me", jp: "私は" },
      marker: { en: "try", jp: "てみる" },
    },
    {
      en: "I have that.",
      enOrdered: "As for me → that → have.",
      jp: "私はそれを持っている。",
      ending: { en: "have", jp: "持っている" },
      core: { en: "that", jp: "それを" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "resulting state", jp: "ている" },
    },
  ],
  desire: [
    {
      en: "I want to eat this.",
      enOrdered: "As for me → eat this → want to.",
      jp: "私はこれを食べたい。",
      ending: { en: "want to", jp: "たい" },
      core: { en: "eat this", jp: "これを食べ" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "want to", jp: "たい" },
    },
    {
      en: "This is easy to eat.",
      enOrdered: "As for this → eat → easy to.",
      jp: "これは食べやすい。",
      ending: { en: "easy to", jp: "やすい" },
      core: { en: "eat", jp: "食べ" },
      topic: { en: "This is", enOrdered: "As for this", jp: "これは" },
      marker: { en: "easy to", jp: "やすい" },
    },
    {
      en: "This is hard to say.",
      enOrdered: "As for this → say → hard to.",
      jp: "これは言いにくい。",
      ending: { en: "hard to", jp: "にくい" },
      core: { en: "say", jp: "言い" },
      topic: { en: "This is", enOrdered: "As for this", jp: "これは" },
      marker: { en: "hard to", jp: "にくい" },
    },
  ],
  giving: [
    {
      en: "I wrote this for the teacher.",
      enOrdered: "As for me → the teacher → this → wrote → as a favor.",
      jp: "私は先生にこれを書いてあげた。",
      ending: { en: "as a favor", jp: "あげた" },
      core: {
        en: "wrote this for the teacher",
        enOrdered: "the teacher → this → wrote",
        jp: "先生にこれを書いて",
      },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "for the teacher", jp: "に" },
    },
    {
      en: "The teacher kindly said that to me.",
      enOrdered: "As for the teacher → me → so → said → for me.",
      jp: "先生は私にそう言ってくれた。",
      ending: { en: "for me", jp: "くれた" },
      core: {
        en: "said that to me",
        enOrdered: "me → so → said",
        jp: "私にそう言って",
      },
      topic: { en: "the teacher", enOrdered: "As for the teacher", jp: "先生は" },
      marker: { en: "for me", jp: "に" },
    },
    {
      en: "I had the teacher say that.",
      enOrdered: "As for me → from the teacher → so → say → received the favor.",
      jp: "私は先生にそう言ってもらった。",
      ending: { en: "had", enOrdered: "received the favor", jp: "もらった" },
      core: {
        en: "the teacher say that",
        enOrdered: "from the teacher → so → say",
        jp: "先生にそう言って",
      },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "from the teacher", jp: "に" },
    },
  ],
  reported: [
    {
      en: "I think so.",
      enOrdered: "As for me → so → think.",
      jp: "私はそう思う。",
      ending: { en: "think", jp: "と思う" },
      core: { en: "so", jp: "そう" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "I think", jp: "と思う" },
    },
    {
      en: "That might be wrong.",
      enOrdered: "As for that → wrong → might be.",
      jp: "それは違うかもしれない。",
      ending: { en: "might be", jp: "かもしれない" },
      core: { en: "wrong", jp: "違う" },
      topic: { en: "That", enOrdered: "As for that", jp: "それは" },
      marker: { en: "might", jp: "かもしれない" },
    },
    {
      en: "This seems to be true.",
      enOrdered: "As for this → true → seems.",
      jp: "これは本当らしい。",
      ending: { en: "seems", jp: "らしい" },
      core: { en: "true", jp: "本当" },
      topic: { en: "This", enOrdered: "As for this", jp: "これは" },
      marker: { en: "seems", jp: "らしい" },
    },
  ],
  contrast: [
    {
      en: "Even though it's delicious, I don't eat it.",
      enOrdered: "Even though it's delicious → as for me → don't eat.",
      jp: "おいしいのに、私は食べない。",
      ending: { en: "don't eat", jp: "食べない" },
      core: { en: "Even though it's delicious", jp: "おいしいのに" },
      topic: { en: "I", enOrdered: "as for me", jp: "私は" },
      marker: { en: "even though", jp: "のに" },
    },
    {
      en: "I left without saying anything.",
      enOrdered: "As for me → without saying anything → left.",
      jp: "私は何も言わないで出た。",
      ending: { en: "left", jp: "出た" },
      core: { en: "without saying anything", jp: "何も言わないで" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "without doing", jp: "ないで" },
    },
    {
      en: "I said it without knowing it.",
      enOrdered: "As for me → without knowing that → said it.",
      jp: "私はそれを知らないで言った。",
      ending: { en: "said it", jp: "言った" },
      core: { en: "without knowing that", jp: "それを知らないで" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "without doing", jp: "ないで" },
    },
  ],
  request: [
    {
      en: "Please eat this.",
      enOrdered: "This → eat → please.",
      jp: "これを食べてください。",
      ending: {
        en: "Please",
        enOrdered: "please",
        jp: "ください",
      },
      core: {
        en: "eat this",
        enOrdered: "This → eat",
        jp: "これを食べて",
      },
      topic: { en: "", jp: "" },
      marker: { en: "please", jp: "ください" },
      action: { en: "eat", jp: "食べて" },
      target: { en: "this", enOrdered: "This", jp: "これを" },
      context: { en: "", jp: "" },
    },
    {
      en: "Please don't say that.",
      enOrdered: "That → don't say → please.",
      jp: "それを言わないでください。",
      ending: {
        en: "Please",
        enOrdered: "please",
        jp: "ください",
      },
      core: { en: "don't say that", enOrdered: "That → don't say", jp: "それを言わないで" },
      topic: { en: "", jp: "" },
      marker: { en: "please", jp: "ください" },
      action: { en: "don't say", jp: "言わないで" },
      target: { en: "that", enOrdered: "That", jp: "それを" },
      context: { en: "", jp: "" },
    },
    {
      en: "Let's eat this.",
      enOrdered: "This → eat → let's.",
      jp: "これを食べましょう。",
      ending: {
        en: "Let's",
        enOrdered: "let's",
        jp: "ましょう",
      },
      core: {
        en: "eat this",
        enOrdered: "This → eat",
        jp: "これを食べ",
      },
      topic: { en: "", jp: "" },
      marker: { en: "let's", jp: "ましょう" },
      action: { en: "eat", jp: "食べ" },
      target: { en: "this", enOrdered: "This", jp: "これを" },
      context: { en: "", jp: "" },
    },
  ],
};

interface LessonDefinition {
  key: StepKey;
  title: string;
  details: readonly string[];
}

const TIER_LESSONS: Record<SentenceOrderingTierId, readonly LessonDefinition[]> = {
  simple: [
    {
      key: "topic",
      title: "Who or what the sentence is about",
      details: ["Start with the topic chunk, often marked by は.", "Keep the particle attached to the word it labels."],
    },
    {
      key: "core",
      title: "Object, destination, or description",
      details: ["Place the information that completes the thought before the final predicate.", "Its particle stays inside this chunk."],
    },
    {
      key: "ending",
      title: "Final predicate",
      details: ["Put the action or statement ending last.", "This is the sentence's final verb or ending."],
    },
  ],
  conditional: [
    {
      key: "condition",
      title: "The “if” part",
      details: ["Keep the complete “if” part together, including たら or ば.", "This part tells you the situation that must be true."],
    },
    {
      key: "resultTopic",
      title: "Who the result is about",
      details: ["Next, place who or what the result is about.", "In English this can come before or after the “if” part."],
    },
    {
      key: "core",
      title: "Other information in the result",
      details: ["Next, place the thing or place involved in the result.", "Keep its small marker attached."],
    },
    {
      key: "ending",
      title: "What happens next",
      details: ["Finish with what happens if the first part is true.", "This is the main result of the sentence."],
    },
  ],
  causal: [
    {
      key: "core",
      title: "Reason",
      details: ["Keep the complete reason together through から or ので.", "The reason comes before what happened because of it."],
    },
    {
      key: "topic",
      title: "Who the result is about",
      details: ["After the reason, place who or what the result is about.", "Keep は attached when it is present."],
    },
    {
      key: "ending",
      title: "What happened",
      details: ["End with what happened because of the reason.", "Read the whole sentence as reason, then result."],
    },
  ],
  obligation: [
    {
      key: "topic",
      title: "Who needs to act, and when",
      details: ["Start with the person who needs to do something and any time information.", "These parts come before the required action."],
    },
    {
      key: "core",
      title: "Required action",
      details: ["Place the action that must be done before the obligation ending.", "The verb stem connects directly to that ending."],
    },
    {
      key: "ending",
      title: "The “must” or “have to” ending",
      details: ["Finish with the form that means “must” or “have to.”", "Forms such as なければならない make the action required."],
    },
  ],
  sequential: [
    {
      key: "core",
      title: "Where or what",
      details: ["Put the place or thing involved before the final action.", "Keep its small marker attached."],
    },
    {
      key: "topic",
      title: "Who does the action",
      details: ["Place the person doing the action before the final action.", "Japanese may leave this person unstated when it is already clear."],
    },
    {
      key: "ending",
      title: "The action and its added meaning",
      details: ["Keep the action and the ending after it together.", "That ending can mean the action is ongoing, attempted, or happened unintentionally."],
    },
  ],
  desire: [
    {
      key: "topic",
      title: "Who or what the sentence is about",
      details: ["Start with the person who wants to act or the thing described as easy or hard.", "Keep its small marker attached."],
    },
    {
      key: "core",
      title: "The action",
      details: ["Place the action immediately before the final ending.", "Things and places connected to the action stay with this part."],
    },
    {
      key: "ending",
      title: "“Want to,” “easy,” or “hard”",
      details: ["Finish with たい, やすい, or にくい.", "The ending tells you whether the action is wanted, easy, or hard."],
    },
  ],
  giving: [
    {
      key: "topic",
      title: "Whose side the sentence follows",
      details: ["Start with the person whose side of the exchange the sentence follows.", "This helps you understand the ending."],
    },
    {
      key: "core",
      title: "Who does what for whom",
      details: ["Keep the people, the thing involved, and the action together.", "The action leads directly into the final ending."],
    },
    {
      key: "ending",
      title: "The giving or receiving ending",
      details: ["Finish with あげる, くれる, or もらう.", "The ending tells you whether help is given, comes toward someone, or is received."],
    },
  ],
  reported: [
    {
      key: "topic",
      title: "Who, what, or when",
      details: ["Start with the speaker, what the sentence is about, or when it happens.", "This information sets up the basic statement."],
    },
    {
      key: "core",
      title: "The basic statement",
      details: ["Keep the main idea together.", "This is the statement being thought about or treated as uncertain."],
    },
    {
      key: "ending",
      title: "What the speaker thinks",
      details: ["Finish with an ending such as と思う, らしい, or かもしれない.", "It adds meanings like “I think,” “apparently,” or “might.”"],
    },
  ],
  contrast: [
    {
      key: "core",
      title: "The first situation",
      details: ["Keep the complete part ending in のに or ないで together.", "It sets up the main thing that happened next."],
    },
    {
      key: "topic",
      title: "Who the result is about",
      details: ["After the first situation, place who or what the result is about.", "This person or thing belongs to the main result."],
    },
    {
      key: "ending",
      title: "What happened",
      details: ["Finish with the main action or result.", "Remember: のに means “even though,” while ないで means “without doing.”"],
    },
  ],
  request: [
    {
      key: "context",
      title: "Time or place context",
      details: ["Put the time or place first when the request includes it.", "Some requests do not need this part."],
    },
    {
      key: "target",
      title: "What the action affects",
      details: ["Place the thing affected by the action before the action itself.", "Some suggestions do not need this part."],
    },
    {
      key: "action",
      title: "The action",
      details: ["Place the action immediately before the final ending.", "This tells you what someone is being asked or invited to do."],
    },
    {
      key: "ending",
      title: "The request or suggestion ending",
      details: ["Finish with ください for a request or ましょう for a suggestion.", "This ending changes the action into a request or an invitation to act together."],
    },
  ],
};

function stepExamples(tierId: SentenceOrderingTierId, key: StepKey) {
  return TIER_EXAMPLES[tierId].map((example) => ({ example, activePart: key }));
}

function lessonsForTier(tierId: SentenceOrderingTierId) {
  return TIER_LESSONS[tierId].map((lesson, index) => ({
    id: `${tierId}-step-${index + 1}-${lesson.key}`,
    step: `Step ${index + 1}`,
    title: lesson.title,
    details: lesson.details,
    examples: stepExamples(tierId, lesson.key),
  }));
}

function sentenceOrderingIntro(tierId: SentenceOrderingTierId): PhaseIntro {
  return sharedSentenceOrderingIntro(tierId);
}

interface PositionedStepPart {
  part: StepKey;
  start: number;
  end: number;
}

function findChunkStart(sentence: string, chunk: string): number {
  const haystack = sentence.toLocaleLowerCase();
  const needle = chunk.toLocaleLowerCase();
  const needsStartBoundary = /^[a-z0-9]/i.test(chunk);
  const needsEndBoundary = /[a-z0-9]$/i.test(chunk);
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const candidate = haystack.indexOf(needle, from);
    if (candidate < 0) break;
    const before = sentence[candidate - 1] ?? "";
    const after = sentence[candidate + chunk.length] ?? "";
    const startsCleanly = !needsStartBoundary || !/[a-z0-9]/i.test(before);
    const endsCleanly = !needsEndBoundary || !/[a-z0-9]/i.test(after);
    if (startsCleanly && endsCleanly) return candidate;
    from = candidate + 1;
  }

  if (needle.startsWith("as for ")) {
    const bareChunk = chunk.replace(/^as for\s+/i, "").trim();
    const bareStart = haystack.indexOf(bareChunk.toLocaleLowerCase());
    if (bareStart >= 0) return bareStart;
  }
  return -1;
}

function stepPartOrder(tierId: SentenceOrderingTierId): readonly StepKey[] {
  return SENTENCE_ORDERING_CHUNK_ROLES[tierId];
}

function positionedStepParts(
  sentence: string,
  example: TierExample,
  partOrder: readonly StepKey[],
  representation: "en" | "enOrdered" | "jp",
): PositionedStepPart[] {
  const positioned = partOrder
    .map((part) => {
      const chunk = example[part];
      const text =
        representation === "enOrdered"
          ? (chunk?.enOrdered ?? chunk?.en ?? "").replaceAll(", ", " → ")
          : (chunk?.[representation] ?? "");
      if (!text) return null;
      const start = findChunkStart(sentence, text);
      if (start < 0) return null;
      return { part, start, end: start + text.length };
    })
    .filter((part): part is PositionedStepPart => part != null)
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  return positioned.filter(
    (candidate, index) =>
      !positioned
        .slice(0, index)
        .some((placed) => candidate.start < placed.end && candidate.end > placed.start),
  );
}

function focusedSentence(
  sentence: string,
  spans: readonly PositionedStepPart[],
  activePart: StepKey,
): ReactNode {
  const out: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, index) => {
    if (span.start > cursor) out.push(sentence.slice(cursor, span.start));
    out.push(
      <span
        key={`${span.part}-${span.start}-${index}`}
        className={span.part === activePart ? "font-medium text-accent" : "font-medium text-text-muted"}
      >
        {sentence.slice(span.start, span.end)}
      </span>,
    );
    cursor = span.end;
  });
  if (cursor < sentence.length) out.push(sentence.slice(cursor));
  return out;
}

function FocusedPartBoxes({
  sentence,
  spans,
  activePart,
  labels,
  lang,
}: {
  sentence: string;
  spans: readonly PositionedStepPart[];
  activePart: StepKey;
  labels: Partial<Record<StepKey, string>>;
  lang?: string;
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {spans.map((span) => {
        const active = span.part === activePart;
        return (
          <div
            key={`${span.part}-${span.start}`}
            className="rounded-md border border-border/70 bg-card/60 px-2 py-1"
          >
            <span className={`block text-[9px] font-semibold uppercase tracking-wide ${active ? "text-accent" : "text-text-muted"}`}>
              {labels[span.part]}
            </span>
            <span
              lang={lang}
              className={`text-[13px] font-medium ${active ? "text-accent" : "text-text-muted"}`}
            >
              {sentence.slice(span.start, span.end)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The intro card's own worked example — same three-layer shape as the step
 * cards below it (natural English, that sentence in Japanese chunk order, then
 * the actual Japanese sentence), just without a chunk to highlight yet: the
 * intro is read before the walk starts breaking anything into parts. Reuses
 * the step cards' box/label treatment so the abstract description above it
 * and the concrete cards after it don't look like two different features.
 */
function IntroWorkedExample({ example }: { example: SentenceOrderingWorkedExample }) {
  return (
    <div className="mt-6 rounded-md border border-border/60 bg-card/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        Example
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-text">
        Natural English
      </p>
      <p className="text-[14px] text-text-muted">{example.en}</p>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-text">
        Japanese chunk order
      </p>
      <p className="text-[13px] text-text-muted">{example.enOrdered}</p>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-text">
        Japanese
      </p>
      <p lang="ja" className="mt-1 text-[20px] font-light text-text-muted">
        {example.jp}
      </p>
    </div>
  );
}

/** Total steps for a tier's walk: the intro card, plus one step per chunk role
 * TIER_LESSONS teaches for that tier. Called from src/app/session/page.tsx to
 * size the HUD's "N of M" and clamp the current step — same contract
 * sentenceOrderingTeachSteps always had, renamed on the SAK-113 move. */
export function sentenceRuleEntrySteps(tierId: SentenceOrderingTierId): number {
  return 1 + TIER_LESSONS[tierId].length;
}

export function SentenceRuleEntryView({
  step,
  tierId = "simple",
}: {
  step: number;
  tierId?: SentenceOrderingTierId;
}) {
  const lessons = lessonsForTier(tierId);
  const intro = sentenceOrderingIntro(tierId);
  const guide = SENTENCE_ORDERING_GUIDES[tierId];
  const totalSteps = 1 + lessons.length;
  const at = Math.max(0, Math.min(step, totalSteps - 1));
  const onIntro = at === 0;
  const lesson = onIntro ? null : lessons[at - 1];

  return (
    <div className="px-3">
      <div className="flex min-h-5 items-center gap-3" />

      <div className="mt-2">
        {onIntro ? (
          // Flat section surfaces, matching the main TeachWalk and the Library
          // entry page: the intro card's flat-aware panels drop their frosty
          // fill in the teach walk too (border kept). Same provider, same reason
          // as teach-walk.tsx.
          <FlatSurfaceProvider>
            <PhaseIntroView intro={intro} />
            {guide.example ? <IntroWorkedExample example={guide.example} /> : null}
          </FlatSurfaceProvider>
        ) : lesson ? (
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                {lesson.step}
              </p>
              <h2 className="mt-3 max-w-[26ch] text-[34px] font-light leading-[1.2] tracking-[-0.4px] text-text">
                {lesson.title}
              </h2>
            </div>

            <div className="border-t border-border pt-7">
              <p className="mb-3 text-[12px] font-semibold text-accent">{guide.hook}</p>
              <div className="space-y-2 text-[15px] leading-relaxed text-text">
                {lesson.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>

              <div className="mt-2 space-y-3">
                {lesson.examples.map(({ example, activePart }, idx) => {
                  const partOrder = stepPartOrder(tierId);
                  const labels = CHUNK_ROLE_LABELS[tierId];
                  const orderedSentence = example.enOrdered.replaceAll(", ", " → ");
                  const naturalParts = positionedStepParts(
                    example.en,
                    example,
                    partOrder,
                    "en",
                  );
                  const orderedParts = positionedStepParts(
                    orderedSentence,
                    example,
                    partOrder,
                    "enOrdered",
                  );
                  const japaneseParts = positionedStepParts(
                    example.jp,
                    example,
                    partOrder,
                    "jp",
                  );
                  return (
                    <div
                      key={`${example.en}-${example.jp}`}
                      className="rounded-md border border-border/60 bg-card/40 px-3 py-2.5"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                        Example {idx + 1}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-text">
                        Natural English
                      </p>
                      <p className="text-[14px] text-text-muted">
                        {focusedSentence(example.en, naturalParts, activePart)}
                      </p>
                      <FocusedPartBoxes
                        sentence={example.en}
                        spans={naturalParts}
                        activePart={activePart}
                        labels={labels}
                      />

                      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-text">
                        Japanese chunk order
                      </p>
                      <p className="text-[13px] text-text-muted">
                        {focusedSentence(orderedSentence, orderedParts, activePart)}
                      </p>
                      <FocusedPartBoxes
                        sentence={orderedSentence}
                        spans={orderedParts}
                        activePart={activePart}
                        labels={labels}
                      />

                      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-text">
                        Japanese
                      </p>
                      <p lang="ja" className="mt-1 text-[20px] font-light text-text-muted">
                        {focusedSentence(example.jp, japaneseParts, activePart)}
                      </p>
                      <FocusedPartBoxes
                        sentence={example.jp}
                        spans={japaneseParts}
                        activePart={activePart}
                        labels={labels}
                        lang="ja"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Back / Next, the round config, and the data-attribution link all live in
          the session frame's frozen footer now (see src/app/session/page.tsx). */}
    </div>
  );
}
