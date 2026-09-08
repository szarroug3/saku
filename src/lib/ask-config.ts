// "How to ask", by source. The DATA-FREE half: the defaults and the pure
// enabled/empty checks that need no fact registry.
//
// Kept apart from src/lib/ask-forms.ts (which imports the fact registry to turn
// a config + a fact into concrete card forms) for the same reason
// selection-empty.ts is kept apart from selection.ts: the always-mounted
// QuizConfigProvider seeds a config on every route, and must not pull the
// kanji/vocab payload to do it. Everything here is a function of the config
// alone.
//
// The migration half (deriveAudioPrompts, normalizeAsk, migrateLegacyAsk) went
// with the config's own migrations in SAK-373. What is left below
// askFromAudioPrompts answers questions about an ask, and only the engine's
// own untaken paths ask them.

import type {
  AskConfig,
  GridResponse,
  PairResponse,
  PromptFormat,
} from "@/types";

const PAIR_RESPONSES: readonly PairResponse[] = [
  "definition",
  "romaji",
  "sentence",
];
const GRID_RESPONSES: readonly GridResponse[] = ["definition", "romaji"];

/** Keep only known members, in canonical order, deduped — so a hand-edited or
 * older stored array can't smuggle a stray value past the panel. */
function clean<T>(raw: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(raw)) return [];
  return allowed.filter((a) => raw.includes(a));
}

/**
 * The day-one "How to ask": Japanese shown as text, asked for its meaning or its
 * reading, typed; English asked back as multiple choice; grammar patterns may
 * appear as fill-the-blank sentence cards. Mirrors the OLD default (jp→en typed,
 * en→jp multiple choice, no audio, selection cards on).
 */
export function defaultAsk(): AskConfig {
  return {
    japanese: {
      prompts: ["text"],
      responses: ["definition", "romaji"],
      answers: ["typed"],
    },
    sentence: {
      prompts: ["text"],
      responses: ["definition"],
      answers: ["mc"],
      englishResponses: ["ordering"],
    },
    english: { answers: [] },
  };
}

/**
 * DERIVE the full "how to ask" from the single user-facing toggle. This is the
 * whole simplification: TEXT IS ALWAYS ON, and everything except whether AUDIO
 * is added is fixed on and cannot be turned off, so no lesson can be broken by a
 * toggle. In particular a grammar PRODUCTION card ("build the て-form") is a
 * text-only prompt with no listen form, so with text always present it is always
 * reachable — the bug the old audio-only option caused.
 *
 *   - Japanese: prompted as text (plus audio when on), asked for BOTH its
 *     meaning and its reading, TYPED (formIsMc coerces to MC wherever the fact
 *     can't be typed — kana en→jp, mcOnlyIn, etc.).
 *   - Sentence: same prompt format(s); grammar patterns appear as fill-the-blank
 *     selection cards, and en→jp production (ordering + selection) stays on.
 *   - English: en→jp production always on, typed (again coerced where needed).
 */
export function askFromAudioPrompts(audioPrompts: boolean): AskConfig {
  const prompts: PromptFormat[] = audioPrompts ? ["text", "audio"] : ["text"];
  return {
    japanese: {
      prompts,
      responses: ["definition", "romaji"],
      answers: ["typed"],
    },
    sentence: {
      prompts,
      responses: ["definition"],
      answers: ["mc"],
      englishResponses: ["ordering", "selection"],
    },
    english: { answers: ["typed"] },
  };
}

/** Whether the Japanese source can produce any jp→en card at all: it needs a
 * prompt, a response and an answer format. Audio-only still counts (it produces
 * cards for listenable words). */
export function japaneseAsks(ask: AskConfig): boolean {
  const j = ask.japanese;
  return j.prompts.length > 0 && j.responses.length > 0 && j.answers.length > 0;
}

/** Whether the English source can produce any en→jp card. */
export function englishAsks(ask: AskConfig): boolean {
  return ask.english.answers.length > 0;
}

