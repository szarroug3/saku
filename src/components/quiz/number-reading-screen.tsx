"use client";

// NUMBER READING screen — the PROCEDURAL number-reading quiz. Generates a round
// of random numbers and counted forms (irregular-first) and grades typed
// answers. Modeled on substitution-screen.tsx: it ignores active.facts, builds
// its runtime ONCE from a fixed config, stores it under active.runtime
// .numberReading mutated in place, and flushes with saveNow() on every change so
// a refresh resumes the same round rather than re-rolling.
//
// EPHEMERAL — NO SRS WRITES. These items are generated, not curriculum facts, so
// the round writes NOTHING to history: the end "Done" calls finishQuiz({}) with
// empty stats, which computeResults short-circuits (!s.total) straight back to
// "/", committing no record. The score is shown inline on this screen instead.
//
// Two directions, both graded by the pure engine (lib/engine/number-quiz.ts):
//   READ  — shown the digits (+ counter glyph, "3 本"), type the reading; live
//           romaji→kana as you type, graded against the engine's accept set.
//   WRITE — shown/heard the reading, type the count as digits; plain numeric
//           input, no kana conversion. A "Hear it" speaker plays the reading.
//
// Copy here is DRAFT and flagged for the owner's voice pass.

import { useEffect, useRef, useState } from "react";

import { Btn, GhostBtn } from "@/components/ui";
import {
  buildNumberRound,
  gradeNumberItem,
  type NumberQuizConfig,
  type NumberQuizItem,
} from "@/lib/engine/number-quiz";
import type { CounterKind } from "@/lib/number-reading";
import { toKana } from "@/lib/romaji";
import { speak } from "@/lib/speech";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ActiveQuiz } from "@/lib/quiz-session";

/** The Practice-launch config. tsu is left out for now — it's memorization,
 * handled separately later. */
const DEFAULT_CONFIG: NumberQuizConfig = {
  count: 10,
  includeCounters: true,
  counters: ["nin", "hon", "hiki", "mai", "ko", "dai"],
  numberMax: 9999,
  directions: ["read", "write"],
};

/** The kanji shown as context beside a counted form. */
const COUNTER_GLYPH: Record<CounterKind, string> = {
  tsu: "つ",
  nin: "人",
  hon: "本",
  hiki: "匹",
  mai: "枚",
  ko: "個",
  dai: "台",
  satsu: "冊",
  hai: "杯",
  kai: "回",
  sai: "歳",
};

interface NumCard {
  item: NumberQuizItem;
  value: string;
  state: "open" | "right" | "wrong";
}

interface NumRuntime {
  cards: NumCard[];
  pos: number;
  correct: number;
}

function buildRuntime(): NumRuntime {
  const items = buildNumberRound(DEFAULT_CONFIG, Math.random);
  return { cards: items.map((item) => ({ item, value: "", state: "open" })), pos: 0, correct: 0 };
}

function ensureRuntime(active: ActiveQuiz): NumRuntime {
  const rt = active.runtime as { numberReading?: NumRuntime };
  return (rt.numberReading ??= buildRuntime());
}

// ---------- mutations (module-level, runtime passed in) ----------

/** Grade the card's current input and lock it right/wrong. */
function submitCard(rt: NumRuntime, card: NumCard): "right" | "wrong" | "noop" {
  if (card.state !== "open") return "noop";
  const given = card.value.trim();
  if (!given) return "noop";
  const ok = gradeNumberItem(card.item, given);
  if (ok) {
    card.state = "right";
    rt.correct++;
    return "right";
  }
  card.state = "wrong";
  return "wrong";
}

function setValue(card: NumCard, value: string): void {
  card.value = value;
}

/** The digit prompt for a READ card: "3 本" or "47". */
function digitPrompt(item: NumberQuizItem): string {
  return item.counter
    ? `${item.digits} ${COUNTER_GLYPH[item.counter]}`
    : item.digits;
}

