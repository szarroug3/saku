"use client";

// The session loop's non-drilling screens: the fork, the rest, and the end.
// Drilling itself is still /quiz — this route is everything BETWEEN rounds.
//
// One route for three phases rather than three routes, because they are three
// states of one object and the phase is already in the session. Three routes
// would mean three chances for the URL and the state to disagree, and the URL
// would be the one lying.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { RestScreen } from "@/components/session/rest-screen";
import { RoundComplete } from "@/components/session/round-complete";
import { SessionComplete } from "@/components/session/session-complete";
import { SessionHud } from "@/components/session/session-hud";
import { TeachScreen } from "@/components/session/teach-screen";
import { useHistory } from "@/lib/use-history";
import { restLeftMs } from "@/lib/session";
import { useNow } from "@/lib/use-now";
import { useQuizSession } from "@/lib/quiz-session";

export default function SessionPage() {
  const router = useRouter();
  const {
    session,
    restored,
    retryLeg,
    completeRound,
    startNextRound,
    endSession,
    finishSession,
    startSession,
    startFirstRound,
  } = useQuizSession();
  const { history } = useHistory();

  // One clock for the rest screen and the bar above it — see use-now.ts.
  // Hooks can't be called conditionally, so it ticks whenever the phase is
  // resting and is simply unread otherwise.
  const now = useNow(session?.phase === "resting");

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
    return (
      <>
        <SessionHud label={label} where="before round 1" pct={0} onDone={endSession} />
        <div className="mt-3.5">
          <TeachScreen
            facts={session.teach}
            // "Seen before" vs never met is a PRESENTATION difference and only
            // that — the budget put both here for the same reason and neither
            // is treated differently. History is the only thing that can tell
            // them apart, and it's read here rather than stored on the session
            // so it can't go stale against a deleted session.
            familiar={(f) => !!history.facts[f]?.seen}
            onStart={startFirstRound}
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
