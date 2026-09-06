// Pitch as a fact of its own (SAK-344, Sam 2026-09-06): `word:<keb>/pitch`
// for every word that carries a verified pitch AND can be asked about it
// (a one-mora word with no homophone partner has no honest wrong clip, so
// it gets no fact: the same floor rollPitchQuestion keeps).
//
// IN THE REGISTRY, NOT ON THE ENTRY. The fact is registered (factInfo
// resolves it, ALL_FACTS holds it, the schedule and the session record
// treat it like any fact) but it is deliberately kept out of `factsOf` and
// `knownFactsOf`: a word is known by its meaning and reading, as before, the
// app's lessons and learn feed do not gain a card they cannot draw, and the
// Library's index is unchanged. The Sky asks it on purpose (its lesson quiz
// adds the pitch fact for each word taught, when pitch questions are on),
// and once answered it is in history and comes due like anything else.

import { rollPitchQuestion } from "@/lib/pitch-quiz";
import type { FactId, FactInfo } from "@/types";

import { PITCH_SUBJECT } from "./pitch";
import { VOCAB, wordEntry } from "./vocab";

export { isPitchFact, PITCH_SUBJECT } from "./pitch";

/** The pitch fact of a word, whether or not one is minted for it. */
export function pitchFactId(keb: string): FactId {
  return `${wordEntry(keb)}/pitch` as FactId;
}

const ZERO = () => 0;

function buildPitchFacts(): FactInfo[] {
  const facts: FactInfo[] = [];
  const seen = new Set<string>();
  for (const w of VOCAB) {
    if (seen.has(w.keb)) continue;
    seen.add(w.keb);
    // the question the fact stands for, rolled deterministically: only the
    // reading and gloss are kept, never the partner it happened to pick
    const q = rollPitchQuestion(w.keb, ZERO);
    if (!q) continue;
    facts.push({
      id: pitchFactId(w.keb),
      entry: wordEntry(w.keb),
      glyph: w.keb,
      answers: [q.reading],
      subject: PITCH_SUBJECT,
      meaning: q.gloss,
    });
  }
  return facts;
}

export const PITCH_FACTS: FactInfo[] = buildPitchFacts();
