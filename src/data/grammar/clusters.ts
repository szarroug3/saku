// ===========================================================================
// CLUSTERS — families that mean the same thing in English and differ by feel.
//
// A CLUSTER PAGE IS A MAP, NOT A QUIZ.
// ===================================
// This is the whole design and it is worth being blunt about. There are seven
// ways to say "must" and this file glosses all seven identically, because they
// ARE identical in English. No question may ask which one is "right":
//
//   "i don't expect the app to teach me when to say 'i'm happy' vs 'i'm
//    ecstatic'. i expect it to teach me how to say 'i'm happy' and how to say
//    'i'm ecstatic' and what 'happy' and 'ecstatic' mean...
//    i don't need the app to teach me judgement. i need it to give me the
//    skills to make judgement calls. the judgement part comes from experience."
//
// So a cluster page shows four things: the members, how each is BUILT (which
// comes from recipes.ts and the conjugation engine, so it is generated and
// cannot be wrong), what each MEANS (identical, and saying so out loud is the
// point), and one link out to someone who writes prose for a living.
//
// `feel` is the one soft field, and it is fenced: SHOWN, NEVER ASKED, NEVER
// SCORED. It is not a lesson and not an authority; it is a hint that exists so
// the page isn't silent about the thing the user actually wonders about. If
// you ever find yourself wanting to grade it, the answer is no — that is the
// judgement the app has agreed not to teach.
//
// WHERE IS は/が?
// ==============
// Right here, and ONLY here. は/が cloze is dead — verified across 660,343
// particle slots, the corpus contains frames with BOTH particles in otherwise
// identical sentences, and 66% of minimal pairs have literally identical
// English translations (彼[は/が]部屋に入ってきた is "He came into the room"
// either way). A quiz built on it would mark correct Japanese wrong, which is
// the worst failure available for a user with no grammar footing to push back
// with. See selection.ts.
//
// But "cannot be a quiz question" is not "cannot be taught". A MAP is exactly
// the safe form for は/が: it shows the pair, links out, and asks nothing. The
// cluster page is where the material that fails the quiz test goes to live
// honestly, rather than being deleted or faked.
//
// LINKS ARE A BET
// ===============
// Every link is a bet on someone else's site staying up and staying free.
// That's why each carries `lastVerified` as data: a bet with a date on it can
// be re-checked, and a dead link found by a script is a chore, while a dead
// link found by the user is a broken promise. Always target="_blank" — the
// renderer enforces it; see the Link type.
//
// NOT EVERY CLUSTER GETS ONE. `obligation` — the biggest and most useful
// cluster in the file, the seven ways to say "must" — has NO verified link
// covering it. The slot ships VISIBLY EMPTY, with the reason shown. Inventing
// a plausible URL, or pointing at a page that covers three of the seven and
// pretending, would be worse than the gap: it teaches the user that our links
// are decorative.
//
// AND NEVER TAE KIM
// =================
// guidetojapanese.org hosts TWO guides and the distinction is load-bearing:
//
//   Complete Guide — current, maintained, good, and states verbatim: "The
//   Complete Guide is currently NOT licensed under a creative commons or any
//   other license." All rights reserved.
//
//   Grammar Guide — CC BY-NC-SA 3.0 US, but SUPERSEDED and plain-form-first,
//   which contradicts the polite-form-first order every textbook uses. For a
//   user with zero grammar that contradiction is unadjudicable.
//
// And NC is not open source: CC BY-NC-SA is not OSI-approved, cannot coexist
// with MIT/GPL, and every fork would inherit a commercial-use ban. So: we LINK
// (which has no licence surface at all — linking is not copying) and we never
// bundle, quote, or paraphrase. The conditionals link below points at the
// Grammar Guide because Tofugu has no equivalent page; it is a LINK, and that
// is the only reason it is allowed to be there.
// ===========================================================================

import { RECIPES, type Recipe } from "./recipes.ts";

/**
 * An outbound link. Data, not markup, so the set can be swept by a script.
 *
 * `lastVerified` is an ISO date and is REQUIRED — a link without one is a bet
 * nobody wrote down.
 */
export interface Link {
  readonly url: string;
  readonly label: string;
  /** ISO date this URL was last confirmed to resolve and cover the cluster. */
  readonly lastVerified: string;
}

