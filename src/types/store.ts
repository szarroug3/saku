// The store's row shapes: what is actually written to a learner's `progress`
// row and read back — the history document, the per-fact aggregate the
// progress_facts table holds, one finished session's record, and the
// server-synced settings blob.
//
// Everything here is DURABLE, which is why it is apart: a field cannot leave
// one of these types without a story about the rows that already carry it (see
// HistoryFile's own notes, and normalizeConfig in quiz-config.tsx for how a
// config field leaves). The Sky's in-flight shapes are sky.ts, and the arrow
// only points this way: a stored record carries two of them whole
// (`SettingsFile.cfg`, `QuizSessionRecord.detail`) and sky.ts names nothing
// from here. Split out of a 923-line src/types/index.ts in SAK-407; read
// through @/types.

import type { FactId } from "./facts";
import type { QuizConfig, QuizMode, SessionStats } from "./sky";

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

/** The binary result of one completed run that included a fact. */
export interface RunVerdict {
  firstTry: boolean;
  eventually: boolean;
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
export interface FactAggregate extends FactCounts, FactState {
  /** Oldest → newest, capped at the ten most recent runs containing this fact. */
  recentRuns?: RunVerdict[];
}

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
  /**
   * Links this record to every OTHER round of the same multi-round session —
   * minted once, on the StudySession, at startSession, and carried unchanged
   * onto every round's record as closeRound commits it (see quiz-session.tsx).
   *
   * EXISTS FOR GROUPING, NOT FOR WRITE-TIME MERGING. A completed round is
   * still the durable commit unit (closeRound writes one record per round, on
   * purpose — see the note there): abandoning a session between rounds must
   * not lose the rounds already finished, the exact bug that made per-round
   * commits necessary in the first place. What `sessionId` fixes is a
   * DIFFERENT bug (SAK-23): a completed multi-round session showed up in
   * Recent Sessions as one row per round, each with that round's own
   * (therefore wrong-looking) count and score. `session-rows.ts`'s
   * `buildSessionListRows` groups records sharing a `sessionId` into a single
   * display row with the real counts and score summed across the group — a
   * read-side view, not a change to what gets written or folded.
   *
   * Absent on a one-off quiz (no rounds to link) and on any record written
   * before this field existed; both read as their own, ungrouped row, which is
   * what they always were.
   */
  sessionId?: string;
}

export interface HistoryFile {
  sessions: QuizSessionRecord[];
  /**
   * Confusion pairs the learner explicitly retired early, keyed by the
   * canonical pair key from lib/confusions and valued with the write time.
   *
   * Sessions at or before the marker no longer feed that pair's open record.
   * A later mix-up starts a fresh record, so "Clear now" forgives the typo
   * without making the pair impossible to detect again.
   */
  clearedMixups?: Record<string, number>;
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
   * WHAT THIS MEANS NOW (SAK-378). The name and the story below are the old
   * app's: a "quiz me" button the learner pressed on material they wanted asked.
   * The Sky has no such button. It writes this when a star is OPENED in a lesson
   * (`seeId` in src/app/(sky)/writes.ts), and reads it back through
   * `factStanding` in learner.ts as "in your knowledge base, untested".
   *
   * The two intents are not the same thing, and the model gets away with it
   * because it only ever asks this field one question: is this fact in rotation
   * and due to be asked soon? "Quiz me" and "I read this in a lesson" both
   * answer yes. If anything ever needs to tell them apart, this is the field
   * that has to split first.
   *
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
  /** Per FACT: ms epoch the fact was FIRST learned — the earliest moment it
   *  entered the knowledge base (first "quiz me", first claim, or first session
   *  that tested it). WRITE-ONCE / KEEP-EARLIEST: unlike `seen`/`claims`, which
   *  move their timestamp forward on re-record, this only ever moves earlier, so
   *  it answers "when did I first meet this" for the Practice date filter.
   *
   *  NOTHING ASKS IT THAT ANY MORE (SAK-378). The date filter went with the old
   *  Practice screen, and the one reader left is `resolve`'s date window in
   *  src/lib/selection.ts, which no live path calls. Every history write still
   *  maintains the map (history-ops.ts), so the cost is a timestamp per fact on
   *  every write and a growing map in the row, paid for a question no screen
   *  asks. Left in place rather than dropped: it is write-once and keep-earliest,
   *  so it cannot be rebuilt accurately once thrown away, and a learner's first
   *  meeting with a word is the kind of thing a Sky screen may well want back.
   *
   *  Backfilled best-effort for history predating this field (see the normalizers
   *  and deriveLearnedAt); a fact whose only sessions were evicted by the
   *  200-session cap can only recover a learnedAt from `seen`/`claims`. */
  learnedAt?: Record<FactId, number>;
  /**
   * Per FACT: lifetime counts, and what the model believes. Was `chars`, keyed
   * by the character itself — which gave 生 one accuracy slot for eleven
   * readings.
   *
   * DERIVED from `sessions` — src/lib/aggregate.ts is the fold, and the only
   * writer. Stored rather than recomputed on read because saveSession folds
   * incrementally.
   *
   * AND THE INCREMENTAL FOLD WINS OVER A REPLAY, which is worth saying because
   * two true sentences about this field contradict each other. `sessions` is
   * capped at 200 (see history.saveSession), so past that cap this map holds
   * contributions from sessions that are no longer in the file, and no replay
   * can recover them. `deleteSessions` nevertheless REBUILDS this map by
   * folding the survivors, which is the Sessions page's "Forget this session":
   * forgetting one session also silently drops whatever the evicted ones had
   * contributed. That is the accepted cost of an honest delete — a learner who
   * asks for a session to be forgotten gets an aggregate that no longer counts
   * it — and it is why `deleteSessions` refuses to rebuild for a request that
   * selects nothing. On a signed-in account this map lives in the
   * `progress_facts` table rather than here (SAK-237); the rule is the same
   * either way.
   */
  facts: Record<FactId, FactAggregate>;
}

// ---------- settings (server-synced preferences) ----------
//
// The learner's PREFERENCES, as one server-persisted blob — the third jsonb on
// the `progress` row beside `history` and `lists`. The server is the source of
// truth; localStorage holds a per-field cache purely so the app can paint
// before the server answers. See src/lib/settings.ts (server read/write) and
// src/lib/settings-provider.tsx (client seed + reconcile).
//
// Every field is OPTIONAL and absence means "this learner never set it, use the
// app default". That is what lets a partial write (a single POST that saves one
// practice recipe) merge into the stored blob without disturbing the rest, and
// it is what keeps an older/empty settings row reading as a valid set of
// defaults.
//
// Two fields, and both are whole values the client owns. The seven the old app
// stored beside them (theme, appearance, accents, the claim hint, the two lesson
// folds and the shown intros) went with its screens (SAK-374); a row written
// before then keeps them until its next save, when the normalizer drops them.
export interface SettingsFile {
  /** Quiz configuration — the whole QuizConfig, same shape the client holds. */
  cfg?: QuizConfig;
  /** Practice's own keepsakes (SAK-342): the saved recipes, and the misses
   * practice notes for its own ordering. Never the schedule's business; kept
   * here so they follow the learner across devices like every setting. The
   * recipe's shape is the Sky's (`src/sky/lib/practice.ts`), opaque here. */
  practice?: PracticeFile;
}

export interface PracticeFile {
  saved?: { name: string; recipe: unknown }[];
  misses?: Record<string, number>;
}
