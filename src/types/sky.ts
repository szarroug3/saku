// The Sky's own shapes: what a character is, how a quiz is configured, what a
// selection asks for, and what one run's stats look like while it is running.
//
// NONE OF THIS IS PERSISTED AS ITSELF. What reaches the `progress` row is
// store.ts; the one crossing is QuizConfig, which SettingsFile carries whole.
// Split out of a 923-line src/types/index.ts in SAK-407; read through @/types,
// which re-exports this beside facts.ts and store.ts.

import type { EntryId, FactId } from "./facts";

// ---------- character data ----------

export interface KanaChar {
  /** The Japanese character (or multi-char combo / word). */
  c: string;
  /** Accepted answers — first entry is the canonical display romaji. */
  r: string[];
  /** Reserved for future sets (vocab). */
  meaning?: string;
  /** A short call-out for a character whose sound is NOT the one its row
   * predicts — し is "shi", ふ is "fu". Absent for the regular majority. */
  note?: string;
  /** Reserved for the v3 stroke-order / draw modes. */
  strokes?: unknown;
  /** Reserved for the v2 listen mode. */
  audio?: string;
}

export interface CharSection {
  id: string;
  label: string;
  chars: KanaChar[];
}

export interface CharSet {
  id: string;
  label: string;
  labelJa: string;
  sections: CharSection[];
}

/** Flattened per-character lookup entry (charIndex in the legacy app). */
export interface CharInfo {
  c: string;
  r: string[];
  set: string;
  setLabel: string;
  sec: string;
  secLabel: string;
  meaning: string | null;
}

// ---------- quiz config (localStorage "saku-cfg") ----------

export type QuizMode =
  | "drill"
  | "pairs"
  | "grid"
  | "assembly"
  | "substitution"
  | "listen-sentence";
export type Direction = "jp2en" | "en2jp";
export type AnswerStyle = "typed" | "mc";

// ---------- how to ask, by SOURCE (task 30) ----------
//
// The "How to ask" panel is organised by the SOURCE of a card, not by an
// abstract direction. Three sources, each a set of multi-select chip rows, and
// every field is a SET so "ask it both ways" is one selection rather than a
// mode. Direction is INFERRED from these (see src/lib/ask-forms.ts), which is
// why there is no `dirs` field any more: Japanese + Definition ⇒ jp→en,
// Japanese/Sentence + Romaji ⇒ jp→reading, English ⇒ en→jp.
//
// The old shape (`dirs`, `styleJp2en`, `styleEn2jp`, `listenRomaji`,
// `listenMeaning`) was migrated forward for two years and is not read at all any
// more (SAK-373); audio is `Prompt Format: Audio`, never a separate opt-in.

/** How a Japanese card is PROMPTED: shown as text, or played as audio.
 * Audio is listening — the glyph is hidden and the word is spoken. Word-only,
 * so a kana or a whole sentence has no audio form (see enabledFormsFor). */
export type PromptFormat = "text" | "audio";

/** What a Japanese card asks the learner to PRODUCE: the English meaning
 * (Definition) or the reading/pronunciation (Romaji). Which one a given fact
 * supports is a property of the fact — a reading fact has no definition, a
 * kanji-less kana sentence has no romaji — not of this preference. */
export type ResponseKind = "definition" | "romaji";

/** A single Japanese token on its own — a kana, a kanji, or a word. */
export interface JapaneseAsk {
  /** Text · Audio. Empty = this source is off. */
  prompts: PromptFormat[];
  /** Definition · Romaji. */
  responses: ResponseKind[];
  /** Type it · Multiple choice. */
  answers: AnswerStyle[];
}

/** A whole Japanese sentence. Definition is multiple-choice only (a fill-the-
 * blank selection card); Romaji applies only when the sentence carries non-kana.
 * Both constraints are enforced in enabledFormsFor, not here. */
export interface SentenceAsk {
  prompts: PromptFormat[];
  responses: ResponseKind[];
  /** Answer controls for Kana only. Definition is always multiple choice. */
  answers: AnswerStyle[];
  /** English is always shown as text. */
  englishResponses?: EnglishSentenceResponse[];
}

export type EnglishSentenceResponse = "ordering" | "selection";

/** English shown as text; the response is ALWAYS Japanese (a reading or the
 * written word — never romaji-as-answer), so the only choice is the answer
 * format. */
