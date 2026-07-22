"use client";

// GUIDED SUBSTITUTION screen (task 11). "You know 食べてから, now say it about
// 行く." A typed card: shown a pattern built on a verb the learner knows, asked
// to build the SAME pattern on a different known verb, graded by the existing
// forgiving romaji check (lib/engine/substitution.ts → the grammar production
// QuestionType). No new grading, no new corpus.
//
// All resumable state lives in active.runtime.substitution, mutated in place and
// flushed with saveNow() on every change — the same discipline grid-screen.tsx
// documents at length. The items are rolled ONCE at init from the learner's
// history, so a refresh resumes the same cards rather than re-rolling under the
// user's hands.
//
// Copy is the approved mockup's ("You already know", "Write X using the same
// form as Y", meanings behind a Hint button, green-only grading). Any wording
// not in the mockup is DRAFT and flagged.

import { useEffect, useRef, useState } from "react";

import { Btn, GhostBtn } from "@/components/ui";
import { newFactStat, retriesAllowed } from "@/lib/engine";
import {
  gradeSubstitution,
  pickSubstitution,
  type SubstitutionItem,
} from "@/lib/engine/substitution";
import { vocabRow } from "@/data/vocab";
import { toKana } from "@/lib/romaji";
import { useHistory } from "@/lib/use-history";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ActiveQuiz } from "@/lib/quiz-session";
import type { SessionStats } from "@/types";

const TARGET = 12;

interface SubCard {
  item: SubstitutionItem;
  value: string;
  state: "open" | "right" | "wrong";
  tries: number;
}

interface SubRuntime {
  cards: SubCard[];
  pos: number;
  streak: number;
  stats: SessionStats;
}

function buildRuntime(history: Parameters<typeof pickSubstitution>[0]): SubRuntime {
  const cards: SubCard[] = [];
  const stats: SessionStats = {};
  // Roll TARGET items. pickSubstitution is random per call; a learner who knows
  // enough verbs never runs dry, and one who does not yields an empty runtime
  // (handled by the empty state below).
  for (let i = 0; i < TARGET; i++) {
    const item = pickSubstitution(history);
    if (!item) break;
    cards.push({ item, value: "", state: "open", tries: 0 });
    if (!stats[item.fact]) stats[item.fact] = newFactStat();
    stats[item.fact].seen++;
  }
  return { cards, pos: 0, streak: 0, stats };
}

function ensureRuntime(active: ActiveQuiz, history: Parameters<typeof pickSubstitution>[0]): SubRuntime {
  const rt = active.runtime as { substitution?: SubRuntime };
  return (rt.substitution ??= buildRuntime(history));
}

// ---------- mutations (module-level, runtime passed in) ----------
//
// Passed the runtime rather than closing over it, so the immutability lint that
// guards effect-dependency values does not fire — the grid-screen pattern.

/** Grade the card's current input. Returns "right", "retry", or "locked". */
function submitCard(
  rt: SubRuntime,
  card: SubCard,
  retries: number,
): "right" | "retry" | "locked" | "noop" {
  if (card.state !== "open") return "noop";
  const given = card.value.trim();
  if (!given) return "noop";
  const st = rt.stats[card.item.fact];
  const ok = gradeSubstitution(card.item, given);
  if (st.firstTryCorrect === null) {
    st.firstTryCorrect = ok;
    if (ok) st.firstTryCount = (st.firstTryCount ?? 0) + 1;
  }
  if (ok) {
    if (card.tries === 0) rt.streak++;
    st.everCorrect = true;
    st.correct++;
    card.state = "right";
    return "right";
  }
  rt.streak = 0;
  st.misses++;
  card.tries++;
  if (card.tries > retries) {
    card.state = "wrong";
    return "locked";
  }
  return "retry";
}

function setValue(card: SubCard, value: string): void {
  card.value = value;
}

function advance(rt: SubRuntime): void {
  rt.pos++;
}

