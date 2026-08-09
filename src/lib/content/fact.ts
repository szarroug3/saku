// The unified FACT model — the atom every surface reads instead of re-deriving.
//
// Stage 0 of docs/architecture-refactor.md: additive and NOT yet consumed. It
// exists so Stages 1–4 have one shape to move each track onto. The point of the
// whole refactor is that a fact's KIND is the single lever: adding a kind here
// (say "mic") is where a new question type begins — `factsOf` (Stage 1) emits it,
// and one registered quiz renderer (Stage 4) handles it — instead of touching
// every track's scheduler and every quiz screen.

// ALIGN WITH WHAT EXISTS, DON'T FORK IT. Two pieces are already in place:
//   - src/lib/facts.ts unifies facts: every subject publishes `FactInfo[]` and
//     `factsOf(entry)` reads them, nothing downstream telling subjects apart.
//   - src/lib/ask-forms.ts already models a fact's KIND, and richer than a flat
//     enum: orthogonal axes — PromptFormat (text·audio) × ResponseKind
//     (definition·romaji, i.e. meaning·reading) × AnswerStyle — with
//     `enabledFormsFor(fact, ask)` computing what a given fact supports.
//
// So the meaning/reading distinction is NOT missing, and a future "say it" (mic)
// mode is a new axis VALUE on that model, not a new fact type. `FactKind` below is
// only a convenience label for the common cases; the source of truth is
// ask-forms.ts. The real Stage-1 work is fact INCLUSION — routing the counters
// scheduler through `factsOf(entry)` so a number's reading fact is in the lesson —
// not adding a field. See docs/architecture-refactor.md.

import type { FactId, ResponseKind } from "@/types";

/**
 * What a fact asks the learner to PRODUCE — the meaning/reading axis. This is
 * exactly the existing `ResponseKind` ("definition" | "romaji"), so we alias it
 * rather than invent a parallel enum. The classifier already exists too:
 * `jp2enResponse(factId)` in ask-forms.ts (reads `FactInfo`, no id-parsing).
 *
 * A listen/mic mode is NOT a value here — that is a PromptFormat, an orthogonal
 * axis (see ask-forms.ts). Keeping them separate is the whole point.
 */
export type FactKind = ResponseKind;

/**
 * One testable piece of knowledge about a content item.
 *
 * A fact is NOT a single prompt→answer: it is asked in MULTIPLE forms — both
 * directions (jp→en and en→jp), text or listening, typed or multiple-choice —
 * and those are forms of ONE fact, not separate facts. That set is already a
 * first-class type, `CardForm` (source × response × direction × listen ×
 * answer-style) in ask-forms.ts, and `enabledFormsFor(id, ask): CardForm[]`
 * computes the forms a given fact supports under a config. So the content model
 * does NOT carry a prompt/answer here; it carries the fact's identity and defers
 * its quizzable forms to that function — the single source of truth the drill
 * already trusts.
 */
export interface Fact {
  readonly id: FactId;
  /** Convenience label for the common case; the authoritative, per-form support
   * lives in ask-forms.ts (see the FactKind note above). */
  readonly kind: FactKind;
}
