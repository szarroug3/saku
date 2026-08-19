// The session loop, as data. No React, no clock, no storage — every function
// here is pure so the loop can be reasoned about (and tested) without mounting
// anything.
//
// THE LOOP
// ========
// You do the first round. At the end you can retry the misses, or pick your
// own subset — either way you come back to the same end-of-round screen. When
// you hit COMPLETE ROUND a rest starts. When it ends you run THE SAME WHOLE
// SESSION again — not just the bits you retried — and it repeats until you say
// you're done.
//
//   drilling ──finish──▶ round-complete ──retry──▶ drilling ──finish──┐
//                              │        ◀───────────────────────────── ┘
//                              │ complete round
//                              ▼
//                          resting ──start round──▶ drilling  (round + 1)
//                              │
//                              │ done for now
//                              ▼
//                           complete
//
// TWO NUMBERS, NOT A DOUBLING RULE
// ================================
// The first rest is 5 minutes and every rest after it is 10. Those are two
// plain settings the user types, NOT `first × 2` and not a curve. The user was
// explicit: they do not want to configure an algorithm, they want to type 5
// and 10. `restMinutes` below is the whole rule and it is four lines.
//
// THE REST IS A TIMESTAMP, NOT A PROCESS
// ======================================
// `restUntil` is an absolute ms timestamp written once when the round
// completes. Nothing runs. Close the tab, come back tomorrow, and the rest is
// simply over — the same read of the same number gives the same answer. A rest
// timer that broke when you closed the tab would be a bug; this one cannot
// have that bug, because there is nothing alive to break. Leaving during a
// rest is free: nothing is in flight.

// From the data-free module, not facts.ts: session.ts is on the always-mounted
// QuizSessionProvider's import path, and factKeys needs no fact registry.
import { factKeys } from "@/lib/fact-keys";
// Also from a data-free module, and for the same bundle reason as factKeys.
import { firstTryShowings } from "@/lib/first-try";
import type {
  FactId,
  FactSessionDetail,
  QuizSessionRecord,
  SessionStats,
} from "@/types";

import type { QuizSnapshot } from "@/lib/quiz-session-types";

export type SessionPhase =
  /** Round 1 only, and only when the budget put new material in the session:
   * the items you haven't met (or have comprehensively lost) are SHOWN, with
   * their answers, before anything is asked. See src/lib/budget.ts. */
  | "teaching"
  /**
   * A brand-new session with nothing to teach (a "Quiz me" start): the round
   * has not begun its first leg yet. This exists ONLY so that beginning it
   * happens from a settled render of /session, via the same `startFirstRound`
   * call the taught flow's own "Quiz me" button uses — never from the tick a
   * session is created, and never by improvising a second way to start a leg.
   * /session's mount effect is the only reader; nothing else should branch on
   * it, and no screen renders for it (same treatment as "drilling").
   *
   * THE BUG THIS PINS: a "Quiz me" session used to begin its leg in the same
   * startTransition as startSession itself — before /session (and its
   * "drilling with no leg means lost" guard) had ever mounted for this run.
   * Reaching /session for the first time only once the leg had already
   * finished put phase and leg out of step for exactly the window that guard
   * cannot tell apart from a genuinely lost leg, and the round-complete
   * screen it recovered to reported an untouched, empty `roundStats` despite
   * the learner having actually answered every card — a bogus "Round 1 · 0
   * forms" screen. Starting every session's first leg from the one place
   * ("starting") removes the second mechanism instead of teaching the guard
   * to tell the two states apart.
   */
  | "starting"
  /** A round (or a retry leg of one) is on screen. */
  | "drilling"
  /** The fork: retry misses, pick your own, or complete the round. */
  | "round-complete"
  /** The rest. A countdown and nothing else. */
  | "resting"
  /** Finished for good — the screen that says what you did. */
  | "complete";

/** What one finished round looked like. Summary only: this is what the
 * session-complete screen compares ("18 correct, up from 14"), so it holds
 * counts and never content. */
export interface RoundSummary {
  round: number;
  /** Facts asked in the round. */
  total: number;
  /** Facts landed at least once during the round, first try or after a retry. */
  correct: number;
  /** Facts missed at least once during the round. */
  missed: number;
}