export interface EnglishAsk {
  answers: AnswerStyle[];
}

/**
 * The whole of "How to ask", by source. The SINGLE SOURCE OF TRUTH the panel
 * edits and the deck generator reads — see src/lib/ask-forms.ts, which turns
 * (this + a fact) into the concrete card forms, and derives direction from it.
 */
export interface AskConfig {
  japanese: JapaneseAsk;
  sentence: SentenceAsk;
  english: EnglishAsk;
}

/**
 * The order the queue of UNSEEN kanji arrives in. Orders nothing else: not what
 * you are asked next (that is the ranking model's, and it only ever sees facts
 * you have met), not the Library, not a search.
 *
 * Three, and the fourth is not coming back. "Simplest shape first" measured
 * identically to a flat ≤4-stroke ceiling — 291 readable words at 100 items
 * against 294 — which is to say it was not a rival method at all, it was
 * `everyday` with its stroke ceiling wound to the stop, and it cost 410 words
 * to get there.
 *
 * `everyday` is the default because it STRICTLY DOMINATES `grade`: 704 words
 * readable at 100 items against 537, and every character buildable from parts
 * already taught against 71%. There is no axis on which grade wins, so there is
 * no argument for it as the default — only as an option, which it stays,
 * because it is the right answer if you are sitting a class.
 */
export type NewKanjiOrder = "everyday" | "grade" | "newspaper";

export interface QuizConfig {
  /**
   * The one user-facing "how to ask" knob: whether cards are prompted with AUDIO
   * as well as text. Text is ALWAYS on, so this is a single boolean — on ⇒
   * text+audio prompts, off ⇒ text only. Default ON. Lives on Settings, not
   * Practice: it is environmental (does this machine have a TTS voice?), not
   * per-run. The derived `ask` that used to be stored beside it went in
   * SAK-407 — it was rebuilt from this on every read and never read back.
   */
  audioPrompts: boolean;
  /**
   * Whether an eligible word's meaning card queues an additional pitch-accent
   * question (SAK-128/138) — a second, separate knob from `audioPrompts`,
   * since a pitch board IS an audio prompt: audio off already implies no
   * pitch, but audio on doesn't imply pitch on. Default ON. Lives on
   * Settings, not Practice, same reasoning as `audioPrompts`.
   */
  pitchQuestions: boolean;
  /**
   * Extra goes a card gets after a first wrong answer. 0 is none, and 9 is
   * what the retired "unlimited" meant to the quiz that reads this.
   *
   * ONE NUMBER SINCE SAK-407. It used to be two fields, a mode
   * (`"none" | "lim" | "unl"`) and a count (`retryN`), which said the same
   * thing twice and let them disagree — `{ retries: "none", retryN: 3 }` is
   * representable and means nothing. The quiz always wanted the number;
   * normalizeConfig migrates a stored pair to it on first read.
   */
  retries: number;
  timer: boolean;
  timerSec: number;
  /** JP fonts to draw from per card — more than one selected = randomized. */
  fonts: string[];
  /** The Sky's accent, by name (src/sky/lib/settings.ts SKY_ACCENTS). Kept
   * here so it follows the learner like every setting. */
  skyAccent?: string;
  /**
   * The learner's chosen voice for EVERY kind of speech in the app — quiz
   * prompts, listening exercises, the ordinary Hear button, and the
   * word-page pitch button (SAK-100 unified what used to be two separate
   * fields, `voiceName` and SAK-99's `pitchVoiceId`, into this one).
   *
   * Either "" (Auto: the browser's own installed Japanese voice, chosen by
   * pickAutoVoice in src/lib/speech.ts) or a roster id from
   * src/lib/voice.ts's VOICES — never a raw VOICEVOX speaker number. Every
   * roster voice is pitch-corrected: a single word gets its exact known
   * downstep (character-entry-view.tsx), and any other utterance gets
   * per-accent-phrase correction wherever it confidently matches the pitch
   * dataset (src/lib/sentence-pitch.ts), natural VOICEVOX prosody elsewhere.
   * Defaults to "nana" (speaker id 30, DEFAULT_VOICE_ID) — SAK-98's original
   * hardcoded pitch voice, kept as the one default so an existing learner's
   * pitch-button clips don't change until they pick differently in Settings.
   * A stored value that is not a roster id (the retired "Auto" of "", a
   * pre-SAK-100 Azure name, garbage) reads back as that default.
   */
  voiceName: string;

