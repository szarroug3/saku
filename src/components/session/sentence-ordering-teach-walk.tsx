"use client";

import type { ReactNode } from "react";

import { PhaseIntroView } from "@/components/lesson/phase-intro-view";
import { FlatSurfaceProvider } from "@/components/ui";
import type { PhaseIntro } from "@/data/phase-intros";
import {
  SENTENCE_ORDERING_GUIDES,
  sentenceOrderingIntro as sharedSentenceOrderingIntro,
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

interface TierGuide {
  eyebrow: string;
  title: string;
  body: readonly { lead: string; text: string }[];
  hook: string;
}

export const LEGACY_TIER_GUIDE: Record<SentenceOrderingTierId, TierGuide> = {
  simple: {
    eyebrow: "What sentence ordering is",
    title: "Japanese usually puts the main action near the end, not in English word order.",
    body: [
      {
        lead: "English and Japanese build sentences differently.",
        text: "English is usually Subject-Verb-Object: \"Sam eats sushi.\" Japanese is usually Topic/Subject-Object-Verb, so the action chunk tends to be near the end.",
      },
      {
        lead: "It is not simply \"nouns first\".",
        text: "Time, place and topic chunks can be placed early. Particles show each chunk's role, so order follows structure as opposed to how English positions words.",
      },
      {
        lead: "Verb choice does not usually rewrite the whole order.",
        text: "The specific verb form can change, but the sentence-final action pattern is still the default.",
      },
    ],
    hook: "This lesson is about baseline chunk order in plain statements.",
  },
  conditional: {
    eyebrow: "Conditional sentence ordering",
    title: "Conditionals split a sentence into an IF chunk and a result chunk.",
    body: [
      {
        lead: "Find the condition marker first.",
        text: "Look for condition endings such as たら, ば or なら. That boundary tells you where the condition chunk ends.",
      },
      {
        lead: "Result follows condition.",
        text: "After the condition chunk, place the main outcome chunk. Keep the final action/result anchored near the right edge.",
      },
      {
        lead: "Topic/context still sits to the left.",
        text: "Topic, time and place can still appear early; the conditional boundary is what you are practicing here.",
      },
    ],
    hook: "In this tier, your key cue is the IF boundary (たら/ば/なら).",
  },
  causal: {
    eyebrow: "Cause and result ordering",
    title: "Because/so sentences are ordered by cause chunk then result chunk.",
    body: [
      {
        lead: "Identify the reason marker.",
        text: "Watch for から or ので to locate the reason chunk.",
      },
      {
        lead: "Cause feeds into outcome.",
        text: "Place the reason chunk before the result chunk so the logic flows correctly.",
      },
      {
        lead: "Keep sentence backbone stable.",
        text: "Even with reason markers, the final predicate still tends to settle at the end.",
      },
    ],
    hook: "In this tier, your key cue is cause-first flow (から/ので).",
  },
  obligation: {
    eyebrow: "Obligation sentence ordering",
    title: "Must/have-to patterns create a requirement chunk before the obligation ending.",
    body: [
      {
        lead: "Spot obligation endings.",
        text: "Look for patterns like なければならない, なければいけない, なきゃ, or ないといけない.",
      },
      {
        lead: "Action chunk comes before the obligation frame.",
        text: "The verb/action chunk is followed by the obligation expression that finalizes the meaning.",
      },
      {
        lead: "Read it as structure, not translation order.",
        text: "Place chunks by grammatical frame first, then read the whole sentence meaning.",
      },
    ],
    hook: "In this tier, your key cue is the obligation frame near the sentence end.",
  },
  sequential: {
    eyebrow: "Te-form construction ordering",
    title: "Te-form constructions connect an action to a following link or helper.",
    body: [
      {
        lead: "Find the complete final construction.",
        text: "Look for forms such as てから, ている, or てみる and keep each form attached to the action it modifies.",
      },
      {
        lead: "Read the helper's actual function.",
        text: "てから marks what happens after an action, ている marks an ongoing action, and てみる marks trying an action.",
      },
      {
        lead: "Do not treat every te-form as a sequence.",
        text: "The te-form connects the verb to what follows, but the following form determines the relationship.",
      },
    ],
    hook: "In this tier, your key cue is the complete te-form construction.",
  },
  desire: {
    eyebrow: "Desire/ease sentence ordering",
    title: "Want-to and easy/hard patterns attach to action chunks in fixed spots.",
    body: [
      {
        lead: "Find attached evaluation forms.",
        text: "Look for たい, やすい, and にくい attached to action stems.",
      },
      {
        lead: "Action and evaluation stay together.",
        text: "Place the action chunk so its attached desire/ease form stays structurally connected.",
      },
      {
        lead: "Context remains left-side support.",
        text: "Topic/time/place chunks still frame the sentence on the left.",
      },
    ],
    hook: "In this tier, your key cue is the action-plus-evaluation chunk.",
  },
  giving: {
    eyebrow: "Giving/receiving sentence ordering",
    title: "Giving and receiving patterns encode direction between people.",
    body: [
      {
        lead: "Identify the helper verb.",
        text: "Look for てあげる, てくれる, or てもらう to identify direction of benefit.",
      },
      {
        lead: "Place giver/receiver context clearly.",
        text: "Chunks naming who does what for whom need clear placement before the final helper chunk.",
      },
      {
        lead: "Direction matters more than English gloss.",
        text: "Order chunks to preserve who benefits, not just a literal word-by-word translation.",
      },
    ],
    hook: "In this tier, your key cue is benefit direction (giver vs receiver).",
  },
  reported: {
    eyebrow: "Reported/opinion ordering",
    title: "I think / seems-like patterns add an outer opinion layer around a core statement.",
    body: [
      {
        lead: "Separate core statement from report layer.",
        text: "Watch for markers like と思う, らしい, かもしれない, and でしょう.",
      },
      {
        lead: "Core meaning chunk first, stance after.",
        text: "The proposition chunk is placed, then the opinion/probability layer wraps it.",
      },
      {
        lead: "Read confidence level from the ending.",
        text: "These endings signal certainty/uncertainty, so keep them in the right chunk position.",
      },
    ],
    hook: "In this tier, your key cue is outer stance markers on top of the core clause.",
  },
  contrast: {
    eyebrow: "Linked-clause sentence ordering",
    title: "Even-though and without-doing patterns put a marked clause before the main result.",
    body: [
      {
        lead: "Find the clause marker.",
        text: "のに closes an “even though” clause; ないで closes a “without doing” clause.",
      },
      {
        lead: "Keep the marked clause together.",
        text: "Place the complete のに or ないで clause before the main action or result.",
      },
      {
        lead: "Do not give both markers the same meaning.",
        text: "のに expresses a contrast; ないで says that the following action happens without the first action.",
      },
    ],
    hook: "In this tier, your key cue is the marked clause before the main result.",
  },
  request: {
    eyebrow: "Request/proposal ordering",
    title: "Requests and proposals place a target action before the request frame.",
    body: [
      {
        lead: "Identify request/proposal endings.",
        text: "Look for てください-type requests, ましょう proposals, and instruction forms.",
      },
      {
        lead: "Action target precedes the request frame.",
        text: "Place the thing being requested/proposed before the final request expression.",
      },
      {
        lead: "Keep politeness/function chunk intact.",
        text: "The request ending carries social function; do not detach it from the action chunk it governs.",
      },
    ],
    hook: "In this tier, your key cue is the request/proposal frame at the end.",
  },
};

type StepKey =
  | "ending"
  | "core"
  | "topic"
  | "marker"
  | "action"
  | "target"
  | "context"
  | "condition"
  | "resultTopic";

const DEFAULT_STEP_PARTS: readonly StepKey[] = ["topic", "core", "ending"];
const REQUEST_STEP_PARTS: readonly StepKey[] = ["context", "target", "action", "ending"];
const CONDITIONAL_STEP_PARTS: readonly StepKey[] = [
  "condition",
  "resultTopic",
  "core",
  "ending",
];

const STEP_PART_LABELS: Record<
  SentenceOrderingTierId,
  Partial<Record<StepKey, string>>
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
      en: "Saku ate sushi.",
      enOrdered: "As for Saku → sushi → ate.",
      jp: "サクは寿司を食べた。",
      ending: { en: "ate", jp: "食べた" },
      core: { en: "sushi", jp: "寿司を" },
      topic: { en: "Saku", enOrdered: "As for Saku", jp: "サクは" },
      marker: { en: "as for", jp: "は" },
    },
    {
      en: "Saku went to the store.",
      enOrdered: "As for Saku → to the store → went.",
      jp: "サクは店に行った。",
      ending: { en: "went", jp: "行った" },
      core: { en: "to the store", jp: "店に" },
      topic: { en: "Saku", enOrdered: "As for Saku", jp: "サクは" },
      marker: { en: "to", jp: "に" },
    },
    {
      en: "Saku played with the red ball.",
      enOrdered: "As for Saku → with the red ball → played.",
      jp: "サクは赤いボールで遊んだ。",
      ending: { en: "played", jp: "遊んだ" },
      core: { en: "with the red ball", jp: "赤いボールで" },
      topic: { en: "Saku", enOrdered: "As for Saku", jp: "サクは" },
      marker: { en: "with", jp: "で" },
    },
  ],
  conditional: [
    {
      en: "If it rains, I will stay home.",
      enOrdered: "If it rains → as for me → home → will stay.",
      jp: "雨が降ったら、私は家にいる。",
      ending: { en: "will stay", jp: "いる" },
      core: { en: "home", jp: "家に" },
      topic: {
        en: "If it rains, I",
        enOrdered: "If it rains → as for me",
        jp: "雨が降ったら、私は",
      },
      marker: { en: "if", jp: "たら" },
      condition: { en: "If it rains", jp: "雨が降ったら" },
      resultTopic: { en: "I", enOrdered: "as for me", jp: "私は" },
    },
    {
      en: "I will go to the park if I have time.",
      enOrdered: "If I have time → as for me → to the park → will go.",
      jp: "時間があれば、私は公園に行く。",
      ending: { en: "will go", jp: "行く" },
      core: { en: "to the park", jp: "公園に" },
      topic: {
        en: "If I have time, I",
        enOrdered: "If I have time → as for me",
        jp: "時間があれば、私は",
      },
      marker: { en: "if", jp: "ば" },
      condition: { en: "if I have time", enOrdered: "If I have time", jp: "時間があれば" },
      resultTopic: { en: "I", enOrdered: "as for me", jp: "私は" },
    },
    {
      en: "If Saku comes, we will start the meeting.",
      enOrdered: "If Saku comes → as for us → the meeting → will start.",
      jp: "サクが来たら、私たちは会議を始める。",
      ending: { en: "will start", jp: "始める" },
      core: { en: "the meeting", jp: "会議を" },
      topic: {
        en: "If Saku comes, we",
        enOrdered: "If Saku comes → as for us",
        jp: "サクが来たら、私たちは",
      },
      marker: { en: "if", jp: "たら" },
      condition: { en: "If Saku comes", jp: "サクが来たら" },
      resultTopic: { en: "we", enOrdered: "as for us", jp: "私たちは" },
    },
  ],
  causal: [
    {
      en: "Because it is raining, I will not run.",
      enOrdered: "Because it is raining → as for me → will not run.",
      jp: "雨が降っているから、私は走らない。",
      ending: { en: "will not run", jp: "走らない" },
      core: { en: "Because it is raining", jp: "雨が降っているから" },
      topic: { en: "I", enOrdered: "as for me", jp: "私は" },
      marker: { en: "because", jp: "から" },
    },
    {
      en: "Because she is tired, Saku goes to bed early.",
      enOrdered: "Because Saku is tired → as for Saku → goes to bed early.",
      jp: "疲れているので、サクは早く寝る。",
      ending: { en: "goes to bed early", jp: "早く寝る" },
      core: {
        en: "Because she is tired",
        enOrdered: "Because Saku is tired",
        jp: "疲れているので",
      },
      topic: { en: "Saku", enOrdered: "as for Saku", jp: "サクは" },
      marker: { en: "because", jp: "ので" },
    },
    {
      en: "We went home because class ended.",
      enOrdered: "Because class ended → as for us → went home.",
      jp: "授業が終わったから、私たちは帰った。",
      ending: { en: "went home", jp: "帰った" },
      core: { en: "Because class ended", jp: "授業が終わったから" },
      topic: { en: "we", enOrdered: "as for us", jp: "私たちは" },
      marker: { en: "because", jp: "から" },
    },
  ],
  obligation: [
    {
      en: "Tomorrow, I must wake up early.",
      enOrdered: "Tomorrow → as for me → wake up early → must.",
      jp: "明日、私は早く起きなければならない。",
      ending: { en: "must", jp: "なければならない" },
      core: { en: "wake up early", jp: "早く起き" },
      topic: { en: "Tomorrow, I", enOrdered: "Tomorrow → as for me", jp: "明日、私は" },
      marker: { en: "must", jp: "なければならない" },
    },
    {
      en: "Saku has to finish her homework.",
      enOrdered: "As for Saku → finish her homework → has to.",
      jp: "サクは宿題を終えなければいけない。",
      ending: { en: "has to", jp: "なければいけない" },
      core: { en: "finish her homework", jp: "宿題を終え" },
      topic: { en: "Saku", enOrdered: "As for Saku", jp: "サクは" },
      marker: { en: "have to", jp: "なければいけない" },
    },
    {
      en: "Now, we have to leave.",
      enOrdered: "Now → as for us → leave → have to.",
      jp: "今、私たちは出なければならない。",
      ending: { en: "have to", jp: "なければならない" },
      core: { en: "leave", jp: "出" },
      topic: { en: "Now, we", enOrdered: "Now → as for us", jp: "今、私たちは" },
      marker: { en: "have to", jp: "なければならない" },
    },
  ],
  sequential: [
    {
      en: "Saku is studying at the library.",
      enOrdered: "At the library → as for Saku → is studying.",
      jp: "図書館で、サクは勉強している。",
      ending: { en: "is studying", jp: "勉強している" },
      core: { en: "at the library", jp: "図書館で" },
      topic: { en: "Saku", enOrdered: "as for Saku", jp: "サクは" },
      marker: { en: "is -ing", jp: "ている" },
    },
    {
      en: "I will try reading this article.",
      enOrdered: "This article → as for me → will try reading.",
      jp: "この記事を、私は読んでみる。",
      ending: { en: "will try reading", jp: "読んでみる" },
      core: { en: "this article", jp: "この記事を" },
      topic: { en: "I", enOrdered: "as for me", jp: "私は" },
      marker: { en: "try", jp: "てみる" },
    },
    {
      en: "Saku accidentally forgot her homework.",
      enOrdered: "As for Saku → her homework → accidentally forgot.",
      jp: "サクは宿題を忘れてしまった。",
      ending: { en: "accidentally forgot", jp: "忘れてしまった" },
      core: { en: "her homework", jp: "宿題を" },
      topic: { en: "Saku", enOrdered: "As for Saku", jp: "サクは" },
      marker: { en: "accidentally", jp: "てしまった" },
    },
  ],
  desire: [
    {
      en: "I want to go to Japan.",
      enOrdered: "As for me → to Japan → go → want to.",
      jp: "私は日本へ行きたい。",
      ending: { en: "want to", jp: "たい" },
      core: { en: "go to Japan", enOrdered: "to Japan → go", jp: "日本へ行き" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "want to", jp: "たい" },
    },
    {
      en: "This book is easy to read.",
      enOrdered: "As for this book → read → easy to.",
      jp: "この本は読みやすい。",
      ending: { en: "easy to", jp: "やすい" },
      core: { en: "read", jp: "読み" },
      topic: { en: "This book is", enOrdered: "As for this book", jp: "この本は" },
      marker: { en: "easy to", jp: "やすい" },
    },
    {
      en: "Kanji is hard to write.",
      enOrdered: "As for kanji → write → hard to.",
      jp: "漢字は書きにくい。",
      ending: { en: "hard to", jp: "にくい" },
      core: { en: "write", jp: "書き" },
      topic: { en: "Kanji is", enOrdered: "As for kanji", jp: "漢字は" },
      marker: { en: "hard to", jp: "にくい" },
    },
  ],
  giving: [
    {
      en: "I lent my friend a book as a favor.",
      enOrdered: "As for me → my friend → a book → lent → as a favor.",
      jp: "私は友達に本を貸してあげた。",
      ending: { en: "as a favor", jp: "あげた" },
      core: {
        en: "lent my friend a book",
        enOrdered: "my friend → a book → lent",
        jp: "友達に本を貸して",
      },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "to my friend", jp: "に" },
    },
    {
      en: "Saku made dinner for me.",
      enOrdered: "As for Saku → me → dinner → made → for me.",
      jp: "サクは私に夕飯を作ってくれた。",
      ending: { en: "for me", jp: "くれた" },
      core: {
        en: "made dinner",
        enOrdered: "me → dinner → made",
        jp: "私に夕飯を作って",
      },
      topic: { en: "Saku", enOrdered: "As for Saku", jp: "サクは" },
      marker: { en: "for me", jp: "に" },
    },
    {
      en: "I had my friend teach me Japanese.",
      enOrdered: "As for me → from my friend → Japanese → teach → received the favor.",
      jp: "私は友達に日本語を教えてもらった。",
      ending: { en: "had", enOrdered: "received the favor", jp: "もらった" },
      core: {
        en: "my friend teach me Japanese",
        enOrdered: "from my friend → Japanese → teach",
        jp: "友達に日本語を教えて",
      },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "from my friend", jp: "に" },
    },
  ],
  reported: [
    {
      en: "I think he will come.",
      enOrdered: "As for me → he will come → think.",
      jp: "私は彼が来ると思う。",
      ending: { en: "think", jp: "と思う" },
      core: { en: "he will come", jp: "彼が来る" },
      topic: { en: "I", enOrdered: "As for me", jp: "私は" },
      marker: { en: "I think", jp: "と思う" },
    },
    {
      en: "Saku is apparently busy.",
      enOrdered: "As for Saku → busy → apparently.",
      jp: "サクは忙しいらしい。",
      ending: { en: "is apparently", enOrdered: "apparently", jp: "らしい" },
      core: { en: "busy", jp: "忙しい" },
      topic: { en: "Saku", enOrdered: "As for Saku", jp: "サクは" },
      marker: { en: "apparently", jp: "らしい" },
    },
    {
      en: "Tomorrow, it might snow.",
      enOrdered: "Tomorrow → snow → might.",
      jp: "明日は雪が降るかもしれない。",
      ending: { en: "might", jp: "かもしれない" },
      core: { en: "snow", jp: "雪が降る" },
      topic: { en: "Tomorrow, it", enOrdered: "Tomorrow", jp: "明日は" },
      marker: { en: "might", jp: "かもしれない" },
    },
  ],
  contrast: [
    {
      en: "Even though it is raining, he went out.",
      enOrdered: "Even though it is raining, he went out.",
      jp: "雨なのに、彼は出かけた。",
      ending: { en: "went out", jp: "出かけた" },
      core: { en: "Even though it is raining", jp: "雨なのに" },
      topic: { en: "he", jp: "彼は" },
      marker: { en: "even though", jp: "のに" },
    },
    {
      en: "Saku forgot the answer even though she studied.",
      enOrdered: "Even though she studied → as for Saku → forgot the answer.",
      jp: "勉強したのに、サクは答えを忘れた。",
      ending: { en: "forgot the answer", jp: "答えを忘れた" },
      core: { en: "Even though she studied", jp: "勉強したのに" },
      topic: { en: "Saku", enOrdered: "as for Saku", jp: "サクは" },
      marker: { en: "even though", jp: "のに" },
    },
    {
      en: "I left without eating breakfast.",
      enOrdered: "Without eating breakfast, I left.",
      jp: "朝ごはんを食べないで、私は出た。",
      ending: { en: "left", jp: "出た" },
      core: { en: "Without eating breakfast", jp: "朝ごはんを食べないで" },
      topic: { en: "I", jp: "私は" },
      marker: { en: "without doing", jp: "ないで" },
    },
  ],
  request: [
    {
      en: "Please read this sentence.",
      enOrdered: "This sentence → read → please.",
      jp: "この文を読んでください。",
      ending: {
        en: "Please",
        enOrdered: "please",
        jp: "ください",
      },
      core: {
        en: "read this sentence",
        enOrdered: "This sentence → read",
        jp: "この文を読んで",
      },
      topic: { en: "", jp: "" },
      marker: { en: "please", jp: "ください" },
      action: { en: "read", jp: "読んで" },
      target: { en: "this sentence", enOrdered: "This sentence", jp: "この文を" },
      context: { en: "", jp: "" },
    },
    {
      en: "Let's start now.",
      enOrdered: "Now → start → let's.",
      jp: "今、始めましょう。",
      ending: {
        en: "Let's",
        enOrdered: "let's",
        jp: "ましょう",
      },
      core: { en: "start", jp: "始め" },
      topic: { en: "now", jp: "今" },
      marker: { en: "let's", jp: "ましょう" },
      action: { en: "start", jp: "始め" },
      target: { en: "", jp: "" },
      context: { en: "now", enOrdered: "Now", jp: "今" },
    },
    {
      en: "Please write your name here.",
      enOrdered: "Here → your name → write → please.",
      jp: "ここに名前を書いてください。",
      ending: {
        en: "Please",
        enOrdered: "please",
        jp: "ください",
      },
      core: {
        en: "write your name",
        enOrdered: "your name → write",
        jp: "名前を書いて",
      },
      topic: { en: "here", jp: "ここに" },
      marker: { en: "please", jp: "ください" },
      action: { en: "write", jp: "書いて" },
      target: { en: "your name", enOrdered: "your name", jp: "名前を" },
      context: { en: "here", enOrdered: "Here", jp: "ここに" },
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
      details: ["Put the action or statement ending last.", "This is the sentence's final verb or copular ending."],
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
  if (tierId === "request") return REQUEST_STEP_PARTS;
  if (tierId === "conditional") return CONDITIONAL_STEP_PARTS;
  return DEFAULT_STEP_PARTS;
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

export function sentenceOrderingTeachSteps(tierId: SentenceOrderingTierId): number {
  return 1 + TIER_LESSONS[tierId].length;
}

export function SentenceOrderingTeachWalk({
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
                  const labels = STEP_PART_LABELS[tierId];
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
