import type { PhaseIntro } from "@/data/phase-intros";

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

/**
 * A chunk's grammatical role within its tier's sentence frame — "topic",
 * "core", "ending", and the handful of tier-specific roles (a conditional's
 * "condition"/"resultTopic", a request's "context"/"target"/"action"). Shared
 * between the teach walkthrough (which highlights each role's span as it
 * steps through an example) and the assembly quiz (which uses the same roles
 * to name a misplaced chunk on a wrong check — see `src/lib/assembly-check.ts`).
 */
export type ChunkRoleKey =
  | "ending"
  | "core"
  | "topic"
  | "marker"
  | "action"
  | "target"
  | "context"
  | "condition"
  | "resultTopic";

/** The ordered chunk roles a tier's canonical sentence frame is built from,
 * left-to-right. Most tiers are topic → core → ending; request and
 * conditional have their own shape. */
export const SENTENCE_ORDERING_CHUNK_ROLES: Record<
  SentenceOrderingTierId,
  readonly ChunkRoleKey[]
> = {
  request: ["context", "target", "action", "ending"],
  conditional: ["condition", "resultTopic", "core", "ending"],
  simple: ["topic", "core", "ending"],
  causal: ["core", "topic", "ending"],
  obligation: ["topic", "core", "ending"],
  sequential: ["core", "topic", "ending"],
  desire: ["topic", "core", "ending"],
  giving: ["topic", "core", "ending"],
  reported: ["topic", "core", "ending"],
  contrast: ["core", "topic", "ending"],
};

/** The learner-facing name for each role, per tier — the plain-English labels
 * already shown while teaching a tier's chunk order (e.g. "Topic",
 * "Final predicate", "If part"). */
export const CHUNK_ROLE_LABELS: Record<
  SentenceOrderingTierId,
  Partial<Record<ChunkRoleKey, string>>
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

export interface SentenceOrderingGuide {
  eyebrow: string;
  title: string;
  body: readonly { lead: string; text: string }[];
  hook: string;
}