  // ---------- what the numbers mean (used everywhere) ----------
  /**
   * Clean runs needed to clear a confusion — after this, its old misses stop
   * feeding Patterns, Home's Confusions card, and Weakest 20. Counts only runs
   * that actually contained the pair's characters. Fast learners want this
   * lower; it is a judgement call, not a fact, so it is yours to set.
   */
  graduateRuns: number;

  // ---------- the session loop ----------
  /**
   * Minutes of rest before round 2, and before every round after that.
   *
   * TWO NUMBERS, ON PURPOSE. Not a first-rest plus a doubling factor, not a
   * curve, not a "spacing strategy" — the user asked to type 5 and 10, and
   * anything cleverer would be an algorithm they have to configure instead of
   * two facts they have to state. If they want 5 and 5, or 10 and 3, they type
   * that; nothing here has an opinion.
   */
  restFirstMin: number;
  restThenMin: number;
}

// ---------- selection: a query, not a set ----------

/**
 * WHAT YOU ARE ABOUT TO DRILL, as a QUESTION rather than as an answer.
 *
 * This replaced `QuizConfig.enabled: Record<string, boolean>` — one key per
 * selectable thing, persisted in full to localStorage. That model has two
 * deaths, and only one of them is technical:
 *
 *   - 214 keys is 4KB. 21,449 is 400KB+, rewritten on every single toggle.
 *   - "Tick what to drill" stops being a gesture anyone can make at 21,449
 *     items. Nobody ticks 21,449 checkboxes. The grid that made kana feel
 *     direct makes kanji feel impossible.
 *
 * So selection stopped being a stored SET and became a stored QUESTION, which
 * is a fixed handful of fields no matter how much material exists. A deck is
 * what you get when you press Drill on a filter.
 *
 * Every field NARROWS: an empty Selection means everything, and each populated
 * field intersects with the others. `resolve()` in src/lib/selection.ts is the
 * only thing that turns one of these into facts, and it is pure.
 */
export interface Selection {
  /** Subject ids to draw from ("kana", "kanji", "word"). Empty = all of them. */
  subjects: string[];
  /**
   * Practice-type ids to draw from — the finer-than-subject axis the Practice
   * page's TYPE chooser edits ("hiragana", "katakana", "counter", …). Empty =
   * all types, exactly as an empty `subjects` means all subjects. A type is a
   * PREDICATE over facts, not a field on one: `subject` "kana" is two types
   * (hiragana/katakana) and "word" is two (words/counters). See
   * src/lib/practice-types.ts — factType() computes it, resolve() filters on it.
   */
  types: string[];
  /** Bands to include, OR-ed together — a fact is in if it matches ANY of
   * them. Empty = no state filter. NOT a partition: `mixup` overlaps the
   * others, which is exactly why this is a set and not one value. */
  states: FactBand[];
  /** Free text matched against glyph, answers and meaning. Empty = no filter. */
  text: string;
  /**
   * Only facts that appeared in the session with this timestamp; null = no
   * restriction.
   *
   * This is the field that makes Rerun free. A past session is a named list of
   * keys like any other source, so "run that again" is not a feature with its
   * own button and its own code path — it is Drill on a slice, and it comes out
   * of the same resolve() as everything else.
   */
  session: number | null;
  /** Narrow to facts FIRST LEARNED within this window (see HistoryFile.learnedAt).
   *  from/to are ms epochs; null on either side = open-ended. Absent/null = no
   *  date filter — the same "empty field = everything" rule every other Selection
   *  field follows. Composes with states and types like any other narrowing. */
  learned?: { from: number | null; to: number | null } | null;
}

/**
 * How well you know something, as a WORD — the only vocabulary the UI has for
 * this.
 *
 * The user never sees "stability", "p", "weakness" or "fact". They see New,
 * Shaky, Slipping, Solid and Mix-ups, because those are things a person can
 * mean. The mapping from numbers to these words lives in ONE function
 * (`bandOf` in src/lib/selection.ts) so that when real scheduling lands it
 * changes there and nowhere else.
 *
 * NOT `FactState`, which is the MODEL's state — a stability and a lastTested —
 * and is the thing this is a word FOR. The two were written on separate
 * branches, both called FactState, and both were right about their own half:
 * one is what the model believes, the other is what a person is allowed to
 * read. They meet in `bandOf` and nowhere else, which is the point.
 */
