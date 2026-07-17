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

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CharacterPicker } from "@/components/home/character-picker";
import { DeckShelf } from "@/components/home/deck-shelf";
import { QuizOptionsFields } from "@/components/home/quiz-options";
import { ResumeCard } from "@/components/home/resume-card";
import { selectionLabels, toggled } from "@/components/home/selection";
import { StartBar } from "@/components/home/start-bar";
import { weaknessDecks, WeaknessShelf } from "@/components/home/weakness-shelf";
import { Card, Lbl, PageTitle } from "@/components/ui";
import { DECKS, deckChars, deckSelectable } from "@/lib/decks";
import { selectedChars, useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { useHistory } from "@/lib/use-history";

const REPLACE_PROMPT =
  "Starting this quiz discards the one in progress. Continue?";

export default function HomePage() {
  const router = useRouter();
  const { cfg, set } = useQuizConfig();
  const { active, progress, startQuiz, abandonQuiz } = useQuizSession();
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

  const weakness = useMemo(
    () => weaknessDecks(history, cfg, chars),
    [history, cfg, chars],
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

  const start = () => {
    if (!chars.length) return;
    if (active && !window.confirm(REPLACE_PROMPT)) return;
    // Replacing rather than abandoning-then-starting: startQuiz overwrites the
    // active quiz outright, and abandonQuiz first would only add a render with
    // no quiz in it.
    startQuiz(chars);
  };

  return (
    <>
      <PageTitle title="Kana quiz" />

      {/* Not rendered at all with no quiz — see resume-card.tsx. A card that
          offers to resume nothing is the lie this replaced. */}
      {active ? (
        <ResumeCard
          active={active}
          progress={progress}
          onResume={() => router.push("/quiz")}
          onDiscard={abandonQuiz}
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
        active={!!active}
        onStart={start}
      />
    </>
  );
}
