// Shared types for the kana quiz.

// ---------- identity: entries and facts ----------
//
// A character string used to be three things at once: the identity, the
// display glyph, and the primary key. For 214 kana that is elegant. It breaks
// on kanji — and not on collisions, on GRANULARITY.
//
// `history.chars["生"]` held exactly ONE accuracy. 生 has ~11 readings. There
// was nowhere to put セイ-at-88% and ショウ-at-22%, so the app would report
// "生: 61%" — a number true of nothing — and then drill the reading you
// already own.
//
// So identity splits in two:
//
//   Entry — what you look up.  `kanji:生`, `word:先生`, `kana:し`.
//   Fact  — one thing you can be ASKED. 生 is 1 meaning + ~10 readings, each
//           reading keyed on (kanji, word) — never on the kanji alone, because
//           "what is the reading of 生" has eleven answers and cannot be graded.
//
// Facts key history, score accuracy, and feed drills. Entries are what you
// browse, and what confusions are paired by (you mix up 生 and 先, not one of
// 生's readings with one of 先's).
//
// BOTH IDS ARE OPAQUE. The grammar above is illustrative, not an API: ids are
// minted in src/lib/fact-id.ts and resolved by lookup in src/lib/facts.ts.
// Nothing else may parse one. The moment a call site does
// `id.startsWith("kana:")` the model is welded shut, and kanji / vocabulary /
// grammar / counters / whatever comes next becomes a special case instead of
// another row of data.
//
// The brands are load-bearing, in both directions:
//   - `Record<FactId, T>` will NOT accept a bare `string` index. Reaching into
//     history or a run's stats with an un-narrowed string is a compile error.
//   - a function taking `FactId[]` will not accept `EntryId[]`, or vice versa.
// `Object.keys()` still widens back to `string[]`; src/lib/facts.ts `factKeys`
// / `entryKeys` are the sanctioned places to restore the brand, so the cast is
// spelled in one file rather than at every walk.

declare const ENTRY_BRAND: unique symbol;
declare const FACT_BRAND: unique symbol;

/** What you look up. Opaque — mint with src/lib/fact-id.ts, resolve with
 * src/lib/facts.ts. Never parse one. */
export type EntryId = string & { readonly [ENTRY_BRAND]: true };

/** One askable thing — the unit history, accuracy and drilling are keyed by.
 * Opaque; see EntryId. */
export type FactId = string & { readonly [FACT_BRAND]: true };

/**
 * What a generic consumer is allowed to know about a fact.
 *
 * Subject-agnostic on purpose: a screen renders `glyph` and checks `answers`
 * without knowing whether it is looking at kana, a kanji reading, or a
 * conjugation.
 *
 * Deliberately THIN. Everything a subject knows about its own material —
 * kana's script and row, its mnemonics, a kanji's radicals — stays in that
 * subject's module (src/data/characters.ts and CHAR_INDEX, for kana) and is
 * read by that subject's own screens. Fields get promoted here when something
 * generic needs them, not in anticipation.
 */
export interface FactInfo {
  readonly id: FactId;
  /** The entry this fact belongs to. One entry, many facts. */
  readonly entry: EntryId;
  /** What the entry looks like on screen — し, 生, 先生. DISPLAY ONLY: it is
   * not an identity and two entries may legitimately share one. */
  readonly glyph: string;
  /** Accepted answers; the first is the canonical one to display. */
  readonly answers: readonly string[];
  /** Which subject minted this — "kana" today. Carried so that nobody has to
   * infer a subject by parsing an id. */
  readonly subject: string;
  readonly meaning: string | null;
}

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

// ---------- quiz config (localStorage "kanaquiz-cfg") ----------

export type QuizMode =
  | "drill"
  | "pairs"
  | "grid"
  | "assembly"
  | "substitution"
  | "listen-sentence";
export type Direction = "jp2en" | "en2jp";
export type AnswerStyle = "typed" | "mc";

/** Which accuracy number every screen shows — the same forgiving/strict split
 * the results screen already offers, hoisted to a global preference.
 * firstTry = nailed it immediately · attempt = share of attempts correct. */