export const SENTENCE_ORDERING_GUIDES: Record<SentenceOrderingTierId, SentenceOrderingGuide> = {
  simple: {
    eyebrow: "Simple sentence ordering",
    title: "Japanese sentences are ordered differently from English.",
    body: [
      {
        lead: "English usually puts the action in the middle.",
        text: "A simple English sentence often follows this order: who or what → main action → the thing affected by the action.",
      },
      {
        lead: "Japanese usually puts the action at the end.",
        text: "Japanese often starts with who or what the sentence is about, adds the other information, and finishes with the main action.",
      },
      {
        lead: "Small markers show what each part does.",
        text: "Markers such as は and を help you tell who or what the sentence is about and what is affected by the action.",
      },
    ],
    hook: "Think: who or what → other information → main action.",
  },
  conditional: {
    eyebrow: "Conditional sentence ordering",
    title: "Japanese usually puts the “if” part before what happens next.",
    body: [
      {
        lead: "First comes the “if” part.",
        text: "This tells you the situation that must be true. It often ends in たら, ば, or なら.",
      },
      {
        lead: "Then comes what will happen.",
        text: "The rest of the sentence tells you the result if that situation is true.",
      },
      {
        lead: "Keep the two parts clear.",
        text: "Read the sentence as: if this happens → then this happens.",
      },
    ],
    hook: "Think: if this happens → then this happens.",
  },
  causal: {
    eyebrow: "Cause and result ordering",
    title: "Japanese usually gives the reason before what happened because of it.",
    body: [
      {
        lead: "First comes the reason.",
        text: "The reason often ends in から or ので, both of which can mean “because.”",
      },
      {
        lead: "Then comes the result.",
        text: "The second part tells you what happened because of that reason.",
      },
      {
        lead: "Follow the cause-and-effect order.",
        text: "Read the sentence as: because of this → this happened.",
      },
    ],
    hook: "Think: because of this → this happened.",
  },
  obligation: {
    eyebrow: "Obligation sentence ordering",
    title: "Japanese puts the action before the words that mean “must” or “have to.”",
    body: [
      {
        lead: "Start with who and when.",
        text: "The sentence can first tell you who needs to do something and when.",
      },
      {
        lead: "Then say what they need to do.",
        text: "The required action comes before the must or have-to ending.",
      },
      {
        lead: "The ending adds the obligation.",
        text: "Endings such as なければならない and なければいけない tell you the action is required.",
      },
    ],
    hook: "Think: who and when → required action → must or have to.",
  },
  sequential: {
    eyebrow: "Te-form links and helpers",
    title: "A te-form can connect an action to extra meaning at the end.",
    body: [
      {
        lead: "Start with the action.",
        text: "The verb changes to its te-form so another ending can attach to it.",
      },
      {
        lead: "The ending changes how the action is understood.",
        text: "It can show that the action is ongoing, being tried, or happened completely or unintentionally.",
      },
      {
        lead: "Other information still comes first.",
        text: "Who, where, and what usually appear before the action and its added ending.",
      },
    ],
    hook: "Think: who, where, or what → action → added meaning.",
  },
  desire: {
    eyebrow: "Desire and difficulty ordering",
    title: "Japanese adds “want to,” “easy,” or “hard” directly after the action.",
    body: [
      {
        lead: "First find who or what the sentence is about.",
        text: "This may be the person who wants to do something or the thing being described as easy or hard.",
      },
      {
        lead: "Then find the action.",
        text: "The action comes directly before たい, やすい, or にくい.",
      },
      {
        lead: "The ending gives the final meaning.",
        text: "たい means want to, やすい means easy to, and にくい means difficult to.",
      },
    ],
    hook: "Think: who or what → action → want to, easy, or hard.",
  },
  giving: {
    eyebrow: "Giving and receiving ordering",
    title: "The ending shows who does something for whom.",
    body: [
      {
        lead: "Start with whose side the sentence follows.",
        text: "The first person mentioned often gives you the point of view for the action.",
      },
      {
        lead: "Then say who does what for whom.",
        text: "The people, the thing involved, and the action all come before the final helper.",
      },
      {
        lead: "The ending shows the direction.",
        text: "あげる, くれる, and もらう tell you whether help is given, comes toward someone, or is received.",
      },
    ],
    hook: "Think: whose side → who does what for whom → giving or receiving ending.",
  },
  reported: {
    eyebrow: "Stance and reported meaning",
    title: "Japanese puts the basic statement before words like “I think” or “might.”",
    body: [
      {
        lead: "First comes the basic statement.",
        text: "This is the idea the speaker is thinking about or is not completely sure about.",
      },
      {
        lead: "Then comes the speaker's view.",
        text: "Endings such as と思う, らしい, and かもしれない add meanings like “I think,” “apparently,” or “might.”",
      },
      {
        lead: "Other information can come first.",
        text: "The sentence may begin by telling you who is speaking, what it is about, or when it happens.",
      },
    ],
    hook: "Think: who, what, or when → basic statement → speaker's view.",
  },
  contrast: {
    eyebrow: "Marked-clause ordering",
    title: "Japanese puts the first situation before the main thing that happened.",
    body: [
      {
        lead: "First comes the setup.",
        text: "のに can mean “even though,” while ないで can mean “without doing.”",
      },
      {
        lead: "Then comes the main result.",
        text: "The rest of the sentence tells you who did what after that setup.",
      },
      {
        lead: "The two endings do different jobs.",
        text: "のに shows an unexpected contrast. ないで says one action happened without another action.",
      },
    ],
    hook: "Think: first situation → who the result is about → main result.",
  },
  request: {
    eyebrow: "Request and proposal ordering",
    title: "Japanese puts the action before the ending that makes it a request or suggestion.",
    body: [
      {
        lead: "Start with when, where, or what.",
        text: "The sentence can first tell you the context and the thing affected by the action.",
      },
      {
        lead: "Then say the action.",
        text: "This is the thing you are asking someone to do or suggesting that people do together.",
      },
      {
        lead: "The ending makes the sentence a request or suggestion.",
        text: "ください makes a request. ましょう suggests doing the action together.",
      },
    ],
    hook: "Think: when or where → what → action → request or suggestion.",
  },
};

function buildSentenceOrderingIntro(tierId: SentenceOrderingTierId): PhaseIntro {
  const guide = SENTENCE_ORDERING_GUIDES[tierId];
  return {
    id: `sentence-rule-${tierId}`,
    setId: "",
    eyebrow: guide.eyebrow,
    title: guide.title,
    body: guide.body.map((paragraph) => ({ ...paragraph })),
  };
}

export const SENTENCE_ORDERING_INTROS: Readonly<Record<SentenceOrderingTierId, PhaseIntro>> =
  Object.fromEntries(
    (Object.keys(SENTENCE_ORDERING_GUIDES) as SentenceOrderingTierId[]).map((tierId) => [
      tierId,
      buildSentenceOrderingIntro(tierId),
    ]),
  ) as Record<SentenceOrderingTierId, PhaseIntro>;

export function sentenceOrderingIntro(tierId: SentenceOrderingTierId): PhaseIntro {
  return SENTENCE_ORDERING_INTROS[tierId];
}