export function NumberReadingScreen() {
  const { cfg } = useQuizConfig();
  const { active, finishQuiz, setProgress, saveNow } = useQuizSession();
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rt = active ? ensureRuntime(active) : null;

  const done = rt ? rt.cards.filter((c) => c.state !== "open").length : 0;
  const total = rt?.cards.length ?? 0;
  useEffect(() => {
    if (rt) setProgress({ done, total });
  }, [rt, done, total, setProgress]);

  useEffect(() => {
    inputRef.current?.focus();
  });

  if (!active) return null;
  if (!rt) return null;
  if (rt.cards.length === 0) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center text-text-muted">
        Nothing to drill right now.
      </div>
    );
  }

  const atEnd = rt.pos >= rt.cards.length;

  // End summary — inline score, then a Done that exits WITHOUT writing history.
  if (atEnd) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Number reading
        </div>
        <div className="mt-3 text-4xl font-semibold tabular-nums">
          {rt.correct} / {rt.cards.length}
        </div>
        <p className="mt-2 text-sm text-text-muted">
          Numbers are practice only — nothing here changes your review schedule.
        </p>
        <div className="mt-6">
          <Btn go onClick={() => finishQuiz({})}>
            Done
          </Btn>
        </div>
      </div>
    );
  }

  const card = rt.cards[rt.pos];
  const item = card.item;
  const resolved = card.state !== "open";
  const isRead = item.direction === "read";

  const submit = () => {
    const out = submitCard(rt, card);
    if (out === "noop") return;
    saveNow();
    if (out !== "right") {
      setShake(true);
      window.setTimeout(() => setShake(false), 460);
    }
    rerender();
  };

  const next = () => {
    rt.pos++;
    saveNow();
    rerender();
  };

  const glyph = item.counter ? COUNTER_GLYPH[item.counter] : "";

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <div className="mb-6 flex items-center justify-between text-sm text-text-muted">
        <span className="rounded-full border border-border bg-accent-bg px-3 py-1 text-[13px] font-medium text-accent tabular-nums">
          {rt.pos + 1} / {rt.cards.length}
        </span>
        <span className="tabular-nums" aria-hidden>
          {rt.correct > 0 ? `✓ ${rt.correct}` : ""}
        </span>
      </div>

      <div
        className={`kq-material rounded-2xl border bg-card p-8 shadow-card ${
          card.state === "right"
            ? "border-success"
            : card.state === "wrong"
              ? "border-danger"
              : "border-border"
        }`}
      >
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {isRead ? "Read this" : "Write the number"}
          </div>

          {isRead ? (
            <div className="mt-3 text-5xl font-semibold tabular-nums" lang="ja">
              {digitPrompt(item)}
            </div>
          ) : (
            <div className="mt-3">
              <div className="text-4xl font-semibold" lang="ja">
                {item.reading}
              </div>
              {glyph ? (
                <div className="mt-1 text-sm text-text-muted" lang="ja">
                  counter: {glyph}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => speak(item.reading, cfg.voiceName)}
                aria-label="Hear it"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-panel px-4 py-2 text-sm hover:border-accent"
              >
                <span aria-hidden>🔊</span>
                <span className="text-text-muted">Hear it</span>
              </button>
            </div>
          )}
        </div>

        <div className={`mt-6 ${shake ? "animate-gshake" : ""}`}>
          {resolved ? (
            <div
              className={`rounded-xl border p-4 text-xl ${
                card.state === "right"
                  ? "border-success bg-success-bg"
                  : "border-danger bg-danger-bg"
              }`}
            >
              {card.state === "right" ? (
                <span lang={isRead ? "ja" : undefined}>{card.value}</span>
              ) : (
                <span>
                  <span className="text-text-muted">Answer: </span>
                  <span lang={isRead ? "ja" : undefined} className="font-semibold">
                    {isRead ? item.reading : item.digits}
                  </span>
                </span>
              )}
            </div>
          ) : isRead ? (
            <input
              ref={inputRef}
              value={card.value}
              lang="ja"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              aria-label={`Read ${digitPrompt(item)}`}
              placeholder="Type the reading (romaji turns to kana)"
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
          ) : (
            <input
              ref={inputRef}
              value={card.value}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              aria-label={`Write the number for ${item.reading}`}
              placeholder="Type the number"
              className="w-full rounded-xl border border-border bg-panel p-4 text-xl tabular-nums outline-none focus:border-accent"
              onChange={(e) => {
                setValue(card, e.target.value);
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
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          {resolved ? (
            <Btn go onClick={next}>
              {rt.pos + 1 >= rt.cards.length ? "See score" : "Next"}
            </Btn>
          ) : (
            <GhostBtn onClick={submit}>Submit</GhostBtn>
          )}
        </div>
      </div>
    </div>
  );
}
