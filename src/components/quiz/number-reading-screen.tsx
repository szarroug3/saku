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

import { Btn, SmallBtn, SoundIcon } from "@/components/ui";
import {
  buildNumberRound,
  gradeNumberItem,
  type NumberQuizConfig,
  type NumberQuizItem,
} from "@/lib/engine/number-quiz";
import type { CounterKind } from "@/lib/number-reading";
import { pickFont } from "@/lib/config";
import { fitGlyphSize } from "@/lib/glyph-fit";
import { toKana } from "@/lib/romaji";
import { speak } from "@/lib/speech";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ActiveQuiz } from "@/lib/quiz-session";

import { DrillHalo, GLYPH_PX, type HaloState } from "./drill-halo";

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
  const inputRef = useRef<HTMLInputElement>(null);
  // The prompt font, rolled ONCE per card (keyed by position) so it stays put
  // across keystrokes and re-renders — the drill keeps its q.font the same way.
  const fontRef = useRef<{ pos: number; font: string } | null>(null);

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
    rerender();
  };

  const next = () => {
    rt.pos++;
    saveNow();
    rerender();
  };

  // The prompt glyph the halo shows: the digits (+ counter) for READ, the kana
  // reading for WRITE. jp on both so it renders on one pre-fitted line.
  const haloGlyph = isRead ? digitPrompt(item) : item.reading;
  const counterGlyph = item.counter ? COUNTER_GLYPH[item.counter] : "";

  // The ring speaks the same three states the drill's does: still while you
  // think, green when right, red when wrong. No timer here, so it never drains.
  const haloState: HaloState =
    card.state === "right" ? "right" : card.state === "wrong" ? "wrong" : "resting";

  const isLast = rt.pos + 1 >= rt.cards.length;
  const pct = total ? Math.round((100 * done) / total) : 0;

  if (!fontRef.current || fontRef.current.pos !== rt.pos) {
    fontRef.current = { pos: rt.pos, font: pickFont(cfg.fonts) };
  }
  const cardFont = fontRef.current.font;

  return (
    <div>
      {/* The drill's top band, same layout every quiz uses — count pill(s) on
          the left, End quiz on the right, a progress hairline below (see
          pairs-hud / grid-hud). No gear: Numbers has no timer, streak or retries
          to instrument, so there is nothing a settings drawer would hold. */}
      <div className="kq-band sticky top-0 z-10 border-b border-border px-3 py-1.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="kq-material rounded-full border border-accent/40 bg-accent-bg px-3 py-1 text-[13px] font-semibold tabular-nums text-accent">
              {done} / {total}
            </span>
            {rt.correct > 0 ? (
              <span className="kq-material rounded-full border border-border px-2.5 py-0.5 text-[11px] tabular-nums text-text-muted">
                ✓ {rt.correct}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-1.5">
            <SmallBtn onClick={() => finishQuiz({})}>End quiz</SmallBtn>
          </span>
        </div>
        <div className="h-(--bar-h) overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{
              width: `${Math.min(100, pct)}%`,
              boxShadow:
                "0 0 8px color-mix(in srgb, var(--accent) 55%, transparent)",
            }}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 pt-10 pb-4">
        <DrillHalo
          // Re-mounts per card so the glyph cross-fades in like the drill's.
          key={rt.pos}
          cardKey={`${rt.pos}`}
          state={haloState}
          timerLeft={0}
          drainWindow={0}
          glyph={haloGlyph}
          jp
          font={cardFont}
          fontSize={fitGlyphSize(haloGlyph, true, GLYPH_PX)}
          maxFontSize={GLYPH_PX}
          crossFade={card.state === "open"}
          // WRITE shows the reading you must count out, with the counter kanji
          // beneath it in the halo's context slot. The reading stays READABLE —
          // the 🔊 below just replays it, it doesn't hide it.
          context={
            !isRead && counterGlyph ? (
              <span className="text-[20px] leading-none text-text" lang="ja">
                {counterGlyph}
              </span>
            ) : undefined
          }
        />

        {/* WHAT THIS CARD IS ASKING FOR — white, below the halo, like the drill. */}
        <p className="mt-1 text-center text-[15px] font-medium text-text">
          {isRead ? "Read this number" : "Write the number"}
        </p>

        {/* WRITE: hear the reading again. The reading is already on the ring, so
            this replays rather than reveals. */}
        {!isRead ? (
          <button
            type="button"
            onClick={() => speak(item.reading, cfg.voiceName)}
            aria-label="Hear it"
            className="kq-material flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-text-muted hover:border-accent"
          >
            <SoundIcon className="size-4" />
            Hear it
          </button>
        ) : null}

        {/* The drill's typed-answer field, in a tight column with the line that
            says what goes in it. Stays mounted and shows the typed answer once
            resolved (readOnly), the way the drill leaves its box at the reveal —
            Enter then advances instead of re-grading. */}
        <span className="flex flex-col items-center gap-1.5">
          <input
            key={rt.pos}
            ref={inputRef}
            autoFocus
            value={card.value}
            lang={isRead ? "ja" : undefined}
            inputMode={isRead ? "text" : "numeric"}
            autoComplete="off"
            spellCheck={false}
            readOnly={resolved}
            aria-label={
              isRead
                ? `Read ${digitPrompt(item)}`
                : `Write the number for ${item.reading}`
            }
            placeholder={isRead ? "Type the reading" : "Type the number"}
            className={`kq-material w-[270px] rounded-lg border border-border bg-card px-3 py-2 text-center text-lg text-text outline-none focus:border-accent${
              isRead ? "" : " tabular-nums"
            }`}
            onChange={(e) => {
              if (resolved) return;
              setValue(
                card,
                isRead ? toKana(e.target.value, { live: true }) : e.target.value,
              );
              rerender();
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (resolved) next();
              else submit();
            }}
          />
          <span className="text-[11px] text-text-muted">
            {isRead
              ? "romaji turns to kana · Enter to check"
              : "digits · Enter to check"}
          </span>
        </span>

        {/* The reveal + the way forward, the drill's shape: a miss names the
            answer colour can't; a hit needs no words, the green ring said it.
            Fixed min-height so the stage doesn't jump on resolve. */}
        <div className="flex min-h-[56px] flex-col items-center justify-center gap-2">
          {card.state === "wrong" ? (
            <span className="text-sm">
              <span className="text-text-muted">Answer</span>{" "}
              <span className="text-text-muted">=</span>{" "}
              <span
                lang={isRead ? "ja" : undefined}
                className="font-semibold text-danger"
              >
                {isRead ? item.reading : item.digits}
              </span>
            </span>
          ) : null}
          {resolved ? (
            <SmallBtn onClick={next} title="Continue (Enter)">
              {isLast ? "See score" : "Continue"}
            </SmallBtn>
          ) : null}
        </div>
      </div>
    </div>
  );
}
