// The sentence-rule walk's data and maths, with no React in it: the tier
// examples, the step definitions per tier, and the span positioning that
// finds each chunk role inside an example's three renderings (natural
// English, English in Japanese order, Japanese). Pulled out of
// components/library/sentence-rule-entry-view.tsx so a server-side caller
// (the Sky lesson's adapter, src/app/dev/sky/lesson.ts) can build the same
// walk as plain data; that "use client" component cannot be called from the
// server. The component imports everything here and renders it as before.

import {
  SENTENCE_ORDERING_CHUNK_ROLES,
  type ChunkRoleKey,
  type SentenceOrderingTierId,
} from "@/data/sentence-ordering-guides";

// Chunk roles and their plain-English labels live in
// src/data/sentence-ordering-guides.ts (ChunkRoleKey, SENTENCE_ORDERING_CHUNK_ROLES,
// CHUNK_ROLE_LABELS), shared with the assembly quiz's wrong-answer feedback
// (src/lib/assembly-check.ts), which names a misplaced chunk with these same labels.
export type StepKey = ChunkRoleKey;

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
    // Reordered SAK-254: was topic-first ("私は何も言わないで出た。"), which put
    // this tier's own "who" chunk before its "setup" chunk — backwards from the
    // のに example above and from SENTENCE_ORDERING_CHUNK_ROLES.contrast
    // (core/setup, then topic). Fronting the ないで clause the same way keeps
    // every contrast example teaching the one frame this tier claims.
    {
      en: "I left without saying anything.",
      enOrdered: "Without saying anything → as for me → left.",
      jp: "何も言わないで、私は出た。",
      ending: { en: "left", jp: "出た" },
      core: { en: "without saying anything", jp: "何も言わないで" },
      topic: { en: "I", enOrdered: "as for me", jp: "私は" },
      marker: { en: "without doing", jp: "ないで" },
    },
    {
      en: "I said it without knowing it.",
      enOrdered: "Without knowing that → as for me → said it.",
      jp: "それを知らないで、私は言った。",
      ending: { en: "said it", jp: "言った" },
      core: { en: "without knowing that", jp: "それを知らないで" },
      topic: { en: "I", enOrdered: "as for me", jp: "私は" },
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

export const TIER_LESSONS: Record<SentenceOrderingTierId, readonly LessonDefinition[]> = {
  simple: [
    {
      key: "topic",
      title: "Who or what the sentence is about",
      details: ["Start with the topic, often marked by は.", "Keep the particle attached to the word it labels."],
    },
    {
      key: "core",
      title: "Object, destination, or description",
      details: ["Place the information that completes the thought before the final predicate.", "Keep its particle attached to it."],
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
  // Order swapped SAK-254: this is a plain topic-first frame (私は/それを/
  // 言ってしまった。), so the walk should teach "who" before "where or what",
  // matching SENTENCE_ORDERING_CHUNK_ROLES.sequential.
  sequential: [
    {
      key: "topic",
      title: "Who does the action",
      details: ["Place the person doing the action before the final action.", "Japanese may leave this person unstated when it is already clear."],
    },
    {
      key: "core",
      title: "Where or what",
      details: ["Put the place or thing involved before the final action.", "Keep its small marker attached."],
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

export function lessonsForTier(tierId: SentenceOrderingTierId) {
  return TIER_LESSONS[tierId].map((lesson, index) => ({
    id: `${tierId}-step-${index + 1}-${lesson.key}`,
    step: `Step ${index + 1}`,
    title: lesson.title,
    details: lesson.details,
    examples: stepExamples(tierId, lesson.key),
  }));
}

export interface PositionedStepPart {
  part: StepKey;
  start: number;
  end: number;
}

export function findChunkStart(sentence: string, chunk: string): number {
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

export function stepPartOrder(tierId: SentenceOrderingTierId): readonly StepKey[] {
  return SENTENCE_ORDERING_CHUNK_ROLES[tierId];
}

export function positionedStepParts(
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

/** Total steps for a tier's walk: the intro card, plus one step per chunk role
 * TIER_LESSONS teaches for that tier. Called from src/app/session/page.tsx to
 * size the HUD's "N of M" and clamp the current step — same contract
 * sentenceOrderingTeachSteps always had, renamed on the SAK-113 move. */
export function sentenceRuleEntrySteps(tierId: SentenceOrderingTierId): number {
  return 1 + TIER_LESSONS[tierId].length;
}
