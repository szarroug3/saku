"use client";

// Home — top to bottom, the order you build a quiz in.
//
//   0. resume        the quiz you left running, and ONLY if there is one
//   1. setup         HOW you drill, always visible, never behind a disclosure
//   2. weaknesses    decks the app computed from your history   } one
//   3. decks         the standing sets, and the door to the picker } selection
//   4. start bar     the whole quiz as a sentence, and the only Start
//
// THE RULE, and every line below serves it: whatever you are about to run is
// fully on screen before you run it, and only a button starts a quiz.
//
// It replaces a split that read well and worked badly — "the hero owns HOW,
// the cards own WHAT". Elegant, except it meant that at the moment you acted
// you could only see half the quiz: Start showed you the how and not the what,
// a deck card showed you the what and started instantly with the how folded
// away behind "Edit setup". And a card that starts a quiz is not discoverable
// ("it's not clear that clicking a deck will start a quiz") because it looks
// like a card, and cards select. So: cards select, one button starts, and the
// bar above that button says both halves out loud.
//
// The selection is cfg.enabled and nothing else — not component state, not a
// list of picked ids. That is what lets the picker be a fine-tune view of the
// same thing the cards set coarsely, and it is what makes the union of two
// overlapping cards dedupe itself. See src/components/home/selection.ts.

import { useEffect, useMemo, useState } from "react";

import { CharacterPicker } from "@/components/home/character-picker";
import { DeckShelf } from "@/components/home/deck-shelf";
import { QuizOptionsFields } from "@/components/home/quiz-options";
import { SessionCard } from "@/components/home/session-card";
import { selectionLabels, toggled } from "@/components/home/selection";
import { StartBar } from "@/components/home/start-bar";
import { weaknessDecks, WeaknessShelf } from "@/components/home/weakness-shelf";
import { Card, Lbl, PageTitle } from "@/components/ui";
import { planFacts, planSession } from "@/lib/budget";
import { kanaFact } from "@/data/characters";
import { DECKS, deckChars, deckSelectable } from "@/lib/decks";
import { selectedChars, useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { useHistory } from "@/lib/use-history";

export default function HomePage() {
  const { cfg, set } = useQuizConfig();
  const { session, startSession, discardSession, continueSession } =
    useQuizSession();
  const { history } = useHistory();

  const [pickerOpen, setPickerOpen] = useState(false);

  // The union of every toggled card, deduped — and not by any code here. The
  // cards write true/false into cfg.enabled, so a character selected by both
  // Weakest 20 and Hiragana Basic is one key in one map and counts once. This
  // IS the count the start bar prints and the deck startQuiz receives.
  //
  // Memoised on cfg for its IDENTITY, not its cost: selectedChars builds a new
  // array every call, and an array that changes identity on every render is a
  // dep that defeats every useMemo below it — including the one over history.
  const chars = useMemo(() => selectedChars(cfg), [cfg]);

  // The clock the weakness cards are computed against, read ONCE per visit.
  //
  // Not Date.now() inline: weaknessDecks is pure and has to stay that way, a
  // render that reads a clock is a render that can't be trusted to be the same
  // twice, and an argument that changes on every render is a dep that defeats
  // the useMemo below it. Held as state so it is stable for the life of the
  // page, and re-read on mount — which is the same moment useHistory refetches,
  // so the clock and the history the cards are built from always agree.
  //
  // It goes stale if you leave Home open for days. That is fine and is the
  // reason this is a decision rather than an oversight: the model's unit is
  // DAYS, so a list that was right when the page loaded is still right an hour
  // later, and finishing a quiz — the only thing that actually changes the
  // answer — remounts this page anyway.
  const [now] = useState(() => Date.now());

  // A SECOND clock, and the difference from `now` above is not pedantry.
  //
  // `now` is seeded in a useState initialiser, which also runs on the server —
  // fine for the weakness cards, because nothing they render says what time it
  // is. The session card DOES ("last answer 2 hours ago"), and a timestamp
  // seeded on the server renders text that the client then disagrees with on
  // hydration. So the card's clock is read strictly after mount, and the card
  // sits out the first paint rather than printing a time from another machine.
  const [mountedNow, setMountedNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMountedNow(Date.now());
  }, []);

  const weakness = useMemo(
    () => weaknessDecks(history, cfg, chars, now),
    [history, cfg, chars, now],
  );

  // Both shelves, in the order they appear, so the sentence names them in the
  // order you read them.
  const labels = useMemo(
    () =>
      selectionLabels(
        // The weakness cards already speak characters; the static decks speak
        // facts and are translated at this one edge. cfg.enabled is a char→bool
        // map — that is a separate task, and until it lands this is the seam.
        [...weakness, ...DECKS.map(deckSelectable)],
        cfg.enabled,
        chars.length,
      ),
    [weakness, cfg.enabled, chars.length],
  );

  const toggle = (of: string[], on: boolean) =>
    set((prev) => toggled(prev, of, on));

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
  const planned = useMemo(() => {
    const plan = planSession({
      candidates: chars.map(kanaFact),
      history,
      // "Unlimited" means no cap, not no budget — see budget.ts. Full-coverage
      // asks for the whole pool, so it has no cap either.
      length:
        cfg.length === "limited" && cfg.limType === "count" ? cfg.limCount : null,
      now,
    });
    // The plan speaks facts; a leg drills characters. One kana is one fact, so
    // this is a filter today and a real lookup the day kanji lands.
    const inPlan = new Set<string>(planFacts(plan));
    const teachSet = new Set<string>(plan.teach);
    const picked = chars.filter((c) => inPlan.has(kanaFact(c)));
    return {
      chars: picked,
      teach: picked.filter((c) => teachSet.has(kanaFact(c))),
    };
  }, [chars, history, cfg.length, cfg.limType, cfg.limCount, now]);

  // Start IS start-a-session. The loop is the app's spine, not a mode you opt
  // into: you do the set, you fork on the misses, you rest, you do the same set
  // again. A one-off quiz is just a session you complete after one round.
  //
  // What you selected is the POOL, not the session. src/lib/budget.ts decides
  // what the session actually is: the ranked material first, topped up from
  // `teach` to the length you asked for. That top-up is what stops the drill
  // from going dark — without it, everything at p → 0 leaves the ranking and
  // nothing catches it, so the things you are worst at end up in no list at
  // all.
  //
  // No confirm dialog, even though this replaces a session in progress. The
  // session card above is on screen saying there's one, with a Continue button
  // on it — the information a dialog would interrupt you to give you is already
  // in front of you, and everything in that session is already saved.
  const start = () => {
    if (!planned.chars.length) return;
    startSession(planned.chars, planned.teach);
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
          onRestart={() => startSession(session.chars)}
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

      <Lbl>Target a weakness</Lbl>
      <WeaknessShelf decks={weakness} cfg={cfg} onToggle={toggle} />

      <Lbl>Decks</Lbl>
      <DeckShelf
        history={history}
        cfg={cfg}
        pickerOpen={pickerOpen}
        onToggle={(deck, on) => toggle(deckChars(deck), on)}
        onCustom={() => setPickerOpen((v) => !v)}
      />

      {pickerOpen ? <CharacterPicker /> : null}

      <StartBar
        cfg={cfg}
        labels={labels}
        count={chars.length}
        plannedCount={planned.chars.length}
        active={!!session}
        onStart={start}
      />
    </>
  );
}
