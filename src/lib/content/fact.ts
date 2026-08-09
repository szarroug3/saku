// The unified FACT model — the atom every surface reads instead of re-deriving.
//
// Stage 0 of docs/architecture-refactor.md: additive and NOT yet consumed. It
// exists so Stages 1–4 have one shape to move each track onto. The point of the
// whole refactor is that a fact's KIND is the single lever: adding a kind here
// (say "mic") is where a new question type begins — `factsOf` (Stage 1) emits it,
// and one registered quiz renderer (Stage 4) handles it — instead of touching
// every track's scheduler and every quiz screen.

// ALIGN WITH THE EXISTING REGISTRY, DON'T FORK IT. src/lib/facts.ts already
// unifies facts: every subject publishes `FactInfo[]` and `factsOf(entry)` reads
// them, with nothing downstream able to tell subjects apart. The one thing
// `FactInfo` lacks is an explicit KIND — today meaning-vs-reading is inferred from
// id conventions (`word:X/reading`). Stage 1 folds `FactKind` onto `FactInfo`
// itself; this file is the stub for that field, not a second fact type.

import type { FactId } from "@/types";

/**
 * What kind of knowledge a fact tests. Deliberately open to extension: a new
 * kind is a one-line edit here, after which the compiler flags every
 * `switch (fact.kind)` that has not handled it — the opposite of today, where a
 * new fact-kind is wired surface by surface and silently forgotten.
 *
 * "pronunciation-audio" is the seam a future mic-check ("say it") slots beside.
 */
export type FactKind = "meaning" | "reading" | "pronunciation-audio";

/**
 * One testable piece of knowledge about a content item. `prompt` and `answer`
 * are kind-specific; they stay `unknown` at this layer so the model does not
 * fork per surface — a renderer registered for the fact's kind narrows them.
 */
export interface Fact {
  readonly id: FactId;
  readonly kind: FactKind;
  /** What the learner is shown (kind-specific; narrowed by the kind's renderer). */
  readonly prompt: unknown;
  /** What grades the answer (kind-specific; narrowed by the kind's grader). */
  readonly answer: unknown;
}
