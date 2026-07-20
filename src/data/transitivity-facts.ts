// The transitivity subject's entry into the fact registry.
//
// src/lib/facts.ts states the contract: "Publish a `FactInfo[]` from the
// subject's own module and add it to SUBJECTS below." This file is transitivity
// taking it at its word — the pairs in src/data/transitivity.ts, minted into
// facts, and one line in facts.ts. Nothing downstream can tell a transitivity
// fact from a kana one.
//
// WHY THIS IS A SEPARATE FILE FROM src/data/transitivity.ts
// =========================================================
// That file is the CURATED TABLE, and its whole identity is that it is data an
// editor checked by hand (see its header). Minting fact ids and building
// FactInfo is app plumbing, not curation, so it lives here — the same split the
// grammar subject makes between recipes.ts (the table) and index.ts (the facts).
//
// TWO FACTS PER PAIR, KEYED BY SIDE
// =================================
// A pair is two skills, not one: "which verb for `the door opened`" and "which
// verb for `I opened the door`" fail independently, so each side is its own
// trackable fact (this is exactly what lib/transitivity.ts `allQuestions()`
// already yields). The glyph of a side fact is its OWN verb — 開く for the
// happens side, 開ける for the doIt side — so the drill renders it as an option
// and grades a click by which fact was picked.
//
// BOTH SIDES ARE MINTED; ONLY THE ASKABLE ONES ARE SCHEDULED
// ==========================================================
// lib/transitivity.ts `question()` refuses a side whose DISTRACTOR is `ambi`
// (genuinely both transitive and intransitive on one sense), because that
// distractor could also be correct and marking correct Japanese wrong is the
// failure this codebase kills question types over. That refusal is about
// ASKING the side, not about the verb existing: the verb is always a valid
// OPTION on its partner's board. So every side is minted here (each fact needs
// a real partner fact to put opposite it), and `askable` records which sides
// are safe to schedule. The curriculum (lib/transitivity-lesson.ts) teaches
// only askable sides; the two refused sides ride along solely as distractors.

import { entryId, factId } from "../lib/fact-id.ts";
import { question, type Side } from "../lib/transitivity.ts";
import { VERB_PAIRS, type VerbPair } from "./transitivity.ts";
import type { EntryId, FactId, FactInfo } from "../types/index.ts";

export const TRANSITIVITY_SUBJECT = "transitivity";

/** The two sides of every pair, in data order — the order a lesson teaches them
 * and a drill asks them. */
const SIDES: readonly Side[] = ["happens", "doIt"];

/** A stable key for a pair: its two written forms. Two pairs never share both
 * verbs, so this names one pair and only one. Used to mint the entry id; never
 * parsed back (see fact-id.ts). */
function pairKey(p: VerbPair): string {
  return `${p.happens.word}/${p.doIt.word}`;
}

/** The entry a pair's facts hang off. One entry, two facts (one per side). */
export function pairEntry(p: VerbPair): EntryId {
  return entryId(TRANSITIVITY_SUBJECT, pairKey(p));
}

/** One side's fact id — the askable thing "which verb for THIS cue". */
export function sideFactId(p: VerbPair, side: Side): FactId {
  return factId(pairEntry(p), side);
}

/** Everything the question layer needs to ask a transitivity fact without
 * parsing its id — the lookup-not-parse rule facts.ts is built on. */
export interface TransitivitySide {
  readonly pair: VerbPair;
  readonly side: Side;
  /** The English cue, and the whole of the question. "The door opened." */
  readonly en: string;
  /** The correct verb — the answer, and this fact's glyph. */
  readonly word: string;
  readonly reading: string;
  /** The partner side's fact — the one and only distractor (see the header of
   * lib/transitivity.ts for why there is no third option). Always exists,
   * because both sides are minted. */
  readonly partner: FactId;
  /** Whether this side is SAFE to schedule as a question — false for the handful
   * whose distractor is ambitransitive. Curriculum reads this; the drill never
   * needs to, because an unaskable side is never put in a deck. */
  readonly askable: boolean;
}

const SIDE_INFO = new Map<FactId, TransitivitySide>();
const PAIR_BY_ENTRY = new Map<EntryId, VerbPair>();

/** Every transitivity fact — both sides of every pair, 2 × VERB_PAIRS. */
export const TRANSITIVITY_FACTS: FactInfo[] = buildTransitivityFacts();

function buildTransitivityFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  for (const p of VERB_PAIRS) {
    PAIR_BY_ENTRY.set(pairEntry(p), p);
    for (const side of SIDES) {
      const member = p[side];
      const id = sideFactId(p, side);
      const partner = sideFactId(p, side === "happens" ? "doIt" : "happens");
      SIDE_INFO.set(id, {
        pair: p,
        side,
        en: member.en,
        word: member.word,
        reading: member.reading,
        partner,
        askable: question(p, side) !== null,
      });
      facts.push({
        id,
        entry: pairEntry(p),
        glyph: member.word,
        // The written form always, and the reading too when they differ — so a
        // typed answer (defensive; the drill asks this as MC) accepts either.
        answers:
          member.word === member.reading
            ? [member.word]
            : [member.word, member.reading],
        subject: TRANSITIVITY_SUBJECT,
        meaning: member.en,
      });
    }
  }
  return facts;
}

/** What a transitivity fact asks, or undefined for a non-transitivity id. A
 * lookup, never a parse. */
export function transitivitySide(fact: FactId): TransitivitySide | undefined {
  return SIDE_INFO.get(fact);
}

/** The pair an entry belongs to, or undefined — for the teach card, which shows
 * the whole pair rather than one side. */
export function pairForEntry(entry: EntryId): VerbPair | undefined {
  return PAIR_BY_ENTRY.get(entry);
}