export interface StudySession {
  /** The whole set, frozen at start. EVERY round re-runs exactly this — the
   * retry legs narrow the leg, never the session.
   *
   * This is what the BUDGET decided (src/lib/budget.ts): the ranked material
   * plus enough teach material to reach the length you asked for. It is not
   * simply "what you selected" — the selection is the pool the budget drew
   * from.
   *
   * FACTS, not characters. The budget always spoke facts; this field used to
   * take `string[]`, and because FactId is a branded string a FactId[] slid
   * into it with no complaint and no conversion — which is exactly how the
   * app came to have a session type that LOOKED char-keyed while carrying
   * facts. See src/lib/quiz-session.tsx. */
  facts: FactId[];
  /**
   * The subset of `facts` that was taught rather than asked cold — new to you,
   * or lost badly enough that the model can't tell the difference.
   *
   * Kept for the life of the session, not just the teaching phase, because the
   * session-complete screen's comparison is only honest if it knows which
   * items you had never seen when round 1 started.
   */
  teach: FactId[];
  /** What this session is, in words — frozen at start, same rule and same
   * reason as ActiveQuiz.what: the selection is a query over history, and
   * history moves the moment you answer anything. */
  what: string;
  /** Builder settings frozen at start, same rule as a one-off quiz. */
  snapshot: QuizSnapshot;
  startedAt: number;
  /** The round being drilled, or the one just finished. 1-based. */
  round: number;
  phase: SessionPhase;
  /**
   * Which item of the teach walk is on screen, 0-based — the teach phase's
   * cursor.
   *
   * On the session rather than in the /session page's local state, and that
   * move is the whole of the exact-position teach resume. The walk used to keep
   * its step in a `useState(0)` that reset on every remount, so a reload or a
   * cross-device teleport dropped the learner back on page 1 of a lesson they
   * were partway through. Persisted here, it rides the localStorage snapshot and
   * the synced blob exactly like `round` and the drill's runtime cursor do, so
   * the walk resumes on the page it was left on.
   *
   * Optional and read as 0: a session snapshotted before this field existed, and
   * a session that never entered the teach phase, both resume at the first item —
   * which is where the walk always started anyway. Clamped to the step count at
   * read time (session/page.tsx), so a lesson re-cut shorter under a stale cursor
   * lands on its last item rather than off the end.
   */
  teachStep?: number;
  /** When the rest ends, ms since epoch. Null unless `phase === "resting"`.
   * A stored number, never a running timer — see the header. */
  restUntil: number | null;
  /** The current round's stats, merged across its retry legs. */
  roundStats: SessionStats;
  /**
   * Facts this round MISSED and then got back on a later leg.
   *
   * The round's stats cannot answer this on their own. `roundStats` is a merge
   * across the legs, and the merge is deliberately lossy about WHEN: a fact you
   * missed cold and then nailed on the retry looks, afterwards, exactly like a
   * fact you missed cold and never re-asked (`misses > 0`, `everCorrect`,
   * `firstTryCorrect: false`). That is the whole of finding 1 — the retry left
   * no trace because there was nowhere for the trace to live.
   *
   * So the leg boundary writes it down, once, in `recoveredAfterLeg`. Optional
   * because a session snapshotted before this field existed comes back without
   * it; read it as `?? []`, which is what a resumed session honestly knows.
   *
   * Reset at every round start, alongside `roundStats`, for the same reason:
   * "you got it back" is a claim about THIS round's misses, and a stale entry
   * would suppress a retry offer you had not yet earned.
   */
  recovered?: FactId[];
  /** Every round so far. */
  rounds: RoundSummary[];
  /** Every round's stats merged — what gets written to history at the end. */
  totalStats: SessionStats;
  /** Last time an answer landed. Drives Home's Continue/Restart emphasis. */
  lastActiveAt: number;
  /** Where this session was started, so a resume surface can decide whether to
   * offer it. A curriculum lesson ("lesson", the default) is resumed from its
   * own Home card and MUST NOT double up on Practice; a Library "Teach me"
   * session ("library") has no card of its own, so Practice resumes it. Absent
   * on sessions snapshotted before this field existed — read those as "lesson",
   * which is what every session was until the Library grew a one-off Quiz. */
  origin?: SessionOrigin;
  /**
   * The seen marks this session's START laid down, kept so a DISCARD can take
   * them back and leave the frontier where it was.
   *
   * A lesson marks its own facts — and, for the curriculum spine, the kanji
   * readings its words prove — seen BEFORE the drill, which advances the Learn
   * frontier off them (see home-feed's startCurriculumLesson / quizMe). That is
   * right for a lesson you leave running or complete, and wrong for one you throw
   * away unscored: "it should not advance until I complete the session". So the
   * facts newly seen at start are recorded here and un-seen on discard (quiz-
   * session.tsx discardRun / discardSession → postUnseen), the exact inverse of
   * the start's write, reaching the server too so another device sees no advance.
   *
   * Only the marks the start actually ADDED — a reading already seen from an
   * earlier lesson is not listed, so rolling this back never revokes a unlock the
   * discarded lesson did not create. Absent/empty for a session that marked
   * nothing seen at start (a taught lesson's Start on non-curriculum tracks) and
   * for sessions snapshotted before this field existed; both roll back nothing.
   *
   * ALSO rolled back by `finishSession` itself now, when the session ends
   * WITHOUT the learner choosing "mark as known" — see sessionKnownClaimTarget
   * and the SAK-52 fix. A "Quiz me" run seeds this and used to keep the seen
   * mark forever once the run ended any way other than discard, which is what
   * let a missed quiz permanently drop its batch out of Learn: `isFactFresh`
   * only asks whether `lastTested` is nonzero, and a `seen` mark never expires
   * that field on its own (only its `stability` decays, which drives review
   * scheduling, not the new-lesson frontier). So finishing unscored now undoes
   * the same seed a discard would, and the batch is due again — undone for
   * real by the SAME write, not left to a decay that isFactFresh never reads.
   */
  seededSeen?: FactId[];
  /**
   * How many rounds THIS session runs before it reaches "complete" — stored
   * explicitly at start (see `effectiveRoundTarget`) rather than re-derived at
   * every check site, alongside `teach`/`facts`/`seededSeen` and for the same
   * reason: the session freezes its own shape at Start.
   *
   * A taught session (`teach` non-empty) runs the normal `SESSION_ROUND_TARGET`
   * (3). A "Quiz me" session started directly from a Learn card (no `teach`)
   * runs exactly ONE round: Sam's own quiz-taking behaviour is to stop after
   * the single round and expect the end-of-session choice right there, not
   * after three. See `initialSessionPhase` — the identical `teach.length`
   * signal decides both this and whether the session opens teaching or
   * "starting".
   *
   * Optional and read through `effectiveRoundTarget`/`roundTargetOf` so a
   * session snapshotted before this field existed falls back to the same
   * `teach.length` rule it would have been given at start.
   */
  roundTarget?: number;
  /**
   * A completed round's durable record, held here instead of committed —
   * ONLY for a single-round ("Quiz me") session whose one and only round just
   * closed. `closeRound` builds the record as it always does but, for this one
   * case, does not hand it to `commitRecord` yet: the round covers whatever
   * subset of the batch the learner actually answered, and whether that
   * subset's real results ever reach history is the learner's own explicit
   * choice on SessionComplete, not automatic. "I already know these" commits
   * it (see finishSession); "Take me to the lesson" discards it along with
   * the rest of the run, so a Quiz-me attempt abandoned mid-way leaves no
   * trace at all — not even for the items that were genuinely answered.
   *
   * Absent (or null) for every taught session, which commits at `closeRound`
   * exactly as it always did — this field only ever gets set on the one round
   * a `roundTarget: 1` session runs.
   */
  pendingRecord?: QuizSessionRecord | null;
  /** Minted once at startSession and carried unchanged onto every round's
   * persisted record (see QuizSessionRecord.sessionId) — what lets Recent
   * Sessions group a multi-round session's per-round rows back into the one
   * row a learner actually experienced. Optional only because a session
   * resumed from a snapshot written before this field existed has none; such
   * a session's rounds simply go on being their own, ungrouped rows, same as
   * before SAK-23. */
  sessionId?: string;
}

