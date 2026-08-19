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

import { RestScreen } from "@/components/session/rest-screen";
import { SessionComplete } from "@/components/session/session-complete";
import {
  SentenceOrderingTeachWalk,
  sentenceOrderingTeachSteps,
  type SentenceOrderingTierId,
} from "@/components/session/sentence-ordering-teach-walk";
import { SessionHud } from "@/components/session/session-hud";
import { TeachWalk } from "@/components/session/teach-walk";
import { ConfigPreview } from "@/components/quiz/config-preview";
import { Btn, SmallBtn } from "@/components/ui";
import { preloadQuizScreen } from "@/components/quiz/quiz-mode-screen";
import { useHistory } from "@/lib/use-history";
import { factInfo } from "@/lib/facts";
import { browserStore, markConceptCardsShown, shownIntros } from "@/lib/intro-shown";
import { subjectLabel as teachSubjectLabel } from "@/lib/library/entries";
import { groupOfFact, widerScope } from "@/lib/lesson";
import { lessonSteps } from "@/lib/lesson-steps";
import { restLeftMs, SESSION_ROUND_TARGET } from "@/lib/session";
import { useNow } from "@/lib/use-now";
import { useQuizSession } from "@/lib/quiz-session";

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
    startSession,
    startFirstRound,
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
  const teachItems = useMemo(
    () => (session ? lessonSteps(session.teach, history, shownCards) : []),
    [teachKey, history, shownCards], // eslint-disable-line react-hooks/exhaustive-deps
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
  useEffect(() => {
    if (session?.phase !== "drilling") return;
    if (active) {
      router.replace("/quiz");
      return;
    }
    if (restored) recoverLostLeg();
  }, [session?.phase, active, restored, recoverLostLeg, router]);

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
    const sentenceOrderingTeaching = session.snapshot.mode === "assembly";
    const sentenceTier = sentenceTierFromLabel(session.what);
    const total = sentenceOrderingTeaching
      ? sentenceOrderingTeachSteps(sentenceTier ?? "simple")
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
    // What KIND of thing this lesson teaches — "Hiragana", "Kanji", "Word". A
    // lesson is single-subject, so the first teach fact names it for all of
    // them; there's no subject on the session to read, so we resolve it from the
    // fact and let the Library turn it into the specific lesson-type label
    // (kana splits by script) rather than restating that mapping here.
    const subjectLabel =
      /^Counters\b/i.test(session.what)
        ? "Numbers"
        : session.teach.length
          ? teachSubjectLabel(factInfo(session.teach[0]))
          : undefined;
    return (
      // THE LESSON IS ITS OWN VIEWPORT-TALL FRAME, like the Library (see
      // library-page.tsx). The top bar is a STATIC row at the top and only the
      // region below it scrolls, so the lesson content can never pass BEHIND the
      // bar — the "nothing rolls under the frozen bar" the floating HUD couldn't
      // guarantee (a sticky bar over the window scroll overlays what scrolls up
      // under it, and a clear bar then showed that content through itself). No
      // occluding fill is needed because nothing is ever behind it.
      //
      // The height math cancels the shell chrome exactly as the Library does:
      // kq-scroll wraps the page in pt-3 pb-15 and the shell row adds py-6, so
      // -mb-15 reclaims the 60px below and the height is 100dvh minus the 60px of
      // top/bottom chrome. The document then equals the viewport: no window scroll
      // to fight the frozen row.
      <div className="-mb-15 flex h-[calc(100dvh-60px)] flex-col">
        {/* The frozen top row. It carries the position through the lesson —
            "1 of 5", updating as you step — in place of the item count and the
            round (there is no round while teaching, and the count reads better as
            a place than a size). "Quiz me" lives here beside "Done for now": both
            are ways OUT of the lesson, so they belong together — the escape hatch,
            not the screen's primary, so it wears the same small button.

            shrink-0 keeps it at its natural height; it does not scroll and nothing
            scrolls behind it, so it needs no occluding material. A hairline on its
            bottom edge sets the frozen bar off from the lesson scrolling below. */}
        <div className="shrink-0 border-b border-border">
          <SessionHud
            label={total > 0 ? `${at + 1} of ${total}` : label}
            sublabel={subjectLabel}
            where=""
            pct={0}
            hideBar
            onDone={pauseSession}
            onEnd={endSession}
          >
            {onLast ? null : <SmallBtn onClick={toDrill}>Quiz me</SmallBtn>}
          </SessionHud>
        </div>

        {/* The ONLY thing that scrolls. min-h-0 lets it shrink inside the flex
            column so its own overflow (not the window) takes the lesson's length. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mt-2">
            {sentenceOrderingTeaching ? (
              <SentenceOrderingTeachWalk step={at} tierId={sentenceTier} />
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
        </div>

        {/* FROZEN STEP CONTROLS. Back and the forward button live in a STATIC
            footer row of the frame, never in the scrolling lesson, so they hold
            the exact same screen position on every step — you can page through a
            whole lesson without moving the mouse. Like the top bar, nothing
            scrolls behind it (it is a sibling of the scroll region), so it needs
            no occluding fill; a hairline sets it off from the lesson above.

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
        <div className="shrink-0 border-t border-border">
          <div className="px-3 py-3">
            {onLast ? (
              <div className="mb-3 rounded-lg border border-border bg-panel px-3 py-2">
                <ConfigPreview />
              </div>
            ) : null}
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
      </div>
    );
  }

  if (session.phase === "round-complete") {
    return (
      <>
        <SessionHud
          label={label}
          where={`round ${session.round} of ${SESSION_ROUND_TARGET} · done`}
          pct={100}
          onDone={pauseSession}
          onEnd={endSession}
        />
        <div className="mt-3.5">
          <RoundComplete
            session={session}
            onRetry={(facts, boxes) => retryLeg(facts, boxes)}
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
          where={`resting before round ${Math.min(SESSION_ROUND_TARGET, session.round + 1)}`}
          pct={pct}
          tone="muted"
          onDone={pauseSession}
          onEnd={endSession}
        />
        <div className="mt-3.5">
          <RestScreen
            session={session}
            now={now}
            onStart={startNextRound}
            onDone={pauseSession}
            onComplete={endSession}
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
          onMarkKnown={() => {
            // finishSession pushes /learn; flag it so the "no session → Home"
            // guard above doesn't clobber that with a Home redirect.
            finishingRef.current = true;
            finishSession(true);
          }}
          onGoToLesson={() => {
            finishingRef.current = true;
            finishSession(false);
          }}
        />
      </div>
    </>
  );
}