/** The first gloss of a verb, for the meaning hint. DRAFT: single gloss. */
function gloss(surface: string): string {
  return vocabRow(surface)?.glosses[0] ?? "";
}

export function SubstitutionScreen() {
  const { cfg } = useQuizConfig();
  const { history, loaded } = useHistory();
  const { active, finishQuiz, setProgress, saveNow } = useQuizSession();
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);
  const [hintOpen, setHintOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build only once history has actually arrived — an empty EMPTY history would
  // roll zero items and wrongly show the empty state.
  const rt = active && loaded ? ensureRuntime(active, history) : null;

  const done = rt ? rt.cards.filter((c) => c.state !== "open").length : 0;
  const total = rt?.cards.length ?? 0;
  useEffect(() => {
    if (rt) setProgress({ done, total });
  }, [rt, done, total, setProgress]);

  useEffect(() => {
    inputRef.current?.focus();
  });

  if (!active) return null;
  if (!rt) return null; // history still loading
  if (rt.cards.length === 0) {
    // DRAFT copy.
    return (
      <div className="mx-auto mt-16 max-w-md text-center text-text-muted">
        Learn a few verbs first, then come back to practise saying a form you
        know about a new one.
      </div>
    );
  }

  const card = rt.cards[rt.pos];
  const item = card.item;

  const finish = () => finishQuiz(rt.stats);

  const submit = () => {
    const out = submitCard(rt, card, retriesAllowed(cfg));
    if (out === "noop") return;
    saveNow();
    if (out !== "right") {
      setShake(true);
      window.setTimeout(() => setShake(false), 460);
    }
    rerender();
  };

  const next = () => {
    setHintOpen(false);
    if (rt.pos + 1 >= rt.cards.length) {
      finish();
      return;
    }
    advance(rt);
    saveNow();
    rerender();
  };

  const resolved = card.state !== "open";
  const answer = item.target.form; // 行ってから — the one correct form

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
            You already know
          </div>
          <div className="mt-2 text-3xl font-semibold" lang="ja">
            {item.demo.form}
          </div>
        </div>

        <p className="mt-6 text-center text-lg">
          Write{" "}
          <b lang="ja" className="font-semibold">
            {item.target.surface}
          </b>{" "}
          using the same form as{" "}
          <b lang="ja" className="font-semibold">
            {item.demo.form}
          </b>
          .
        </p>

        <div className={`mt-6 ${shake ? "animate-gshake" : ""}`}>
          {resolved ? (
            <div
              lang="ja"
              className={`rounded-xl border p-4 text-xl ${
                card.state === "right"
                  ? "border-success bg-success-bg"
                  : "border-border"
              }`}
            >
              {card.state === "right" ? card.value : answer}
            </div>
          ) : (
            <input
              ref={inputRef}
              value={card.value}
              lang="ja"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              aria-label={`Write ${item.target.surface} using the same form as ${item.demo.form}`}
              placeholder="Type romaji, Enter to submit"
              className="w-full rounded-xl border border-border bg-panel p-4 text-xl outline-none focus:border-accent"
              onChange={(e) => {
                setValue(card, toKana(e.target.value, { live: true }));
                rerender();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          )}
          {!resolved ? (
            <div className="mt-2 pl-1 text-xs text-text-muted">
              Romaji turns into kana as you type.
            </div>
          ) : null}
        </div>

        {hintOpen ? (
          <div className="mt-4 rounded-xl border border-border bg-accent-bg p-3 text-sm">
            <span lang="ja" className="font-medium">
              {item.target.surface}
            </span>{" "}
            {gloss(item.target.surface)} ·{" "}
            <span lang="ja" className="font-medium">
              {item.demo.form}
            </span>{" "}
            {gloss(item.demo.surface)} form
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          {resolved ? (
            <Btn go onClick={next}>
              Next
            </Btn>
          ) : (
            <>
              <GhostBtn onClick={() => setHintOpen((h) => !h)}>
                {hintOpen ? "Hide hint" : "Hint"}
              </GhostBtn>
              <Btn go onClick={submit}>
                Submit
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