export type AccuracyMetric = "firstTry" | "attempt";

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
  mode: QuizMode;
  dirs: { jp2en: boolean; en2jp: boolean };
  styleJp2en: AnswerStyle;
  styleEn2jp: AnswerStyle;
  length: "endless" | "limited";
  limType: "cov" | "count";
  limCount: number;
  retries: "none" | "lim" | "unl";
  retryN: number;
  timer: boolean;
  timerSec: number;
  showAnswer: boolean;
  scriptLabel: boolean;
  /** JP fonts to draw from per card — more than one selected = randomized. */
  fonts: string[];
  blurSubmit: boolean;
  voiceName: string;

  // ---------- listening (opt-in, word-only, never a gate) ----------
  /**
   * Hear a word, type its romaji — a new question type over the EXISTING word
   * reading facts. The prompt is audio only (no glyph), the answer is the
   * reading, graded on the forgiving romaji path. OFF by default: it appears
   * only when the learner turns it on here, and never blocks progression. See
   * src/lib/listen.ts for how a showing is chosen.
   */
  listenRomaji: boolean;
  /**
   * Hear a word, give its meaning — the same shape over the EXISTING word
   * meaning facts, graded like any meaning check. OFF by default, opt-in, and
   * non-gating, exactly like `listenRomaji`. Word-only: the owner ruled
   * sentence dictation out (romaji of a sentence is ambiguous, and there is no
   * sentence audio) — see tasks/22-the-four-skills.md.
   */
  listenMeaning: boolean;

  // ---------- what the numbers mean (used everywhere) ----------
  /** Drives the drill HUD pill, the Home deck rings, and the picker circles. */
  accuracyMetric: AccuracyMetric;
  /** Show practice volume next to accuracy, so 88%-from-4-tries can't lie. */
  showVolume: boolean;
  /**
   * Clean runs needed to clear a confusion — after this, its old misses stop
   * feeding Patterns, Home's Confusions card, and Weakest 20. Counts only runs
   * that actually contained the pair's characters. Fast learners want this
   * lower; it is a judgement call, not a fact, so it is yours to set.
   */
  graduateRuns: number;
  /**
   * Never flag a hesitation faster than this, however consistent you get.
   * The slow threshold is max(slowFloorMs, median + 3·MAD) over your recent
   * recall latencies — without a floor, a very fast, very steady run would
   * start flagging 1.6s answers as "slow", which means nothing.
   */
  slowFloorMs: number;

  // ---------- what arrives next ----------
  /**
   * Which order unseen kanji queue up in. See NewKanjiOrder, and
   * `kanjiTeachOrder` in src/data/kanji.ts for the three sequences themselves.
   */
  newKanjiOrder: NewKanjiOrder;
  /**
   * How long a kanji lesson should be, in draw+assembly cost — see LessonRange
   * and `kanjiCost` in src/lib/kanji-lesson.ts. A lesson fills toward `max` and
   * only ends below `min` when the next indivisible piece won't fit.
   *
   * TWO NUMBERS with an ORDER between them: `max` may never be below `min`.
   * That is enforced in two places — the Settings control and the config loader
   * (`clampLessonRange`) — so a hand-edited value can't reach the packer, which
   * has no defined behaviour for a ceiling under its floor.
   */
  lessonMinCost: number;
  lessonMaxCost: number;
  /**
   * How many NEW words a word lesson teaches — the words track's lesson size.
   *
   * A COUNT, not a cost range like kanji's: a word adds no new kanji, so there
   * is no draw+assembly work to size it, and a word is uniform and indivisible,
   * so there is no "bundle over the ceiling" case a max exists to flag. The
   * lesson is simply the next N teachable words. See WORDS_PER_LESSON_DEFAULT
   * and `nextWordLesson` in src/lib/word-lesson.ts.
   */
  wordsPerLesson: number;

  // ---------- the session loop (src/lib/session.ts) ----------
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

  // ---------- drill HUD (all off = zen, all on = instrumented) ----------
  showStreak: boolean;
  showAccuracy: boolean;
  showRetryPips: boolean;
  /** Fade End quiz / gear while drilling; they wake on mouse move. */
  fadeControls: boolean;
  /** What you are about to drill. See Selection — this replaced `enabled`, a
   * char→bool map with one key per selectable thing. */
  selection: Selection;
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
  /** A saved list's id, or null for "not restricted to a list". */
  list: string | null;
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
export type FactBand = "new" | "shaky" | "slipping" | "solid" | "mixup";

