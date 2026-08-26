"use client";

// The session loop's non-drilling screens: the fork, the rest, and the end.
// Drilling itself is still /quiz — this route is everything BETWEEN rounds.
//
// One route for three phases rather than three routes, because they are three
// states of one object and the phase is already in the session. Three routes
// would mean three chances for the URL and the state to disagree, and the URL
// would be the one lying.

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";

import { Dock } from "@/components/dock";
import { RestScreen } from "@/components/session/rest-screen";
import { SessionComplete } from "@/components/session/session-complete";
import {
  SentenceRuleEntryView,
  sentenceRuleEntrySteps,
  type SentenceOrderingTierId,
} from "@/components/library/sentence-rule-entry-view";
import { LessonRail } from "@/components/session/lesson-rail";
import { SessionHud } from "@/components/session/session-hud";
import { TeachWalk } from "@/components/session/teach-walk";
import { Btn, SmallBtn } from "@/components/ui";
import { preloadQuizScreen } from "@/components/quiz/quiz-mode-screen";
import { useHistory } from "@/lib/use-history";
import { browserStore, markConceptCardsShown, shownIntros } from "@/lib/intro-shown";
import {
  getTeachTrackLabel,
  resolveLessonSteps,
} from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import { groupOfFact, widerScope } from "@/lib/lesson";
import type { LessonStep } from "@/lib/lesson-steps";
import { restLeftMs, roundTargetOf } from "@/lib/session";
import { useNow } from "@/lib/use-now";
import { useQuizSession } from "@/lib/quiz-session";

/** Same stable-empty-while-loading contract as teach-walk.tsx's own copy. */
const EMPTY_STEPS: readonly LessonStep[] = [];

const SENTENCE_TIER_IDS: readonly SentenceOrderingTierId[] = [
  "simple",
  "conditional",
  "causal",
  "obligation",
  "sequential",
  "desire",
  "giving",
  "reported",
  "contrast",
  "request",
];

function sentenceTierFromLabel(what: string): SentenceOrderingTierId {
  const prefix = "Sentence ordering · tier ";
  if (!what.startsWith(prefix)) return "simple";
  const id = what.slice(prefix.length).trim() as SentenceOrderingTierId;
  return SENTENCE_TIER_IDS.includes(id) ? id : "simple";
}

// RoundComplete owns the detailed results table. That table reaches the grammar
// question engine, which reaches the full sentence corpus; loading it with the
// teaching screen made every Start download and parse roughly 2 MB of results-
// only data before the first lesson card could appear. Keep it as a separate
// chunk and pay for it only after a round has actually ended.
const RoundComplete = dynamic(
  () =>
    import("@/components/session/round-complete").then(
      (module) => module.RoundComplete,
    ),
  {
    loading: () => (
      <p className="text-[13px] text-text-muted">Loading round results…</p>
    ),
  },
);

/** Left / right arrow keys drive the teach walk's Back / forward, so paging
 * through a lesson needs no mouse. Rendered only in the teach phase, so the keys
 * are live exactly while the walk is — never over a drill or a text field (it
 * ignores keydowns whose target is an input/textarea/select, and lets modified
 * chords through so browser shortcuts still work). Its own component so its
 * effect can sit below the phase's early returns without breaking hook order. */
function TeachKeys({
  onBack,
  onForward,
  canBack,
}: {
  onBack: () => void;
  /** Advance a step. Omitted on the last card so → never starts the quiz. */
  onForward?: () => void;
  canBack: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      if (t?.isContentEditable) return;
      if (e.key === "ArrowLeft") {
        if (!canBack) return;
        e.preventDefault();
        onBack();
      } else if (e.key === "ArrowRight") {
        if (!onForward) return;
        e.preventDefault();
        onForward();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onForward, canBack]);
  return null;
}