/** Who opened a session. See StudySession.origin. */
export type SessionOrigin = "lesson" | "library";

/**
 * Which phase a freshly created session begins in, from its teach set.
 *
 * A taught session shows the lesson first ("teaching"). A "Quiz me" session
 * has nothing to teach — but it must NOT begin drilling in the same breath it
 * is created; see the long note on `"starting"` above for why.
 */
export function initialSessionPhase(teach: FactId[]): SessionPhase {
  return teach.length > 0 ? "teaching" : "starting";
}

/**
 * Which of the two "Session complete" screens applies (SAK-52, the crossed-
 * screens fix): a lesson that TAUGHT before it quizzed (a non-empty teach set)
 * gets the taught screen — a selectable list of what was learned plus its own
 * "Quiz again"; a "Quiz me" run that skipped straight to the drill (teach
 * empty) gets the plain results screen plus "I know these" / "Take me to the
 * lesson".
 *
 * THE SAME SIGNAL initialSessionPhase ALREADY KEYS ON. `session.origin` does
 * NOT distinguish the two paths — both a taught lesson and a direct "Quiz me"
 * on the same track are `origin: "lesson"`. `teach` is what actually differs
 * between them, it is frozen at session start (see StudySession.teach), and it
 * is exactly the field initialSessionPhase already reads to choose "teaching"
 * vs "starting". Reusing it here, rather than inventing a second discriminator,
 * is what keeps "was this session taught" from being able to disagree with
 * itself between the start of the run and the end of it.
 */