/**
 * A named list of things to drill. ONE OBJECT, FOUR SOURCES: an imported file,
 * a saved search, a past session, a built-in shelf. All of them are a name and
 * a way to get keys, and everything downstream — the sidebar, the drill bar,
 * resolve() — treats them identically.
 *
 * EXCEPT AT ONE MOMENT, and this is a real hole rather than a tidy-up. The
 * "one object" claim is true for READING a list and false for WRITING to one:
 *
 *   You CAN add か to "Core 2k". Core 2k is a fixed set of words; adding to it
 *   means the set now has か in it, forever, and that is the whole of what
 *   happened.
 *
 *   You CANNOT add か to "Kanji I miss". That is not a set, it is a RULE that
 *   recomputes every time you look at it. A hand-added item would either vanish
 *   the next time the rule ran, or silently freeze your live search into a
 *   frozen list without telling you. Both are lies.
 *
 * So there are two kinds, and the split is exactly "does a person or a rule
 * decide what is in it". Derived lists are simply not offered for writing —
 * they are one object with fixed lists everywhere else.
 */
export type SavedList =
  | {
      kind: "fixed";
      id: string;
      name: string;
      created: number;
      /** The set. ENTRIES, not facts: you file 生, not one of its readings. */
      entries: EntryId[];
      origin: "import" | "manual";
    }
  | {
      kind: "derived";
      id: string;
      name: string;
      created: number;
      /** The rule. Re-resolved on every read, which is why you cannot add to it. */
      query: Selection;
      origin: "search" | "session";
    };

export interface ListsFile {
  lists: SavedList[];
}

// ---------- per-session stats (in-memory during a quiz) ----------

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
  slow: number;
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
}

/** One run's detail, keyed by FACT — the unit that can actually be graded. */
export type SessionStats = Record<FactId, FactSessionDetail>;

// ---------- history.json shapes ----------

/**
 * What you have DONE with a fact — counts, and nothing but counts.
 *
 * Two units live here and must not be confused: `seen`, `firstTry` and
 * `correct` count SHOWINGS (the fact put on screen as a question), while
 * `missed` counts ATTEMPTS (one showing can produce several, so `missed` may
 * exceed `seen`).
 *
 * Both accuracies divide by `seen`, so they answer the same question about the
 * same population and only differ in what counts as a pass:
 *   strict    = firstTry / seen
 *   forgiving = correct  / seen
 *
 * EVERY FIELD IS A COUNT, which is exactly what makes this type poolable: add
 * two of them and you have counted a real, larger population of showings. That
 * is why it is its own type rather than part of FactAggregate — see FactState.
 */
export interface FactCounts {
  /** Times the fact was shown as a question. SHOWINGS. */
  seen: number;
  /** Wrong ATTEMPTS — can exceed `seen`, since one showing allows retries. */
  missed: number;
  slow: number;
  /**
   * SHOWINGS answered correctly on the first attempt — the strict numerator,
   * and in `seen`'s unit so the two can be divided. A fact shown three times
   * and nailed three times contributes 3, not 1.
   *
   * Records written before this was a count carry 0 or 1 here: the old writer
   * stored `firstTryCorrect ? 1 : 0`. Those are undercounts, not wrong units —
   * a 1 really was one first-try showing — so they pool without a migration.
   */
  firstTry: number;
  /**
   * SHOWINGS that ended in a correct answer, first try or after retries — the
   * forgiving numerator. A showing that ended with no correct answer (you ran
   * out of retries, ended the quiz early, or left a grid card blank) counts 0,
   * so it reads as never right rather than as a pass. The forgiving metric used
   * to be `seen / (seen + missed)`, which scored an unanswered showing 100%.
   */
  correct: number;
}

/**
 * One SESSION's counts for one fact — poolable counts, plus the one thing a
 * session knows that a pool cannot represent.
 *
 * `firstTry` answers "how many showings did you nail", which is a quantity and
 * survives being added to another session's. `firstTryHit` answers "did this
 * test occasion go well", which is a verdict on an occasion: add two of them
 * and the answer is not a bigger verdict, it is nothing. That is why it lives
 * here and not in FactCounts, whose whole claim is that every field is a count
 * (see the comment there) — the scheduler's input is the one thing about a
 * session that does not pool, so it is typed where it cannot be pooled.
 */
