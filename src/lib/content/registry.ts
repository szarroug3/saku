// The renderer-registry SEAM — how one viewport and one quiz shell render any
// kind, by look-up, instead of forking a component per track.
//
// Renderers register at module load (Stages 2 & 4); the shared shell reads the
// map. Adding a content kind or fact kind means registering one renderer, not
// editing a switch in five places. Duplicate registration throws, so two tracks
// can't silently claim the same kind.
//
// Stage 0 of docs/architecture-refactor.md: the mechanism plus the two typed
// registries. The renderer VALUE types are `unknown` here to keep this layer
// framework-free; they narrow to real components when each shell lands.

import type { ContentKind } from "./item";

export interface Registry<K, V> {
  /** Register a value for a key. Throws if the key is already taken. */
  register(key: K, value: V): void;
  get(key: K): V | undefined;
  has(key: K): boolean;
  keys(): readonly K[];
}

export function createRegistry<K, V>(): Registry<K, V> {
  const map = new Map<K, V>();
  return {
    register(key, value) {
      if (map.has(key)) {
        throw new Error(`registry: "${String(key)}" is already registered`);
      }
      map.set(key, value);
    },
    get: (key) => map.get(key),
    has: (key) => map.has(key),
    keys: () => [...map.keys()],
  };
}

/** A lesson-card component (Stage 2 narrows this from `unknown`). */
export type ItemRenderer = unknown;

/** ONE lesson viewport renders any item by looking its content-kind up here. */
export const itemRenderers: Registry<ContentKind, ItemRenderer> = createRegistry();

// The quiz-side renderer registry is intentionally NOT here yet. A quiz question
// is a CardForm (source × response × direction × listen × answer-style, see
// ask-forms.ts), NOT a FactKind — keying it by fact-kind could not tell jp→en
// from en→jp, the exact "one prompt/answer isn't enough" trap. It lands with the
// quiz shell (Stage 4), keyed by CardForm. `createRegistry` above is reused then.