/** Whether the Sentence source allows grammar patterns to be shown as
 * fill-the-blank selection cards — the one behaviour it drives today
 * (Definition · Multiple choice). */
export function sentenceAsksSelection(ask: AskConfig): boolean {
  const s = ask.sentence;
  return s.prompts.length > 0 && s.responses.includes("definition");
}

/** Sentence transcription is intentionally unsupported. Kept as an exported
 * compatibility predicate because summaries and stored configurations written
 * before the removal still call it; it must remain false so a legacy
 * `responses: ["romaji"]` value cannot enable Start and lead to an empty run. */
export function sentenceAsksRomaji(ask: AskConfig): boolean {
  void ask;
  return false;
}

/** Whether any complete sentence-source form is selected. */
export function sentenceAsks(ask: AskConfig): boolean {
  return (
    sentenceAsksSelection(ask) ||
    sentenceAsksRomaji(ask) ||
    englishSentenceAsks(ask)
  );
}

export function englishSentenceAsksOrdering(ask: AskConfig): boolean {
  return (ask.sentence.englishResponses ?? []).includes("ordering");
}

export function englishSentenceAsksSelection(ask: AskConfig): boolean {
  return (ask.sentence.englishResponses ?? []).includes("selection");
}

export function englishSentenceAsks(ask: AskConfig): boolean {
  return (
    englishSentenceAsksOrdering(ask) || englishSentenceAsksSelection(ask)
  );
}

/** Nothing is selected anywhere — Start must be disabled. See start-bar.tsx. */
export function askIsEmpty(ask: AskConfig): boolean {
  return !japaneseAsks(ask) && !sentenceAsks(ask) && !englishAsks(ask);
}

/** The enabled DIRECTIONS this config infers — the replacement for the old
 * `cfg.dirs`. Japanese (either response) ⇒ jp→en; English ⇒ en→jp. */
export function enabledDirs(ask: AskConfig): { jp2en: boolean; en2jp: boolean } {
  return {
    jp2en:
      japaneseAsks(ask) ||
      sentenceAsksSelection(ask) ||
      sentenceAsksRomaji(ask),
    en2jp: englishAsks(ask) || englishSentenceAsks(ask),
  };
}

/** The full pair-relationship set — pairs mode always drills every relationship
 * now, so there is no per-mode chooser and this is what normalizeConfig pins. */
export function allPairResponses(): PairResponse[] {
  return [...PAIR_RESPONSES];
}

/** The full grid-response set — grid mode always drills every response now. */
export function allGridResponses(): GridResponse[] {
  return [...GRID_RESPONSES];
}

export function normalizePairResponses(raw: unknown): PairResponse[] {
  // Missing means an older saved config and gets the defaults. An explicit
  // empty array is a real current choice, so preserve it and let Start explain
  // why a run cannot begin yet.
  return Array.isArray(raw)
    ? clean<PairResponse>(raw, PAIR_RESPONSES)
    : [...PAIR_RESPONSES];
}

/** Toggle one Match-pairs relationship. Empty is valid setup state; StartBar,
 * rather than the controls, enforces that a run needs at least one. */
export function togglePairResponse(
  current: readonly PairResponse[],
  value: PairResponse,
): PairResponse[] {
  if (!current.includes(value)) return [...current, value];
  return current.filter((x) => x !== value);
}

export function normalizeGridResponses(raw: unknown): GridResponse[] {
  return Array.isArray(raw)
    ? clean<GridResponse>(raw, GRID_RESPONSES)
    : [...GRID_RESPONSES];
}

/** Empty is a valid editor state; Start owns the at-least-one requirement. */
export function toggleGridResponse(
  current: readonly GridResponse[],
  value: GridResponse,
): GridResponse[] {
  if (!current.includes(value)) return [...current, value];
  return current.filter((x) => x !== value);
}