export interface SessionFactCounts extends FactCounts {
  /**
   * Did the session's FIRST showing of this fact land cold — the scheduler's
   * hit, and nothing else's. One session is one test occasion (see the header
   * of src/lib/aggregate.ts for why), so the model gets one verdict per session
   * however many times the requeue brought the fact back.
   *
   * Deliberately NOT derived from `firstTry > 0`, and the difference is real:
   * fluff the first showing, nail the requeue, and the count is 1 while the
   * verdict is false. Deriving would hand the model a pass for a fact you only
   * got right after being shown the answer — the exact leniency this field
   * exists to keep out of the schedule.
   *
   * Optional because records predate it. Absent means read `firstTry > 0`,
   * which on those records is the old flag and so is the old answer exactly;
   * see foldSession().
   */
  firstTryHit?: boolean;
}

/**
 * What the ranking model BELIEVES about one fact — its entire input, and the
 * whole memory of src/lib/scoring.ts.
 *
 * NOT POOLABLE, and that is why it is a separate type from FactCounts. Counts
 * sum; a belief does not. "The stability of hiragana basic" is not a quantity —
 * you hold 71 separate predictions, and adding them up answers nothing. This is
 * the same trap as an entry's accuracy in src/lib/accuracy.ts, one level down,
 * and it is closed the same way: `totalFor` returns FactCounts, so a pooled
 * thing has no `stability` field to read and reaching for one is a compile
 * error rather than a plausible number.
 *
 * NEVER RENDER EITHER FIELD. The user asked, of a real stability figure, "does
 * stability 106d mean I did that 106 days in a row?" — and that reading is the
 * honest one for anything a study app puts on screen next to a character. It is
 * a PREDICTION that reads as a HISTORY, and no caption fixes that. These two
 * numbers exist to order a list. The order is the only thing the user sees.
 */
export interface FactState {
  /**
   * Days until predicted recall of this fact falls to ~37% (1/e).
   *
   * A duration, not a due date. The distinction is the reason this app has its
   * own model at all: a due date is a promise the app cannot keep and the user
   * can fail, and it turns a study session into a debt. A stability is just how
   * fast the app's confidence decays, and it is only ever read as an ORDER.
   */
  stability: number;
  /**
   * ms epoch of the last session that tested this fact; 0 = never tested.
   *
   * WRITTEN ONLY BY EVIDENCE — a session you actually answered, at that
   * session's own timestamp. Nothing else may touch it. If browsing a chart, or
   * opening a screen, or the passage of time could write here, then the model's
   * clock would measure app usage rather than your memory, and `elapsedDays`
   * would silently stop meaning what its name says.
   */
  lastTested: number;
}

/**
 * One fact's stored record: what you did (counts) and what the model believes
 * (state). The key (a FactId) lives in the record that holds this, so the
 * aggregate itself carries no identity.
 *
 * The two halves are folded from the same evidence, in one place —
 * src/lib/aggregate.ts — but they are not the same KIND of thing, and the split
 * above is what keeps the difference from being a comment.
 */
export interface FactAggregate extends FactCounts, FactState {}