export interface Cluster {
  readonly id: string;
  /** The English these all collapse onto — "must", "seems". */
  readonly title: string;
  /** What the whole family does, in one line. */
  readonly gloss: string;
  /**
   * Recipe ids, in the order the page should list them. Resolved through
   * `membersOf` — a cluster names its members, the recipes name their cluster,
   * and a test asserts the two agree.
   */
  readonly members: readonly string[];
  /**
   * SHOWN, NEVER ASKED, NEVER SCORED. One terse note per member at most.
   * Not a lesson, not an authority, not gradeable. See the header.
   */
  readonly feel?: string;
  /**
   * The one link out, or null. Null is a FEATURE and must carry `noLinkReason`
   * — see obligation.
   */
  readonly link: Link | null;
  /** Required when `link` is null. Rendered, not hidden. */
  readonly noLinkReason?: string;
}

export const CLUSTERS: readonly Cluster[] = [
  {
    id: "obligation",
    title: "must",
    gloss: "seven ways to say the same thing",
    members: [
      "nakereba-naranai",
      "nakereba-ikenai",
      "nakute-wa-naranai",
      "nakute-wa-ikenai",
      "nai-to-ikenai",
      "nakucha",
      "nakya",
    ],
    feel:
      "All seven are ない-form + a fixed ending, and all seven gloss as 'must'. " +
      "なくちゃ / なきゃ are spoken contractions of なくては / なければ. " +
      "〜ならない and 〜いけない are interchangeable in nearly every frame.",
    link: null,
    // `noLinkReason` is RENDERED — it is the text beside the empty slot, not a
    // comment. So it may not name a source file: "see clusters.ts" was in here
    // and would have shipped to the screen, telling a user learning Japanese to
    // go read our TypeScript. The reason a reader needs is the one about the
    // links, and it is above this line, where readers of the code will find it.
    noLinkReason:
      "No verified link covers all seven. The pages that exist cover three or " +
      "four and stop, and pointing at one would imply a completeness it does " +
      "not have. The slot is empty on purpose.",
  },
  {
    id: "seems",
    title: "seems",
    gloss: "evidentials — how sure you are, and how you know",
    members: ["sou-appearance", "sou-hearsay", "you-da", "rashii", "kamoshirenai", "deshou"], //
    feel:
      "そう splits by ATTACHMENT, which is the only split in this family a " +
      "machine can see: 降りそう (stem, 'looks like rain') vs 降るそうだ " +
      "(plain, 'I hear it'll rain'). The rest differ by how direct the " +
      "evidence is, and that ordering is exactly the judgement call this app " +
      "does not make for you.",
    link: null,
    noLinkReason:
      "No single verified link covers the family. Tofugu's そう/よう/らしい " +
      "pages are per-pattern, not comparative.",
  },
  {
    id: "conditionals",
    title: "if",
    gloss: "four conditionals, one English word",
    members: ["ba", "tara", "to-conditional", "nara"],
    feel:
      "と is the most mechanical (whenever X, Y follows); たら is the most " +
      "general; ば leans hypothetical; なら picks up a topic someone just " +
      "raised. The overlap is large and real.",
    link: {
      url: "https://guidetojapanese.org/learn/grammar/conditionals",
      label: "Tae Kim's Grammar Guide — Conditionals",
      lastVerified: "2026-07-17",
    },
  },
  {
    id: "because",
    title: "because",
    gloss: "から and ので",
    members: ["kara-reason", "node"],
    feel:
      "ので is softer and more deferential; から states a reason more baldly " +
      "and is the one you can end a sentence on. Note から's OTHER job " +
      "(東京から, 'from Tokyo') is a different recipe entirely — kara-source.",
    link: {
      url: "https://www.tofugu.com/japanese-grammar/conjunctive-particle-node/",
      label: "Tofugu — ので",
      lastVerified: "2026-07-17",
    },
  },
  {
    id: "after",
    title: "after",
    gloss: "てから and たあとで",
    members: ["te-kara", "ta-ato-de"],
    feel:
      "てから emphasises sequence (and that the first thing finished); あとで " +
      "just places one event after another.",
    link: null,
    noLinkReason: "No verified link compares the two. Tofugu covers あとで alone.",
  },
  {
    id: "just-happened",
    title: "just did it",
    gloss: "たばかり and たところ",
    members: ["ta-bakari", "ta-tokoro"],
    feel:
      "たところ is clock-time just (it happened moments ago); たばかり is " +
      "felt-time just (it can be months, if it still feels recent).",
    link: null,
    noLinkReason: "No verified link compares the two.",
  },
  {
    id: "ability",
    title: "can",
    gloss: "ことができる and the potential form",
    members: ["koto-ga-dekiru", "potential"],
    feel:
      "ことができる is longer and more formal; the potential form is what " +
      "people say. Note 〜られる is ALSO the passive, and for every ichidan " +
      "verb the two are the same string (食べられる) — that ambiguity is in " +
      "Japanese itself, not in this list.",
    link: null,
    noLinkReason: "No verified link compares the two.",
  },
  {
    id: "hard-to-do",
    title: "hard to do",
    gloss: "にくい and づらい",
    members: ["nikui", "zurai"],
    feel:
      "にくい is about the thing (this pen is hard to write with); づらい " +
      "leans on the doer's discomfort (this is hard for me to say). Both are " +
      "V-stem + a fixed string.",
    link: null,
    noLinkReason: "No verified link compares the two.",
  },
  {
    id: "comparison",
    title: "more than",
    gloss: "は〜より and 〜のほうが〜より",
    members: ["wa-yori", "hou-ga-yori"],
    feel:
      "Same comparison, different emphasis: のほうが foregrounds the winner. " +
      "Both are VACUOUS as production questions — you are attaching a particle " +
      "to a noun, not conjugating anything.",
    link: null,
    noLinkReason: "No verified link compares the two.",
  },

  // --- MAP-ONLY CLUSTERS ---------------------------------------------------
  // These have no `members`, because they are not built from recipes: they are
  // choices between two particles in a frame, which is exactly the thing the
  // app has proven it must not quiz. They exist because they are what a
  // beginner asks about first, and a map can answer honestly where a quiz
  // cannot. See the は/が note in this file's header.
  {
    id: "wa-ga",
    title: "は vs が",
    gloss: "the topic/subject pair — read about it, never drilled",
    members: [],
    feel:
      "SHOWN, NEVER ASKED — and here that is not a style choice but a hard " +
      "finding. The corpus contains identical frames taking either particle, " +
      "and 66% of minimal pairs have identical English translations. There is " +
      "frequently no fact of the matter, so there is no question to ask.",
    link: {
      url: "https://www.tofugu.com/japanese/wa-and-ga/",
      label: "Tofugu — は vs が",
      lastVerified: "2026-07-17",
    },
  },
  {
    id: "ni-de",
    title: "に vs で",
    gloss: "where something is vs where something happens",
    members: [],
    feel: "Roughly: に marks existence and destination, で marks the site of an action.",
    link: {
      url: "https://www.tofugu.com/japanese/ni-vs-de/",
      label: "Tofugu — に vs で",
      lastVerified: "2026-07-17",
    },
  },
  {
    id: "transitivity",
    title: "transitive vs intransitive",
    gloss: "開ける vs 開く — verb pairs that come in twos",
    members: [],
    feel:
      "Japanese pairs most verbs: one you do to something (を), one that just " +
      "happens (が). The pairing is lexical, not a rule you can derive.",
    link: {
      url: "https://www.tofugu.com/japanese-grammar/transitivity/",
      label: "Tofugu — Transitivity",
      lastVerified: "2026-07-17",
    },
  },
];

// ---------------------------------------------------------------------------
// Lookups.
// ---------------------------------------------------------------------------

const BY_ID: ReadonlyMap<string, Cluster> = new Map(CLUSTERS.map((c) => [c.id, c]));

export function cluster(id: string): Cluster | undefined {
  return BY_ID.get(id);
}

/** A cluster's recipes, in the cluster's stated order. */
export function membersOf(c: Cluster): Recipe[] {
  const byId = new Map(RECIPES.map((r) => [r.id, r]));
  return c.members.flatMap((id) => {
    const r = byId.get(id);
    return r ? [r] : [];
  });
}

/** Clusters shipping a visibly empty link slot, with their stated reason. */
export const UNLINKED: readonly Cluster[] = CLUSTERS.filter((c) => c.link === null);
