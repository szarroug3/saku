"use client";

// The session loop's non-drilling screens: the fork, the rest, and the end.
// Drilling itself is still /quiz — this route is everything BETWEEN rounds.
//
// One route for three phases rather than three routes, because they are three
// states of one object and the phase is already in the session. Three routes
// would mean three chances for the URL and the state to disagree, and the URL
// would be the one lying.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { RestScreen } from "@/components/session/rest-screen";
import { RoundComplete } from "@/components/session/round-complete";
import { SessionComplete } from "@/components/session/session-complete";
import { SessionHud } from "@/components/session/session-hud";
import { TeachWalk } from "@/components/session/teach-walk";
import { SmallBtn } from "@/components/ui";
import { useHistory } from "@/lib/use-history";
import { groupOfFact, scriptSoFar } from "@/lib/lesson";
import { lessonSteps } from "@/lib/lesson-steps";
import { restLeftMs } from "@/lib/session";
import { useNow } from "@/lib/use-now";
import { useQuizSession } from "@/lib/quiz-session";

export default function SessionPage() {
  const router = useRouter();
  const {
    active,
    session,
    restored,
    retryLeg,
    completeRound,
    startNextRound,
    endSession,
    finishSession,
    startSession,
    startFirstRound,
    resumeRound,
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
  const teachKey = session ? session.teach.join(",") : "";
  const teachItems = useMemo(
    () => (session ? lessonSteps(session.teach) : []),
    [teachKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Reset to the first item whenever the teach set changes (a new session, or a
  // new round's material). Done by adjusting state during render off a stored
  // key — the pattern React prefers over a reset effect (react.dev "You Might
  // Not Need an Effect").
  const [teachStep, setTeachStep] = useState(0);
  const [prevTeachKey, setPrevTeachKey] = useState(teachKey);
  if (teachKey !== prevTeachKey) {
    setPrevTeachKey(teachKey);
    setTeachStep(0);
  }

  // No session (deep link, or a refresh with nothing stored) → Home. Wait for
  // the restore, or a refresh mid-rest would bounce you off your own break.
  useEffect(() => {
    if (restored && !session) router.replace("/");
  }, [restored, session, router]);

  // Drilling belongs to /quiz. This is the other half of that same guard:
  // landing here mid-round sends you back to the round.
  useEffect(() => {
    if (session?.phase === "drilling") router.replace("/quiz");
  }, [session?.phase, router]);

  if (!session || session.phase === "drilling") return null;

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
    const total = teachItems.length;
    const at = Math.min(teachStep, Math.max(0, total - 1));
    // Leave the lesson for the drill. Named here because two controls fire it:
    // the bar's "Quiz me" below, and the walk's forward button once it reaches
    // the last item.
    const toDrill = reviewing ? resumeRound : () => startFirstRound();
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
    const teachGroup = session.teach.length ? groupOfFact(session.teach[0]) : null;
    const wider =
      teachGroup && !reviewing
        ? {
            label: `Quiz me on all ${teachGroup.setLabel.toLowerCase()} so far`,
            onStart: () => startFirstRound(scriptSoFar(teachGroup)),
          }
        : null;
    // On the last item the walk's own forward button already says "Quiz me", so
    // the bar drops its copy rather than showing the same words twice.
    const onLast = total > 0 && at === total - 1;
    return (
      <>
        {/* The top bar carries the position through the lesson — "1 of 5",
            updating as you step — in place of the item count and the round.
            There is no round while teaching, and the count reads better as a
            place ("where am I") than a size ("how many").

            It FLOATS, like the drill's HUD: a lesson is a long scrolling page
            and the two things you might want at any moment — leave for the quiz,
            leave entirely — shouldn't be somewhere you have to scroll back to.
            Same treatment the drill wears, so the two phases share one piece of
            furniture (see SessionHud's `float`).

            "Quiz me" lives here now, beside "Done for now": both are ways OUT of
            the lesson, and they belong together. It's the escape hatch — quiz me
            without paging through the rest — not the screen's primary, so it
            wears the same small button "Done for now" does rather than the
            full-width slab it used to be. */}
        <SessionHud
          label={total > 0 ? `${at + 1} of ${total}` : label}
          where=""
          pct={0}
          float
          onDone={endSession}
        >
          {onLast ? null : <SmallBtn onClick={toDrill}>Quiz me</SmallBtn>}
        </SessionHud>
        <div className="mt-3.5">
          <TeachWalk
            facts={session.teach}
            // "Seen before" vs never met is a PRESENTATION difference and only
            // that — the budget put both here for the same reason and neither
            // is treated differently. History is the only thing that can tell
            // them apart, and it's read here rather than stored on the session
            // so it can't go stale against a deleted session.
            familiar={(f) => !!history.facts[f]?.seen}
            onStart={toDrill}
            wider={wider}
            step={at}
            onStep={setTeachStep}
          />
        </div>
      </>
    );
  }

  if (session.phase === "round-complete") {
    return (
      <>
        <SessionHud
          label={label}
          where={`round ${session.round} · done`}
          pct={100}
          onDone={endSession}
        />
        <div className="mt-3.5">
          <RoundComplete
            session={session}
            onRetry={(facts) => retryLeg(facts)}
            onComplete={completeRound}
          />
        </div>
      </>
    );
  }

  if (session.phase === "resting") {
    // The bar fills as the rest elapses — grey, because elapsing is not
    // progress and painting it accent would make waiting look like achieving.
    const left = now === null ? 0 : restLeftMs(session, now);
    const span = session.restUntil ? session.restUntil - session.lastActiveAt : 0;
    const pct = span > 0 ? 100 - (100 * left) / span : 100;
    return (
      <>
        <SessionHud
          label={label}
          where="resting"
          pct={pct}
          tone="muted"
          onDone={endSession}
        />
        <div className="mt-3.5">
          <RestScreen
            session={session}
            now={now}
            onStart={startNextRound}
            onDone={endSession}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <SessionHud label={label} where="complete" pct={100} tone="success" />
      <div className="mt-3.5">
        <SessionComplete
          session={session}
          onRerun={() => {
            const { facts, teach, what } = session;
            finishSession();
            startSession(facts, teach, what);
          }}
          onDone={finishSession}
        />
      </div>
    </>
  );
}
