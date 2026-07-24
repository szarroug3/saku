// "How to ask", by source — the DATA-FREE half: defaults, migration, and the
// pure enabled/empty checks that need no fact registry.
//
// Kept apart from src/lib/ask-forms.ts (which imports the fact registry to turn
// a config + a fact into concrete card forms) for the same reason
// selection-empty.ts is kept apart from selection.ts: the always-mounted
// QuizConfigProvider seeds and migrates a config on every route, and must not
// pull the kanji/vocab payload to do it. Everything here is a function of the
// config alone.

import type {
  AnswerStyle,
  AskConfig,
  GridResponse,
  PromptFormat,
  PairResponse,
  QuizConfig,
  ResponseKind,
} from "@/types";

const PROMPTS: readonly PromptFormat[] = ["text", "audio"];
const RESPONSES: readonly ResponseKind[] = ["definition", "romaji"];
const ANSWERS: readonly AnswerStyle[] = ["typed", "mc"];
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
    },
    english: { answers: [] },
  };
}

/** Coerce any stored/parsed value into a valid AskConfig — unknown members
 * dropped, missing groups empty. A value that is not an object at all (or has
 * no keys) is the full default. Never throws. */
export function normalizeAsk(raw: unknown): AskConfig {
  if (!raw || typeof raw !== "object" || !Object.keys(raw).length) {
    return defaultAsk();
  }
  const r = raw as Partial<AskConfig>;
  const j = (r.japanese ?? {}) as never;
  const s = (r.sentence ?? {}) as never;
  const e = (r.english ?? {}) as never;
  return {
    japanese: {
      prompts: clean<PromptFormat>(j["prompts"], PROMPTS),
      responses: clean<ResponseKind>(j["responses"], RESPONSES),
      answers: clean<AnswerStyle>(j["answers"], ANSWERS),
    },
    sentence: {
      prompts: clean<PromptFormat>(s["prompts"], PROMPTS),
      responses: clean<ResponseKind>(s["responses"], RESPONSES),
      answers: clean<AnswerStyle>(s["answers"], ANSWERS),
    },
    english: {
      answers: clean<AnswerStyle>(e["answers"], ANSWERS),
    },
  };
}

/** The OLD config shape, before this source-based model. Only the fields the
 * migration reads — everything else on QuizConfig is untouched. */
interface LegacyAsk {
  dirs?: { jp2en?: boolean; en2jp?: boolean };
  styleJp2en?: AnswerStyle;
  styleEn2jp?: AnswerStyle;
  listenRomaji?: boolean;
  listenMeaning?: boolean;
}

/**
 * Build an AskConfig from a pre-task-30 saved config, so an existing selection
 * still loads instead of crashing on a missing `ask`.
 *
 *   dirs.jp2en   → the Japanese source (text prompt, both responses, its style)
 *   listen*      → adds an Audio prompt to the Japanese source
 *   dirs.en2jp   → the English source, at its style
 *
 * The old jp→en direction asked whatever the fact's aspect was (meaning OR
 * reading), so it maps to BOTH responses. Listening was independent of the
 * direction toggles (opt-in, word-only), so audio is added whenever either
 * listen flag was on, even if jp→en itself was off.
 */
export function migrateLegacyAsk(old: LegacyAsk): AskConfig {
  const jp = old.dirs?.jp2en ?? false;
  const en = old.dirs?.en2jp ?? false;
  const audioMeaning = !!old.listenMeaning;
  const audioRomaji = !!old.listenRomaji;
  const audio = audioMeaning || audioRomaji;

  const prompts: PromptFormat[] = [];
  if (jp) prompts.push("text");
  if (audio) prompts.push("audio");

  const responses: ResponseKind[] = [];
  if (jp || audioMeaning) responses.push("definition");
  if (jp || audioRomaji) responses.push("romaji");

  const answers: AnswerStyle[] = jp || audio ? [old.styleJp2en ?? "typed"] : [];

  return {
    japanese:
      prompts.length && responses.length && answers.length
        ? { prompts, responses, answers }
        : { prompts: [], responses: [], answers: [] },
    // Not represented in the old model; default it on so grammar selection
    // cards keep appearing exactly as before.
    sentence: { prompts: ["text"], responses: ["definition"], answers: ["mc"] },
    english: { answers: en ? [old.styleEn2jp ?? "mc"] : [] },
  };
}

// ---------- pure enabled / empty checks (no fact registry) ----------

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
  return (
    s.prompts.length > 0 &&
    s.responses.includes("definition") &&
    s.answers.includes("mc")
  );
}

/** Whether the sentence source has a complete transcription form. Unlike a
 * definition response, Romaji can use either answer control; fact-level
 * enumeration later drops sentences that contain no non-kana to read. */
export function sentenceAsksRomaji(ask: AskConfig): boolean {
  const s = ask.sentence;
  return (
    s.prompts.length > 0 &&
    s.responses.includes("romaji") &&
    s.answers.length > 0
  );
}

/** Whether any complete sentence-source form is selected. */
export function sentenceAsks(ask: AskConfig): boolean {
  return sentenceAsksSelection(ask) || sentenceAsksRomaji(ask);
}

/** Nothing is selected anywhere — Start must be disabled. See start-bar.tsx. */
export function askIsEmpty(ask: AskConfig): boolean {
  return !japaneseAsks(ask) && !sentenceAsks(ask) && !englishAsks(ask);
}

/** The enabled DIRECTIONS this config infers — the replacement for the old
 * `cfg.dirs`. Japanese (either response) ⇒ jp→en; English ⇒ en→jp. */
export function enabledDirs(ask: AskConfig): { jp2en: boolean; en2jp: boolean } {
  return {
    jp2en: japaneseAsks(ask) || sentenceAsks(ask),
    en2jp: englishAsks(ask),
  };
}

/** Read a QuizConfig's ask, tolerating a value that predates the field. */
export function askOf(cfg: Pick<QuizConfig, "ask">): AskConfig {
  return cfg.ask ?? defaultAsk();
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
