"use client";

// SENTENCE-LISTENING RECOGNITION screen — "Hear a sentence, pick its meaning."
//
// The third listening question type, and the first over SENTENCES (see
// src/lib/listen-sentence.ts for why recognition, not transcription). Shown 3-4
// English meanings, the learner hears a corpus sentence and picks the right one.
// Multiple choice, graded by INDEX against the one correct meaning — the property
// that lets a sentence be graded at all without breaking never-mark-wrong.
//
// It is its own mode/screen, not a drill flag, because its options are English
// SENTENCE MEANINGS, not FactIds, so it cannot ride the drill's FactId MC path
// the word listening types reuse. Structurally it mirrors assembly and
// substitution (task 11): corpus-driven, gated on known words, rolled ONCE at
// init from history so a refresh resumes the same cards, state in
// active.runtime.recognition flushed with saveNow() on every change.
//
// The AUDIO is the prompt: the Japanese sentence is played, never printed, until
// the card resolves. The voice is the learner's configured one, which "Auto"
// resolves through pickAutoVoice (src/lib/speech.ts) — the same fixed selection
// task 22 uses, so it never regresses to the Eddy novelty voice.
//
// Copy here is DRAFT and flagged for the owner's voice pass.

import { useEffect, useState } from "react";

import { Btn, GhostBtn } from "@/components/ui";
import { newFactStat, retriesAllowed } from "@/lib/engine";
import {
  gradeRecognition,
  pickRecognition,
  type RecognitionItem,
} from "@/lib/listen-sentence";
import { speak } from "@/lib/speech";
import { useHistory } from "@/lib/use-history";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ActiveQuiz } from "@/lib/quiz-session";
import type { HistoryFile, SessionStats } from "@/types";

const TARGET = 12;

interface RecCard {
  item: RecognitionItem;
  /** The option the learner picked, or null while open. */
  picked: number | null;
  state: "open" | "right" | "wrong";
  tries: number;
}

interface RecRuntime {
  cards: RecCard[];
  pos: number;
  streak: number;
  stats: SessionStats;
}

function buildRuntime(history: HistoryFile): RecRuntime {
  const cards: RecCard[] = [];
  const stats: SessionStats = {};
  const seenIds = new Set<number>();
  for (let i = 0; i < TARGET * 4 && cards.length < TARGET; i++) {
    const item = pickRecognition(history);
    if (!item) break;
    if (seenIds.has(item.id)) continue; // no repeats within one run
    seenIds.add(item.id);
    cards.push({ item, picked: null, state: "open", tries: 0 });
    for (const f of item.facts) {
      if (!stats[f]) stats[f] = newFactStat();
      stats[f].seen++;
    }
  }
  return { cards, pos: 0, streak: 0, stats };
}

function ensureRuntime(active: ActiveQuiz, history: HistoryFile): RecRuntime {
  const rt = active.runtime as { recognition?: RecRuntime };
  return (rt.recognition ??= buildRuntime(history));
}

// ---------- mutations (module-level, runtime passed in) ----------
//
// Passed the runtime rather than closing over it, so the immutability lint that
// guards effect-dependency values does not fire — the assembly-screen pattern.

/** Grade the chosen option. Returns "right", "retry" (wrong, still open), or
 * "locked" (wrong, out of retries — the answer is revealed). */
function submitCard(
  rt: RecRuntime,
  card: RecCard,
  choice: number,
  retries: number,
): "right" | "retry" | "locked" {
  const ok = gradeRecognition(card.item, choice);
  card.picked = choice;
  for (const f of card.item.facts) {
    const st = rt.stats[f];
    if (st.firstTryCorrect === null) {
      st.firstTryCorrect = ok;
      if (ok) st.firstTryCount = (st.firstTryCount ?? 0) + 1;
    }
  }
  if (ok) {
    if (card.tries === 0) rt.streak++;
    for (const f of card.item.facts) {
      rt.stats[f].everCorrect = true;
      rt.stats[f].correct++;
    }
    card.state = "right";
    return "right";
  }
  rt.streak = 0;
  card.tries++;
  for (const f of card.item.facts) rt.stats[f].misses++;
  if (card.tries > retries) {
    card.state = "wrong";
    return "locked";
  }
  return "retry";
}

