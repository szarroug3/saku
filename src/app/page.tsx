"use client";

// Home — top to bottom, the order you build a quiz in.
//
//   0. resume        the quiz you left running, and ONLY if there is one
//   1. setup         HOW you drill, always visible, never behind a disclosure
//   2. selection     WHAT you drill, as a query
//   3. start bar     the whole quiz as a sentence, and the only Start
//
// THE RULE, and every line below serves it: whatever you are about to run is
// fully on screen before you run it, and only a button starts a quiz.
//
// WHAT CHANGED, and why the shelves are gone
// ==========================================
// This screen used to be two shelves of cards over a flat char→bool map
// (cfg.enabled), plus a 214-cell picker to fine-tune it. That was a good design
// for 214 things and it does not survive 21,449: there is no shelf of cards for
// "the useful subsets of a dictionary", and nobody fine-tunes 21,449
// checkboxes. The cards' cleverest property — that two overlapping ones
// deduped for free, because a map cannot hold a key twice — was real, and it
// was a property of the storage, not of the idea.
//
// So selection is a QUERY (see src/types/index.ts and src/lib/selection.ts).
// The dedup is still free, for a different reason: resolve() ends in a Set.
// What is new is that the selection now costs six fields instead of one key per
// thing in the app, and that "drill the kanji I'm shaky on" is a gesture you
// can actually make.
//
// The query lives in cfg.selection, and resolve() is the only thing that turns
// it into facts. Home does not know what a fact is, what a kanji is, or how
// many of either there are.

import { useEffect, useMemo, useState } from "react";

import { QuizOptionsFields } from "@/components/home/quiz-options";
import { SelectionCard } from "@/components/home/selection-card";
import { SessionCard } from "@/components/home/session-card";
import { StartBar } from "@/components/home/start-bar";
import { Card, Lbl, PageTitle } from "@/components/ui";
import { planFacts, planSession } from "@/lib/budget";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { resolve, whatSentence } from "@/lib/selection";
import { useHistory } from "@/lib/use-history";
import { useLists } from "@/lib/use-lists";

export default function HomePage() {
  const { cfg, set } = useQuizConfig();
  const { session, startSession, discardSession, continueSession } =
    useQuizSession();
  const { history } = useHistory();
  const { lists } = useLists();

  // The facts the query names, right now. This IS what Start hands to the quiz
  // and what the bar counts — one computation, so the sentence and the session
  // can never disagree about what you pressed Start on.
  //
  // Memoised on the query, the history and the lists for its IDENTITY as much
  // as its cost: resolve() walks every fact in the app, and it returns a fresh
  // array every call.
  const facts = useMemo(
    () => resolve(cfg.selection, history, lists, cfg.accuracyMetric),
    [cfg.selection, cfg.accuracyMetric, history, lists],
  );

  const what = useMemo(
    () => whatSentence(cfg.selection, facts.length, lists),
    [cfg.selection, facts.length, lists],
  );

  // The clock the BUDGET is computed against, read ONCE per visit.
  //
  // Not Date.now() inline: planSession is pure and has to stay that way, a
  // render that reads a clock is a render that can't be trusted to be the same
  // twice, and an argument that changes on every render is a dep that defeats
  // the useMemo below it. Held as state so it is stable for the life of the
  // page, and re-read on mount — which is the same moment useHistory refetches,
  // so the clock and the history the plan is built from always agree.
  //
  // It goes stale if you leave Home open for days. That is fine and is the
  // reason this is a decision rather than an oversight: the model's unit is
  // DAYS, so a plan that was right when the page loaded is still right an hour
  // later, and finishing a session — the only thing that actually changes the
  // answer — remounts this page anyway.
  const [now] = useState(() => Date.now());

  // A SECOND clock, and the difference from `now` above is not pedantry.
  //
  // `now` is seeded in a useState initialiser, which also runs on the server —
  // fine for the budget, because nothing it renders says what time it is. The
  // session card DOES ("last answer 2 hours ago"), and a timestamp seeded on
  // the server renders text that the client then disagrees with on hydration.
  // So the card's clock is read strictly after mount, and the card sits out the
  // first paint rather than printing a time from another machine.
  const [mountedNow, setMountedNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMountedNow(Date.now());
  }, []);

  // WHAT YOU SELECTED IS THE POOL. THIS IS THE SESSION.
  //
  // src/lib/budget.ts decides what actually gets run: rank the met facts, then
  // top up from `teach` to the length you asked for. The top-up is what stops
  // the drill going dark — everything at p → 0 leaves the ranking on purpose,
  // and without a budget to catch it the material you are worst at ends up in
  // no list at all.
  //
  // Computed HERE and not inside `start()`, because the start bar has to be
  // able to say what the button will do before you press it — including the
  // case where the honest answer is "nothing, you're solid on all of these".
  // One plan, read by the sentence and by the button, so they cannot disagree.
  //
  // The plan is handed on WHOLE. It used to be squeezed back through the
  // selected characters — `chars.filter((c) => inPlan.has(kanaFact(c)))` — which
  // silently dropped every fact whose subject wasn't kana, because there was no
  // character to match it against. That filter was the last place a kanji died
  // on this page, and it type-checked perfectly: FactId is a branded string, so
  // handing facts to something expecting characters costs nothing at compile
  // time and everything at runtime.
  const planned = useMemo(() => {
    const plan = planSession({
      candidates: facts,
      history,
      // "Unlimited" means no cap, not no budget — see budget.ts. Full-coverage
      // asks for the whole pool, so it has no cap either.
      length:
        cfg.length === "limited" && cfg.limType === "count" ? cfg.limCount : null,
      now,
    });
    return { facts: planFacts(plan), teach: plan.teach };
  }, [facts, history, cfg.length, cfg.limType, cfg.limCount, now]);

  // Start IS start-a-session. The loop is the app's spine, not a mode you opt
  // into: you do the set, you fork on the misses, you rest, you do the same set
  // again. A one-off quiz is just a session you complete after one round.
  //
  // No confirm dialog, even though this replaces a session in progress. The
  // session card above is on screen saying there's one, with a Continue button
  // on it — the information a dialog would interrupt you to give you is already
  // in front of you, and everything in that session is already saved.
  const start = () => {
    if (!planned.facts.length) return;
    startSession(planned.facts, planned.teach, what);
  };

  return (
    <>
      <PageTitle title="Kana quiz" />

      {/* Not rendered at all with no session — see session-card.tsx. A card
          that offers to continue nothing is the lie this replaced. */}
      {session && mountedNow !== null ? (
        <SessionCard
          session={session}
          now={mountedNow}
          onContinue={continueSession}
          onRestart={() => startSession(session.facts, session.teach, session.what)}
          onDiscard={discardSession}
        />
      ) : null}

      <Lbl>Setup</Lbl>
      <Card>
        {/* Always open. This used to be a disclosure ("Edit setup") on the
            hero, which is how you got to press Start without being able to see
            the settings it would run with. Four rows is not a wall. */}
        <QuizOptionsFields />
      </Card>

      <SelectionCard
        sel={cfg.selection}
        lists={lists}
        onChange={(selection) => set((prev) => ({ ...prev, selection }))}
      />

      <StartBar
        cfg={cfg}
        what={what}
        count={facts.length}
        plannedCount={planned.facts.length}
        active={!!session}
        onStart={start}
      />
    </>
  );
}