export function isTaughtSession(session: Pick<StudySession, "teach">): boolean {
  return session.teach.length > 0;
}

/** The fixed number of rounds a TAUGHT session runs. See `effectiveRoundTarget`
 * for the one exception (a "Quiz me" session started with no `teach`, which
 * runs exactly one round) — this constant is never compared against directly
 * outside this file; every check site reads `roundTargetOf` instead. */
export const SESSION_ROUND_TARGET = 3;

/** How many rounds a session with this `teach` set should run, computed once
 * at Start and stored on the session (`StudySession.roundTarget`) — see the
 * field doc for why a direct Quiz-me runs exactly one round. */
export function effectiveRoundTarget(teach: FactId[]): number {
  return teach.length > 0 ? SESSION_ROUND_TARGET : 1;
}

/** A session's actual round target: the stored field, or (for a session
 * snapshotted before the field existed) the same rule it would have been
 * given at start. Every completeRound/startNextRound/round-label check reads
 * THIS, never `SESSION_ROUND_TARGET` directly, so a single-round Quiz-me
 * session is never held to the taught session's three rounds. */
export function roundTargetOf(
  session: Pick<StudySession, "roundTarget" | "teach">,
): number {
  return session.roundTarget ?? effectiveRoundTarget(session.teach);
}

/**
 * How long the rest before `nextRound` is, in minutes.
 *
 * Two settings, read straight through. The first rest (the one before round 2)
 * is `firstMin`; every rest after it is `thenMin`. There is no third case and
 * no arithmetic — that is the entire design and it is why this takes two
 * numbers instead of a growth factor.
 */
export function restMinutes(
  nextRound: number,
  firstMin: number,
  thenMin: number,
): number {
  return nextRound <= 2 ? firstMin : thenMin;
}

/** Milliseconds left in the rest — 0 once it's over. Pure: the caller reads
 * the clock and passes it, so the same `now` gives the same answer forever. */
export function restLeftMs(session: StudySession, now: number): number {
  if (session.restUntil === null) return 0;
  return Math.max(0, session.restUntil - now);
}

/** Is the rest over (or was there never one)? */
export function restIsOver(session: StudySession, now: number): boolean {
  return restLeftMs(session, now) === 0;
}

/** "3:18" — the only thing the rest screen says. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "3:47 PM" — the wall-clock time the rest ends, in the browser's timezone. */
export function formatReturnTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------- stats merging ----------

function emptyStat(): FactSessionDetail {
  return {
    seen: 0,
    misses: 0,
    everCorrect: false,
    firstTryCorrect: null,
    firstTryCount: 0,
    correct: 0,
    confused: {},
    showns: [],
    missedPhrases: [],
    saidByPhrase: {},
  };
}