function advance(rt: RecRuntime): void {
  rt.pos++;
}

export function SentenceListenScreen() {
  const { cfg } = useQuizConfig();
  const { history, loaded } = useHistory();
  const { active, finishQuiz, setProgress, saveNow } = useQuizSession();
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);
  const [shake, setShake] = useState(false);

  // Build only once history has arrived — an empty history would roll zero
  // items and wrongly show the empty state.
  const rt = active && loaded ? ensureRuntime(active, history) : null;

  const done = rt ? rt.cards.filter((c) => c.state !== "open").length : 0;
  const total = rt?.cards.length ?? 0;
  useEffect(() => {
    if (rt) setProgress({ done, total });
  }, [rt, done, total, setProgress]);

  // Play the sentence when a NEW card appears. Keyed on the position so it plays
  // once per card and is not re-spoken on every wrong-answer re-render. The
  // speaker button below is the only other way to hear it again.
  const playPos = rt && rt.cards.length > 0 ? rt.pos : null;
  const playText = rt && rt.cards[rt.pos] ? rt.cards[rt.pos].item.jp : null;
  useEffect(() => {
    if (playPos == null || !playText) return;
    speak(playText, cfg.voiceName);
    // Fires only when the card changes; the text and voice are stable for one
    // position, so keying on the position is the whole intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playPos]);

  if (!active) return null;
  if (!rt) return null; // history still loading
  if (rt.cards.length === 0) {
    // DRAFT copy.
    return (
      <div className="mx-auto mt-16 max-w-md text-center text-text-muted">
        Learn a few more words first. Listening to sentences will unlock once you
        know every word in a sentence.
      </div>
    );
  }

  const card = rt.cards[rt.pos];
  const item = card.item;
  const resolved = card.state !== "open";

  const replay = () => speak(item.jp, cfg.voiceName);

  const choose = (i: number) => {
    if (resolved) return;
    const out = submitCard(rt, card, i, retriesAllowed(cfg));
    saveNow();
    if (out !== "right") {
      setShake(true);
      window.setTimeout(() => setShake(false), 460);
    }
    rerender();
  };

  const next = () => {
    if (rt.pos + 1 >= rt.cards.length) {
      finishQuiz(rt.stats);
      return;
    }
    advance(rt);
    saveNow();
    rerender();
  };

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <div className="mb-6 flex items-center justify-between text-sm text-text-muted">
        <span className="rounded-full border border-border bg-accent-bg px-3 py-1 text-[13px] font-medium text-accent tabular-nums">
          {rt.pos + 1} / {rt.cards.length}
        </span>
        <span className="tabular-nums" aria-hidden>
          {rt.streak > 0 ? `\u{1F525} ${rt.streak}` : ""}
        </span>
      </div>

      <div
        className={`kq-material rounded-2xl border bg-card p-8 shadow-card ${
          card.state === "right" ? "border-success" : "border-border"
        }`}
      >
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Listen, then pick the meaning
          </div>
          {/* The audio IS the prompt: play, and replay, but never the text. The
              written sentence appears only after the card resolves. */}
          <button
            type="button"
            onClick={replay}
            aria-label="Play the sentence again"
            className={`mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-panel px-5 py-3 text-lg hover:border-accent ${
              shake ? "animate-gshake" : ""
            }`}
          >
            <span aria-hidden>🔊</span>
            <span className="text-sm text-text-muted">Play again</span>
          </button>
        </div>

        <ul className="mt-6 flex flex-col gap-2">
          {item.options.map((opt, i) => {
            const isAnswer = i === item.correct;
            const isPicked = card.picked === i;
            const tone = resolved
              ? isAnswer
                ? "border-success bg-success-bg text-success"
                : isPicked
                  ? "border-danger bg-danger/10 text-text"
                  : "border-border bg-card text-text-muted"
              : "border-border bg-card text-text hover:bg-panel";
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={resolved}
                  onClick={() => choose(i)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-base ${tone}`}
                >
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>

        {resolved ? (
          <div lang="ja" className="mt-5 text-center text-base text-text-muted">
            {item.jp}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          {resolved ? (
            <Btn go onClick={next}>
              Next
            </Btn>
          ) : (
            <GhostBtn onClick={replay}>Play again</GhostBtn>
          )}
        </div>
      </div>
    </div>
  );
}
