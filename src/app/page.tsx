"use client";

// Home — three shelves, in priority order.
//
//   1. the hero      HOW you drill, as a sentence, plus the one big button
//   2. weaknesses    decks the app computed from your history
//   3. decks         the standing sets, and the door to the picker
//
// The split that makes it work: the hero governs HOW, every card governs WHAT.
// So a card never opens a form — it sets the selection and starts, one click
// from opening the app to your first character.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CharacterPicker } from "@/components/home/character-picker";
import { DeckShelf } from "@/components/home/deck-shelf";
import { ResumeHero } from "@/components/home/resume-hero";
import { WeaknessShelf } from "@/components/home/weakness-shelf";
import { Lbl, PageTitle } from "@/components/ui";
import { lastSession, type Deck } from "@/lib/decks";
import { selectedChars, useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { useHistory } from "@/lib/use-history";

/** A quiz waiting on a config edit to land before it can start. */
interface Pending {
  chars: string[];
  coverage: boolean;
}

const DISCARD_PROMPT = "Discard the quiz in progress and start a new one?";

export default function HomePage() {
  const router = useRouter();
  const { cfg, set } = useQuizConfig();
  const { active, startQuiz, abandonQuiz } = useQuizSession();
  const { history } = useHistory();

  const [pending, setPending] = useState<Pending | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const chars = selectedChars(cfg);

  // Grid mode ignores directions, so only the char count gates it there.
  const startDisabled =
    !chars.length || (cfg.mode !== "grid" && !cfg.dirs.jp2en && !cfg.dirs.en2jp);
  // A setup that can't run any quiz also can't run a card's quiz.
  const howBroken = cfg.mode !== "grid" && !cfg.dirs.jp2en && !cfg.dirs.en2jp;

  /** Point the selection at `next` and start drilling it. */
  const launch = useCallback(
    (next: string[], coverage = false) => {
      if (!next.length) return;
      // Starting a card's quiz throws away a running one, which is the same
      // consequence the hero makes you confirm — so ask here too. Only ever
      // when a quiz is actually in progress: the empty case still starts on
      // the first click, which is the whole point of the shelves.
      if (active && !window.confirm(DISCARD_PROMPT)) return;
      const only = new Set(next);
      set((prev) => {
        const enabled: Record<string, boolean> = {};
        for (const c of Object.keys(prev.enabled)) enabled[c] = only.has(c);
        for (const c of next) enabled[c] = true;
        return {
          ...prev,
          enabled,
          // Full coverage is a length, so it has to go through the setup the
          // hero shows — otherwise the sentence would lie about the quiz.
          ...(coverage ? { length: "limited" as const, limType: "cov" as const } : {}),
        };
      });
      setPending({ chars: next, coverage });
    },
    [set, active],
  );

  // startQuiz FREEZES the current cfg into the quiz, and the edit above only
  // lands on the next render — so a card that changes the setup has to wait a
  // beat, or the quiz would run with the previous snapshot.
  useEffect(() => {
    if (!pending) return;
    if (pending.coverage && !(cfg.length === "limited" && cfg.limType === "cov")) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(null);
    startQuiz(pending.chars);
  }, [pending, cfg, startQuiz]);

  const discardAndStart = () => {
    if (!window.confirm(DISCARD_PROMPT)) return;
    abandonQuiz();
    startQuiz(chars);
  };

  return (
    <>
      <PageTitle title="Kana quiz" />

      <ResumeHero
        cfg={cfg}
        chars={chars}
        lastTs={lastSession(history)?.ts ?? null}
        active={!!active}
        disabled={startDisabled}
        onStart={() => startQuiz(chars)}
        onResume={() => router.push("/quiz")}
        onDiscardAndStart={discardAndStart}
      />

      <Lbl>Target a weakness</Lbl>
      <WeaknessShelf
        history={history}
        cfg={cfg}
        enabled={chars}
        disabled={howBroken}
        onPick={(picked) => launch(picked)}
      />

      <Lbl>Decks</Lbl>
      <DeckShelf
        history={history}
        cfg={cfg}
        disabled={howBroken}
        pickerOpen={pickerOpen}
        onPick={(deck: Deck) => launch(deck.chars, !!deck.coverage)}
        onCustom={() => setPickerOpen((v) => !v)}
      />

      {pickerOpen ? <CharacterPicker /> : null}
    </>
  );
}