export default function SessionPage() {
  const router = useRouter();
  const {
    active,
    session,
    restored,
    retryLeg,
    completeRound,
    startNextRound,
    pauseSession,
    endSession,
    finishSession,
    startFirstRound,
    startSession,
    resumeRound,
    setTeachStep,
    recoverLostLeg,
  } = useQuizSession();
  const { history } = useHistory();

  // One clock for the rest screen and the bar above it — see use-now.ts.
  // Hooks can't be called conditionally, so it ticks whenever the phase is
  // resting and is simply unread otherwise.
  const now = useNow(session?.phase === "resting");

  // Where the teach walk is, lifted here so the top HUD bar can show the
  // position ("N of M") — the walk itself no longer prints it. The steps are
  // the walk's own units (facts collapsed per glyph, plus any phase intro that
  // opens or closes the lesson), so we derive them from the same helper it
  // uses — one count, one source, no chance of "1 of 5" over a six-step walk.
  //
  // History is read here too, because a TRACK intro is a function of what the
  // learner has already met and not of the teach set alone (see
  // src/lib/track-open.ts). It joins the memo key so the count re-derives when
  // history does — the walk below reads the same two inputs, so the two cannot
  // disagree about how many steps there are.
  const teachKey = session ? session.teach.join(",") : "";
  // Which concept cards this learner has already been shown. Read per lesson and
  // held still for the whole walk: the steps are derived from it, so a value that
  // moved mid-walk would take a card off the screen the learner was reading and
  // shift every step behind it. It is written only on the way OUT (see toDrill).
  //
  // Safe to read during render even though it touches localStorage: the teaching
  // UI renders only once a session has been restored, which happens after mount,
  // so the server and the first client paint both see no walk at all.
  const shownCards = useMemo(
    () => shownIntros(browserStore()),
    [teachKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // SAK-104: lessonSteps reads guarded dictionaries transitively — see
  // teach-walk.tsx's own resolveLessonSteps note. shownCards flattens to an
  // array to cross the Server Action boundary (a Set doesn't serialize).
  const shownCardsArgs = useMemo(() => [...shownCards], [shownCards]);
  const teachItems =
    useServerLookup(
      resolveLessonSteps,
      session ? [session.teach, history, shownCardsArgs] : null,
    ) ?? EMPTY_STEPS;
  // SAK-104: factInfo reads lib/facts.ts (server-only), so the teach set's
  // subject label (used by the top bar below) is fetched once per lesson
  // rather than imported directly.
  const teachHeadFact = session?.teach.length ? session.teach[0] : null;
  const teachHeadTrackLabel = useServerLookup(
    getTeachTrackLabel,
    teachHeadFact ? [teachHeadFact] : null,
  );
  // Where the walk is now lives on the SESSION (session.teachStep), not in this
  // page's local state, so a reload or a cross-device teleport resumes on the
  // page the learner left rather than restarting at item 1 — the exact-position
  // teach resume. See StudySession.teachStep and setTeachStep. A fresh session
  // has no teachStep and reads as 0; a session's teach set never changes under
  // one session object, so the walk needs no in-page reset key any more (a new
  // session is a new object that starts at 0 on its own).
  const teachStep = session?.teachStep ?? 0;

  // No session (deep link, or a refresh with nothing stored) → Home. Wait for
  // the restore, or a refresh mid-rest would bounce you off your own break.
  //
  // EXCEPT when we just pressed "Complete session": finishSession nulls the
  // session AND pushes /learn, and this guard firing on that null would replace
  // /learn with Home (the bug: a finished session dumped you on the landing page
  // instead of the next lesson). `finishingRef` lets finishSession own its own
  // navigation. Discard still relies on this guard for its Home redirect, and it
  // does not set the flag, so it is unaffected. The flag needs no reset: /learn
  // unmounts this page, and a fresh session remounts it with the ref back to false.
  const finishingRef = useRef(false);
  useEffect(() => {
    if (restored && !session && !finishingRef.current) router.replace("/");
  }, [restored, session, router]);

  // SAK-183: endSession and completeRound (quiz-session.tsx) now finish a
  // TAUGHT session inline — null the session and push /learn themselves —
  // the same terminal shape finishSession already used, and the same reason
  // this guard needs telling about it in advance. Setting the flag ahead of
  // an UNTAUGHT call is harmless: that path leaves session non-null (phase:
  // "complete", still on /session), so the guard above never fires and the
  // flag is simply never read before this page would unmount anyway.
  const handleEnd = () => {
    finishingRef.current = true;
    endSession();
  };
  const handleCompleteRound = () => {
    finishingRef.current = true;
    completeRound();
  };

  // Drilling belongs to /quiz. This is the other half of that same guard:
  // landing here mid-round sends you back to the round.
  //
  // ONLY WHEN THERE IS A ROUND TO GO BACK TO. Sending you to /quiz with no leg
  // is not a redirect, it is half of a deadlock: /quiz reads "no leg" and sends
  // you straight back here, this guard sends you there again, and the two
  // replace between each other about 350 times a second. The router never
  // settles, so nothing paints and no control can be clicked — the session
  // becomes unrecoverable from inside the app rather than merely broken, which
  // is what took Discard, End quiz and Clear knowledge base down with it.
  //
  // A phase of "drilling" with no leg is a lie about the state, so it is the
  // state that gets corrected rather than the guard that gets loosened; see
  // recoverLostLeg, which puts the session back at its fork with its answers
  // intact and, above all, with buttons on the screen.
  //
  // This guard trusts "drilling with no leg" to mean LOST exactly because
  // nothing legitimate can reach that combination any more: a session with no
  // teach set arrives here as "starting" (below), not "drilling", so by the
  // time phase says "drilling" a leg was always begun alongside it.
  useEffect(() => {
    if (session?.phase !== "drilling") return;
    if (active) {
      router.replace("/quiz");
      return;
    }
    if (restored) recoverLostLeg();
  }, [session?.phase, active, restored, recoverLostLeg, router]);

  // "starting": a brand-new "Quiz me" session (no teach set) with no leg begun
  // yet — see initialSessionPhase / SessionPhase on session.ts. This is the
  // ONLY place that begins its first leg, and it does so from a SETTLED
  // render of this page (the effect fires after mount, once `restored` is
  // true), never from the same tick startSession created the session. That is
  // the whole SAK-52 routing fix: begin every session's first leg the same
  // way, through startFirstRound, so /quiz never sees "drilling" before this
  // page has had a chance to exist.
  useEffect(() => {
    if (restored && session?.phase === "starting") startFirstRound();
  }, [restored, session?.phase, startFirstRound]);

  const preloadPhase = session?.phase;
  const preloadFacts = session?.facts;
  const preloadSnapshot = session?.snapshot;

  // The /quiz route itself is prefetched by QuizSessionProvider, but each mode
  // is now its own chunk so a lesson does not eagerly pay for every quiz UI.
  // Warm the one this session will actually use while the learner is reading
  // the lesson or waiting out the rest timer. Idle scheduling keeps that work
  // from competing with the lesson's first paint; the timeout guarantees it
  // still happens on a busy page.
  useEffect(() => {
    if (
      !preloadFacts ||
      !preloadSnapshot ||
      (preloadPhase !== "teaching" && preloadPhase !== "resting")
    ) {
      return;
    }

    const preload = () => {
      // A speculative network failure must not interrupt the lesson. The
      // dynamic screen loader will make its normal request again on navigation.
      void preloadQuizScreen({
        facts: preloadFacts,
        snapshot: preloadSnapshot,
      }).catch(() => undefined);
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 1_500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 250);
    return () => window.clearTimeout(id);
  }, [preloadPhase, preloadFacts, preloadSnapshot]);

  // "starting" renders nothing, same treatment as "drilling" — see the mount
  // effect above and the phase's own doc on SessionPhase.
  if (!session || session.phase === "drilling" || session.phase === "starting")
    return null;

  const label = `${session.facts.length} item${session.facts.length === 1 ? "" : "s"}`;

  if (session.phase === "teaching") {
    // A live leg BELONGING TO THIS SESSION means we got back via the drill's
    // "Look again", not the pre-round lesson — so the button RESUMES the round
    // (keeping progress) rather than starting a fresh round 1 over the set.
    //
    // The `startedAt` comparison is not a nicety. `active` outlives the session
    // that made it — start a session, drill, walk away, and the leg is still in
    // the snapshot when the NEXT lesson opens. Tested on `!!active` alone, that
    // stale leg made every lesson after your first drill look like a resume:
    // the forward button called resumeRound (jumping you into an unrelated
    // quiz) and the scope fork below vanished, because a resume has no scope
    // left to choose. A leg started before its session cannot be that session's.
    // (`startedAt` is optional on a leg snapshotted before the field existed;
    // an undated leg is old by definition, so it is not this session's.)
    const reviewing = !!active?.startedAt && active.startedAt >= session.startedAt;
    const sentenceOrderingTeaching = session.snapshot.mode === "assembly";
    const sentenceTier = sentenceTierFromLabel(session.what);
    const total = sentenceOrderingTeaching
      ? sentenceRuleEntrySteps(sentenceTier ?? "simple")
      : teachItems.length;
    const at = Math.min(teachStep, Math.max(0, total - 1));
    // Leave the lesson for the drill. Named here because two controls fire it:
    // the bar's "Quiz me" below, and the walk's forward button once it reaches
    // the last item.
    // Leaving the walk is what "shown" means, so the concept cards in it are
    // recorded here and nowhere else. Every route out of the teach phase goes
    // through this wrapper, so a card cannot be read and then forgotten.
    const leavingWalk = (go: () => void) => () => {
      markConceptCardsShown(
        browserStore(),
        // Intro steps record by their own key; a term step that stands in for a
        // once-ever concept card (on'yomi, pitch, the kanji/radical spine cards)
        // records that concept's id, so a concept moved onto a term page is still
        // marked shown and never returns. See LessonStep.conceptId in lesson-steps.ts.
        teachItems.flatMap((s) =>
          s.type === "intro"
            ? [s.key]
            : s.type === "term" && s.conceptId
              ? [s.conceptId]
              : [],
        ),
      );
      go();
    };
    const toDrill = leavingWalk(reviewing ? resumeRound : () => startFirstRound());
    // The wider of the two scopes the lesson's drill offers: everything in this
    // script up to and including the group being taught. Derived from the teach
    // set's first fact — a lesson is one group, so any of its facts names it —
    // and absent for anything that isn't a kana group, which is what makes the
    // fork appear in kana lessons and nowhere else.
    //
    // Not offered when `reviewing` ("Look again" mid-round): there IS no scope
    // choice left at that point, because the round is already running over a
    // set that was chosen when it started. Widening there would silently throw
    // away answered cards.
    //
    // And not offered when the wider scope resolves to the same facts as the
    // group itself — the first group of a script, where "all hiragana so far" is
    // just these five. widerScope() returns null there, the fork collapses, and
    // the walk falls back to its plain "Quiz me". See widerScope() for why the
    // test is on the SETS rather than on the group's position.
    const teachGroup = session.teach.length ? groupOfFact(session.teach[0]) : null;
    const soFar = teachGroup && !reviewing ? widerScope(teachGroup) : null;
    const wider =
      teachGroup && soFar
        ? {
            label: `Quiz me on all ${teachGroup.setLabel.toLowerCase()} so far`,
            onStart: leavingWalk(() => startFirstRound(soFar)),
          }
        : null;
    // On the last item the walk's own forward button already says "Quiz me", so
    // the bar drops its copy rather than showing the same words twice.
    const onLast = total > 0 && at === total - 1;
    // What TRACK this lesson belongs to — "Kana", "Vocabulary", "Grammar" (SAK-145:
    // was the item's own kind, "Hiragana"/"Kanji"/"Word", which is a different and
    // more granular thing — a radical, kanji or word lesson is all "Vocabulary" at
    // the track grain). A lesson is single-subject, so the first teach fact names
    // it for all of them; there's no subject on the session to read, so we resolve
    // it from the fact and let the Library turn it into the track name rather than
    // restating that mapping here.
    const trackLabel =
      /^Counting\b/i.test(session.what)
        ? "Counting"
        : session.teach.length
          ? teachHeadTrackLabel
          : undefined;
    return (
      <>
        {/* SAK-204: docks into the shell's shared top/bottom slots
            (app/layout.tsx) instead of building its own frame — "1 of 5",
            updating as you step, in place of the item count and the round
            (there is no round while teaching, and the count reads better as
            a place than a size). "Quiz me" lives here beside "Pause": both
            are ways OUT of the lesson, so they belong together — the escape
            hatch, not the screen's primary, so it wears the same small
            button. */}
        <Dock slot="top">
          <div className="border-b border-border">
            <SessionHud
              label={total > 0 ? `${at + 1} of ${total}` : label}
              sublabel={trackLabel}
              plain
              where=""
              pct={0}
              hideBar
              onDone={pauseSession}
              onEnd={handleEnd}
            >
              {onLast ? null : <SmallBtn onClick={toDrill}>Quiz me</SmallBtn>}
            </SessionHud>
          </div>
        </Dock>

        {/* items-start: the card top-aligns under the frozen bar instead of
            drifting to mid-screen. Vertically centering this row (items-
            center) was tried and reverted — on review it read as "the
            header is in the middle" rather than a full-screen lesson
            (SAK-10, round 2). justify-center is doing different, kept
            work: it centers the (content + rail) PAIR horizontally as a
            unit, which is the "main content centered on the page" part
            that still holds.

            The row adds LessonRail in the side margin justify-center
            opens up on a wide viewport, so it gets ambient "up next"
            content instead of just whitespace (SAK-10 direction 2). The
            rail sits beside the content, top-aligned with it, and
            disappears below xl where there is no honest margin left to
            put it in — see lesson-rail.tsx. */}
        <div className="flex items-start justify-center gap-8 py-2">
          <div className="min-w-0 max-w-2xl flex-1">
            {sentenceOrderingTeaching ? (
              <SentenceRuleEntryView step={at} tierId={sentenceTier} />
            ) : (
              <TeachWalk
                facts={session.teach}
                history={history}
                // "Seen before" vs never met is a PRESENTATION difference and only
                // that — the budget put both here for the same reason and neither
                // is treated differently. History is the only thing that can tell
                // them apart, and it's read here rather than stored on the session
                // so it can't go stale against a deleted session.
                familiar={(f) => !!history.facts[f]?.seen}
                shownIntros={shownCards}
                step={at}
              />
            )}
          </div>
          {sentenceOrderingTeaching ? null : (
            <LessonRail steps={teachItems} at={at} />
          )}
        </div>

        {/* FROZEN STEP CONTROLS. Back and the forward button dock into the
            shell's own bottom slot, so they hold the exact same screen
            position on every step — you can page through a whole lesson
            without moving the mouse.

            The forward button IS the finishing button: "Next" until the last
            card, then "Quiz me" (a kana lesson splits it into the scope fork —
            this group only, or everything in the script so far). The round's
            config shows just above it on that last card, the moment the drill is
            one click away. */}
        {/* Left / right arrow keys PAGE the walk — never start the quiz. Right
            only advances to the next card and stops on the last one, so no one
            can arrow-key their way into a drill by accident; starting is a
            deliberate click on the forward button. */}
        <TeachKeys
          onBack={() => setTeachStep(at - 1)}
          onForward={onLast ? undefined : () => setTeachStep(at + 1)}
          canBack={at > 0}
        />
        <Dock slot="bottom">
          <div className="border-t border-border">
            <div className="px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Btn
                  onClick={() => setTeachStep(at - 1)}
                  disabled={at === 0}
                  className="disabled:cursor-default disabled:opacity-40"
                >
                  Back
                </Btn>
                {onLast && wider ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Btn onClick={wider.onStart}>{wider.label}</Btn>
                    <Btn go autoFocus onClick={toDrill}>
                      Quiz me on these only
                    </Btn>
                  </div>
                ) : (
                  <Btn
                    go
                    autoFocus
                    onClick={onLast ? toDrill : () => setTeachStep(at + 1)}
                  >
                    {onLast ? "Quiz me" : "Next"}
                  </Btn>
                )}
              </div>
            </div>
          </div>
        </Dock>
      </>
    );
  }

  if (session.phase === "round-complete") {
    return (
      // .kq-center-frame (globals.css, SAK-10): floor-height wrapper so the
      // results read as vertically centered on a short round instead of
      // pinned to the top with a dead gap under them; a detailed results
      // table tall enough to need it still just grows the frame and scrolls
      // with the page.
      <div className="kq-center-frame">
        <SessionHud
          label={session.what}
          // SAK-145 round 2: `where` already read as plain text here ("Round 1
          // of 3 · Done" is not, and never was, a pill) — only `label` (the
          // track name, "Vocabulary") was still boxed. `plain` drops that pill
          // with no `sublabel` to fold in, so it prints the track name alone,
          // same as `where` beside it: the results screen ends up all plain
          // text, matching the teach phase's header.
          plain
          where={`Round ${session.round} of ${roundTargetOf(session)} · Done`}
          pct={100}
          onDone={pauseSession}
          onEnd={handleEnd}
        />
        <div className="flex flex-1 flex-col justify-center mt-3.5">
          <RoundComplete
            session={session}
            onRetry={(facts, boxes) => retryLeg(facts, boxes)}
            onComplete={handleCompleteRound}
          />
        </div>
      </div>
    );
  }

  if (session.phase === "resting") {
    // The bar fills as the rest elapses.
    const left = now === null ? 0 : restLeftMs(session, now);
    const span = session.restUntil ? session.restUntil - session.lastActiveAt : 0;
    const pct = span > 0 ? 100 - (100 * left) / span : 100;
    return (
      // .kq-center-frame (globals.css, SAK-10): see the round-complete
      // branch above — same floor-height centering, same reason.
      <div className="kq-center-frame">
        <SessionHud
          label={session.what}
          where={`resting before round ${Math.min(roundTargetOf(session), session.round + 1)}`}
          pct={pct}
          tone="accent"
          onDone={pauseSession}
          onEnd={handleEnd}
        />
        <div className="flex flex-1 flex-col justify-center mt-3.5">
          <RestScreen session={session} now={now} onStart={startNextRound} />
        </div>
      </div>
    );
  }

  // SAK-183: falling through to here means session.phase is "complete" (every
  // earlier branch above returns on its own phase), and since endSession and
  // completeRound (quiz-session.tsx) both now skip straight to /learn for a
  // taught session instead of ever setting phase: "complete", the only
  // session that can still be sitting in "complete" when this renders is an
  // untaught Quiz-me — this branch, and SessionComplete's Path B below it,
  // should never be reached by a taught session again.
  return (
    // .kq-center-frame (globals.css, SAK-10): see the round-complete branch
    // above — same floor-height centering, same reason.
    <div className="kq-center-frame">
      <SessionHud label={session.what} plain where="Lesson complete" pct={100} tone="success" />
      <div className="flex flex-1 flex-col justify-center mt-3.5">
        <SessionComplete
          session={session}
          onQuizAgain={(facts, boxes) => retryLeg(facts, boxes)}
          onMarkKnown={() => {
            // finishSession pushes /learn; flag it so the "no session → Home"
            // guard above doesn't clobber that with a Home redirect.
            finishingRef.current = true;
            finishSession(true);
          }}
          onGoToLesson={() => {
            // Finish the run with NOTHING claimed and nothing committed for its
            // single deferred round (see finishSession/closeRound), then
            // relaunch this exact batch in TEACH mode — the same call
            // startTrack's Start button makes (facts taught in full, nothing
            // marked seen yet by this new start). Reuses startSession, the
            // one way any lesson ever begins; no second entry path.
            finishingRef.current = true;
            const { facts, what, origin, snapshot } = session;
            finishSession();
            startSession(facts, facts, what, origin, [], snapshot.mode);
          }}
        />
      </div>
    </div>
  );
}