/**
 * Fold `from` into `into`, returning a new SessionStats.
 *
 * The one rule worth stating: `firstTryCorrect` is NEVER overwritten once set.
 * It is a question about the FIRST time you were asked, and a retry leg (or a
 * later round) is by definition not that. Merging it the other way would let
 * round three quietly rewrite how you did cold in round one, which is the one
 * number in the app that has to stay honest.
 *
 * Everything else sums, because everything else is a count of events and the
 * events all really happened. `firstTryCount` is one of those: it is the FLAG's
 * countable twin — first-try-correct SHOWINGS — and it sums precisely because
 * it is not asking the flag's question. The two are merged by different rules
 * on purpose, and that pair is what src/lib/session.test.ts pins.
 */
export function mergeStats(into: SessionStats, from: SessionStats): SessionStats {
  const out: SessionStats = {};
  for (const f of factKeys(into)) {
    out[f] = {
      ...into[f],
      // Normalised on the way in, not defaulted at every `+=`: a stat restored
      // from a pre-`firstTryCount` snapshot has no such field, and
      // `undefined + n` is NaN — which would spread from here into the live
      // pill and every merge after it. See firstTryShowings().
      firstTryCount: firstTryShowings(into[f]),
      confused: { ...into[f].confused },
      showns: (into[f].showns ?? (into[f].shown ? [into[f].shown] : [])).slice(),
      missedPhrases: (into[f].missedPhrases ?? []).slice(),
      saidByPhrase: { ...(into[f].saidByPhrase ?? {}) },
    };
  }
  for (const f of factKeys(from)) {
    const src = from[f];
    const dst = out[f] ?? (out[f] = emptyStat());
    dst.seen += src.seen;
    dst.misses += src.misses;
    dst.correct += src.correct;
    dst.firstTryCount += firstTryShowings(src);
    dst.everCorrect = dst.everCorrect || src.everCorrect;
    // First time asked wins, forever. See above.
    if (dst.firstTryCorrect === null) dst.firstTryCorrect = src.firstTryCorrect;
    // Presentation is the opposite rule to the flag: the LATEST showing wins, so
    // the chip names how the fact was most recently asked. `from` is the newer
    // leg/round in every caller, so it overwrites when it has one. Not a count,
    // so it sits outside the additive fields and the commutativity they promise.
    if (src.shown) dst.shown = src.shown;
    const mergedShowings = [
      ...(dst.showns ?? []),
      ...(src.showns ?? (src.shown ? [src.shown] : [])),
    ];
    if (mergedShowings.length) {
      const seen = new Set<string>();
      dst.showns = [];
      for (const s of mergedShowings) {
        const key = `${s.dir}|${s.mode}|${s.listen ? 1 : 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dst.showns.push(s);
      }
    }
    for (const e of Object.keys(src.confused)) {
      const key = e as keyof typeof src.confused;
      dst.confused[key] = (dst.confused[key] ?? 0) + src.confused[key];
    }
    if (src.missedPhrases?.length) {
      const seen = new Set(dst.missedPhrases ?? []);
      const merged = dst.missedPhrases ?? [];
      for (const phrase of src.missedPhrases) {
        if (seen.has(phrase)) continue;
        seen.add(phrase);
        merged.push(phrase);
      }
      dst.missedPhrases = merged;
    }
    if (src.saidByPhrase) {
      dst.saidByPhrase = {
        ...(dst.saidByPhrase ?? {}),
        ...src.saidByPhrase,
      };
    }
  }
  return out;
}

/** Facts missed at least once, or never landed — what "Retry the misses"
 * re-asks. Ordered most-missed first. */
export function missedInRound(stats: SessionStats): FactId[] {
  return factKeys(stats)
    .filter((f) => stats[f].misses > 0 || !stats[f].everCorrect)
    .sort((a, b) => stats[b].misses - stats[a].misses);
}

/**
 * The round's recovered set after one leg finishes: what you had already got
 * back, minus anything this leg put back in doubt, plus what this leg landed
 * clean.
 *
 * Three rules, and the middle one is the reason this is a fold over `prev`
 * rather than a look at the last leg alone:
 *
 *   - a fact this leg ASKED is dropped from `prev` first, so clearing it in
 *     leg 2 and fumbling it again in leg 3 leaves it outstanding. The latest
 *     leg is the one that gets to speak about a fact it asked.
 *   - a fact this leg did NOT ask keeps whatever it earned earlier. Retry two
 *     misses, clear both, then retry only one of them: the other is still back.
 *   - clean means clean: landed with no miss in this leg. Getting there on the
 *     second attempt of the retry is not "you got it back", and pretending
 *     otherwise would take the offer away from the fact that most wants it.
 *
 * Leg 1 needs no special case. It asks everything, so every clean fact enters
 * the set — and none of them are in the round's miss list, which is the only
 * place this set is ever read against.
 */
export function recoveredAfterLeg(
  prev: readonly FactId[],
  legStats: SessionStats,
): FactId[] {
  const asked = factKeys(legStats);
  const askedSet = new Set<FactId>(asked);
  const out = prev.filter((f) => !askedSet.has(f));
  for (const f of asked) {
    const st = legStats[f];
    if (st.misses === 0 && st.everCorrect) out.push(f);
  }
  return out;
}

// heldAtRoundEnd() WAS HERE. It listed the facts you walked away holding, to
// feed the round-complete stability floor. Both are gone: the floor is already
// applied, unconditionally, inside scoring.review() — see the long note on
// `closeRound` in quiz-session.tsx. The loop writes no scoring state, so it
// needs no population to write it for.

/**
 * What the round-complete screen shows — deliberately fed from TWO sources,
 * and the whole point of this function is to keep them from being confused.
 *
 * - `selection` is the FULL drill: `session.facts`, frozen at session start and
 *   never shrunk to what you reached. It is what "Pick what to retry" offers,
 *   so ending a round early (answered 1 of 9) still lets you pick any of the 9.
 *   See the field doc on `StudySession.facts`: retry legs narrow the leg, never
 *   the session, so this is the full selection in every leg.
 *
 * - `answered`, `total`, `firstTry` and `needAnother` describe the round you
 *   actually PLAYED: the facts in `roundStats`. The header counts these because
 *   they are honest about what happened — the items you never reached were not
 *   "missed," and inflating the header to the full selection would claim a
 *   round you didn't run.
 *
 * THE HEADER COUNTS SHOWINGS, AND THAT IS WHY IT ADDS UP
 * ======================================================
 * It used to count FACTS, all three of them, and still printed a line that read
 * as arithmetic: "5 questions · 4 right first try · 2 missed". Six from five.
 * `total` was unique facts, `firstTry` was the per-round FLAG (`firstTryCorrect`
 * — one fact, one vote) and `missed` was `missedInRound`, which counts a fact
 * that was fine cold and fumbled on a later leg. Three different questions, one
 * sentence, no denominator any of them shared.
 *
 * All three are now SHOWINGS, the unit task 03 settled on:
 *
 *     total       = Σ seen              every question the round asked
 *     firstTry    = Σ firstTryShowings  the ones you landed cold, via first-try.ts
 *     needAnother = total - firstTry    by construction, so the line sums
 *
 * `needAnother` is a subtraction and not its own tally on purpose: a third
 * independent count is exactly how the first line stopped adding up. It is also
 * why it is not called "missed" — a hint-assisted answer and a second-attempt
 * answer both land in it, and neither is a miss. It says what it counts.
 *
 * A leg adds showings to the round, so retrying moves these numbers. That is
 * finding 1's fix in its cheapest form: a perfect retry raises `total` and
 * `firstTry` together and the header cannot look identical afterwards.
 *
 * `missed` is the misses of the answered round (`missedInRound`), unchanged and
 * still historical: you did miss these, and a later leg does not get to edit
 * that. `recovered` and `outstanding` split it by what is still TRUE NOW, and
 * `outstanding` is what the picker offers.
 */
export function roundCompleteView(session: StudySession): {
  selection: FactId[];
  answered: FactId[];
  missed: FactId[];
  /** Missed this round, then got back on a later leg. Historical fact kept,
   * actionable offer withdrawn. */
  recovered: FactId[];
  /** Missed this round and not yet got back — what the picker pre-ticks. */
  outstanding: FactId[];
  total: number;
  firstTry: number;
  needAnother: number;
} {
  const stats = session.roundStats;
  const answered = factKeys(stats);
  const missed = missedInRound(stats);
  const back = new Set(session.recovered ?? []);
  const total = answered.reduce((n, f) => n + stats[f].seen, 0);
  const firstTry = answered.reduce((n, f) => n + firstTryShowings(stats[f]), 0);
  return {
    selection: session.facts,
    answered,
    missed,
    recovered: missed.filter((f) => back.has(f)),
    outstanding: missed.filter((f) => !back.has(f)),
    total,
    firstTry,
    needAnother: total - firstTry,
  };
}

/**
 * Which facts "I already know these" claims when a session ends — the SAME
 * mechanism as the Learn card's own "I already know this" (postClaim), reached
 * from the end-of-session choice instead.
 *
 * The candidate set is `teach` when it is non-empty (a taught lesson's own
 * material), else `facts` (a "Quiz me" session, which has nothing in `teach`).
 * But the claim NARROWS to whatever of that set was never actually answered
 * this session — `totalStats` (every round's stats, banked at each
 * `closeRound`) says exactly which facts have real recorded results. An
 * answered fact keeps whatever standing its real performance earned; claiming
 * it too would silently overwrite a real result with a blind "known", which is
 * the one thing a claim must never do (see src/lib/claims.ts — a claim clears
 * the learner's PATH, it does not get to overwrite what the learner actually
 * proved).
 *
 * Worked example (SAK-52): a 5-item kana lesson, quizzed directly from Learn.
 * The learner answers 2 of 5 (a, e) in the single round, then ends and hits "I
 * already know these": `teach` is empty (a direct Quiz-me marks seen instead of
 * teaching), so the candidate set is `facts` (all 5); `totalStats` holds a and
 * e, so the claim narrows to the 3 that were never asked (i, u, o). a and e
 * keep their real quiz results, already committed by `closeRound`.
 */
export function sessionKnownClaimTarget(
  session: Pick<StudySession, "teach" | "facts" | "totalStats">,
): FactId[] {
  const target = session.teach.length ? session.teach : session.facts;
  const answered = new Set(factKeys(session.totalStats));
  return target.filter((f) => !answered.has(f));
}

/** Summarise the round that just ended. */
export function summariseRound(round: number, stats: SessionStats): RoundSummary {
  const facts = factKeys(stats);
  return {
    round,
    total: facts.length,
    correct: facts.filter((f) => stats[f].everCorrect).length,
    missed: facts.filter((f) => stats[f].misses > 0).length,
  };
}

/**
 * Is `last` honestly indistinguishable from `first` — the comparison
 * session-complete's recap needs before it can say "the same as you
 * started"?
 *
 * `correct` ALONE cannot answer this. It is `everCorrect`, a monotonic OR
 * over a round's retry legs (see resolveShowing in drill-stats.ts): a round
 * that missed a fact and then recovered it on a later leg, before the round
 * ended, reads identically on `correct` to a round that never missed the
 * fact at all — both land on `correct: total`. `missed` (facts that took at
 * least one miss this round) is what actually tells the two apart, and it is
 * already computed alongside `correct` in summariseRound, so this only has
 * to check both.
 *
 * The bug this fixes: a session where round 1 missed a fact and recovered it
 * mid-round, then a later round matched round 1's final tally, had the recap
 * claim nothing changed — because the only thing it compared, `correct`,
 * genuinely hadn't. See SAK-21.
 */
export function sameAsStarted(first: RoundSummary, last: RoundSummary): boolean {
  return last.correct === first.correct && last.missed === first.missed;
}

// ---------- coming back ----------

/**
 * One day, in ms — BORROWED, not invented. It is the same day
 * `SCORING.floorDays` uses, which is the only day the model has an opinion
 * about. A session left overnight is one the model would already have decided
 * needs another look.
 *
 * This is why the Restart/Continue emphasis earns no setting: both of its
 * thresholds already exist somewhere else in the app. A third number the user
 * has to think about would be a worse app, not a more configurable one.
 */
export const COLD_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Has the session gone cold? Drives WHICH of Home's two buttons is emphasised
 * — never whether they exist. Both are always there and neither ever moves;
 * only the emphasis swaps, once, and a sentence says why.
 */
export function isCold(session: StudySession, now: number): boolean {
  return now - session.lastActiveAt >= COLD_AFTER_MS;
}