export type FactBand =
  | "new"
  | "solid"
  | "getting-there"
  | "shaky"
  | "slipping"
  | "mixup";

// ---------- per-session stats (in-memory during a quiz) ----------

/**
 * How a showing was PRESENTED — the axes that decide the sentence a card read,
 * captured so the post-quiz screens can say "hear it → type the meaning" rather
 * than only naming the fact. A property of a SHOWING, not a fact: the same fact
 * can be asked more than one way (listening is rolled per showing, and the
 * direction can be too), so this records the LAST showing that resolved. See
 * src/lib/question-presentation.ts, which turns it into the chip label.
 */
export interface ShowingPresentation {
  dir: Direction;
  /** `mc` when the card offered a board, `typed` when it wanted a box. */
  mode: "mc" | "typed";
  /** An audio-prompt card: the word was played and its glyph hidden. */
  listen: boolean;
}

/** One fact's stats for one run. Keyed by FactId — see SessionStats. */
export interface FactSessionDetail {
  seen: number;
  misses: number;
  /** Did you land it at ALL this session — a yes/no over the whole run, which
   * the results boards ask ("never got it"). Not the same question as
   * `correct`, which counts how many of the showings you landed. */
  everCorrect: boolean;
  /**
   * Did you nail the FIRST showing — a yes/no over the whole run, asked by the
   * results boards ("did you ever get it cold"). At most 1 per fact per
   * session, ever, so it is NOT a count and must never be pooled against
   * `seen`: doing that divided a per-fact flag by a per-showing count and made
   * a perfect learner's accuracy fall to 50%, 33%, 25% as a fact repeated.
   * `firstTryCount` is the countable form; this stays the flag.
   */
  firstTryCorrect: boolean | null;
  /**
   * SHOWINGS answered right on the first attempt, with no hint — the strict
   * numerator, and the only one that shares `seen`'s unit. Incremented once per
   * qualifying showing (see engine.firstTryCredit), so it can exceed 1 and is
   * bounded above by `seen`.
   *
   * Absent on stats restored from a snapshot written before this field existed;
   * read it through `firstTryShowings()` in src/lib/first-try.ts rather than
   * directly, which derives the old value from `firstTryCorrect`.
   */
  firstTryCount: number;
  /**
   * SHOWINGS answered correctly this session — folds into FactAggregate.correct
   * and so into forgiving accuracy. Not the same question as `everCorrect`.
   */
  correct: number;
  /**
   * ENTRY you answered with instead → how many times. Keyed by EntryId, NOT
   * FactId, and that is the whole point: you mix up 生 with 先, not 生's
   * ON-reading-in-学生 with one of 先's readings. A confusion is a failure to
   * tell two things apart, and the things are entries.
   *
   * So this map and the map that contains it live in DIFFERENT key spaces.
   * Anything that reads across them must convert explicitly — see
   * `qualifies()` in src/lib/confusions.ts, whose signature exists to make that
   * conversion impossible to forget.
   */
  confused: Record<EntryId, number>;
  /**
   * How this fact's LAST resolved showing was presented — the input the results
   * and retry screens turn into "hear it → type the meaning". Optional: a stat
   * that never resolved a showing (a card put on screen and walked away from),
   * or one restored from a snapshot written before this field existed, has none,
   * and the screens fall back to naming the fact's type. Overwritten on each
   * resolution, so a fact asked several ways carries its most recent framing.
   */
  shown?: ShowingPresentation;
  /**
   * Every DISTINCT presentation this fact was resolved with this run, newest
   * last. Optional for backward compatibility with older snapshots.
   *
   * This keeps results from hiding listened variants when a later text card of
   * the same fact overwrites `shown`.
   */
  showns?: ShowingPresentation[];
  /** Distinct presentation phrases this fact was missed on this run. */
  missedPhrases?: string[];
  /** What the learner picked/typed on a missed phrase (latest per phrase). */
  saidByPhrase?: Record<string, string>;
}

/** One run's detail, keyed by FACT — the unit that can actually be graded. */
export type SessionStats = Record<FactId, FactSessionDetail>;