export interface QuizSessionRecord {
  /**
   * A unique id minted with the record, and the reason a lost response cannot
   * cost you a round.
   *
   * The client no longer posts a record and hopes. It queues it, posts it, and
   * keeps posting until the server says yes — which means a record whose
   * request arrived but whose RESPONSE did not will be sent again. Without an
   * identity the server has no way to tell that retry from a second, real round
   * with identical numbers, and would append both: every count in it doubled,
   * permanently, in the one file that is supposed to be the durable copy.
   *
   * `ts` cannot do this job. It is a wall-clock reading, two records made in the
   * same millisecond share one, and it is not what a retry is keyed on anywhere
   * else. So the identity is its own field and is opaque.
   *
   * Optional because every record written before this existed has none.
   * saveSession deduplicates only on a present id — see the note there.
   */
  id?: string;
  ts: number;
  mode: QuizMode;
  redrill: boolean;
  total: number;
  forgivingPct: number;
  strictPct: number;
  /**
   * What this run did, per fact. COUNTS, not aggregates — a session carries
   * EVIDENCE and never belief.
   *
   * A session has no `stability`: stability is not a thing that happened to
   * you on Tuesday, it is what the model concluded from every Tuesday so far,
   * and it exists only in the fold (src/lib/aggregate.ts). Nor a `lastTested`
   * — the session already has `ts`, which is the same fact stated once. Giving
   * a session a state field would invite exactly one bug, and it is the bad
   * one: some future writer stamping a stability here from a live clock, and
   * the replay in deleteSessions then disagreeing with the incremental fold in
   * saveSession about what the same file means.
   */
  facts: Record<FactId, SessionFactCounts>;
  /** Full per-fact detail; absent on summary-only sessions. */
  detail?: SessionStats;
  /**
   * The exact set this ran over, so Recent could run it again AS IT WAS.
   *
   * Stored rather than derived from `facts`: the facts are what you were
   * ASKED, and a session you left a quarter of the way through was asked a
   * quarter of its set. Rebuilding the set from the answers would silently
   * rerun a different, smaller session and call it the same one. Optional —
   * records written before this field existed don't get a Rerun button rather
   * than getting a wrong one.
   *
   * WRITTEN, NOT READ, AND THAT IS A KNOWN GAP. Results' Rerun resolves
   * `{session: ts}` instead, which reads `facts` — precisely the "smaller
   * session called the same one" this field was added to prevent. The two
   * behaviours arrived on different branches and both have a case; the field
   * is kept and correctly typed rather than deleted, because the argument
   * above is still right and the data is cheap. Whoever settles it should read
   * this comment and selection.resolve() together.
   *
   * `FactId[]`, not `string[]`: it used to be the latter, and since FactId is
   * a branded string, `planned: session.facts` type-checked while meaning
   * something else entirely. That is the same silent coercion that let the
   * whole runtime look char-keyed while carrying facts.
   */
  planned?: FactId[];
  /** How many rounds of the loop this session ran. Absent on one-off quizzes. */
  rounds?: number;
}

export interface HistoryFile {
  sessions: QuizSessionRecord[];
  /**
   * What you SAID you know, per fact: ms epoch of the claim. See
   * src/lib/claims.ts for what a claim is worth to the model.
   *
   * A THIRD RECORD, beside `sessions` and `facts`, and it has to be — not
   * because a claim is important, but because of what the other two are:
   *
   *   - `sessions` is what you DID. A claim isn't. Recording it as a session
   *     would put a 100% score on a fact you have never answered.
   *   - `facts` is DERIVED from `sessions` and gets REBUILT (see
   *     aggregate.foldSessions, called by history.deleteSessions). A claim
   *     written there survives until the first time you delete a session, and
   *     then silently doesn't.
   *
   * So it is stored raw and folded at read time by claims.effectiveState.
   * Deleting your history means discarding what you did; it must not discard
   * what you told the app about yourself.
   *
   * Spelled out here rather than imported as claims.ts's `Claims` alias, to
   * keep this module importing nothing — the alias is defined THERE, over this
   * shape, so the two cannot disagree without a type error at that end.
   */
  claims?: Record<FactId, number>;
  /**
   * What you asked to be QUIZZED on, per fact: ms epoch you said "quiz me". A
   * FOURTH record, and it exists for the same structural reason `claims` does —
   * it is neither something you DID (so it is not a session) nor something
   * DERIVED (so it does not live in `facts`, which gets rebuilt). A seen fact is
   * in your knowledge base and fair game to drill, on your word alone, before a
   * single answer proves anything.
   *
   * The difference from `claims` is the whole point, and it is a difference of
   * MEANING the model reads as a difference of STABILITY (see claims.seenState
   * vs claims.claimedState): "I already know these" is a season-long belief that
   * clears the material out of your way; "quiz me" is a glance that puts the
   * material into rotation and asks to be checked almost immediately. Both take
   * a fact out of `fresh` — neither is new any more — but one goes quiet and the
   * other stays drillable, which is exactly what routes the two intents apart.
   *
   * Stored raw and folded at read time by claims.effectiveState, and preserved
   * across deleteSessions for the same reason `claims` is: it is a thing you
   * SAID, not a thing you did.
   */
  seen?: Record<FactId, number>;
  /**
   * Per FACT: lifetime counts, and what the model believes. Was `chars`, keyed
   * by the character itself — which gave 生 one accuracy slot for eleven
   * readings.
   *
   * DERIVED, entirely, from `sessions` — src/lib/aggregate.ts is the fold, and
   * the only writer. It is stored rather than recomputed on read because
   * saveSession folds incrementally and the 200-session cap means the sessions
   * no longer say everything the aggregate knows.
   */
  facts: Record<FactId, FactAggregate>;
}
