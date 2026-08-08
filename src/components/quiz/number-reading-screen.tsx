"use client";

// NUMBER READING screen — the PROCEDURAL number-reading quiz. Generates a round
// of random numbers and counted forms (irregular-first) and grades typed
// answers. Modeled on substitution-screen.tsx for its RUNTIME (ignores
// active.facts, builds its runtime ONCE from a fixed config, mutates it in place
// under active.runtime.numberReading, flushes with saveNow() on every change so a
// refresh resumes the same round rather than re-rolling) and on drill-screen.tsx
// for its PRESENTATION — the same top band, the same DrillHalo, the same white
// instruction, the same typed-answer field and control row, so it reads as the
// same quiz as every other drill. It does NOT route through DrillScreen/FactId;
// it stays a standalone procedural screen.
//
// EPHEMERAL — NO SRS WRITES. These generated items are never curriculum facts, so
// the round writes no per-item history. TWO LAUNCH CONTEXTS, told apart by whether
// there is a SESSION:
//
//   PRACTICE (no session): a one-off quiz. "Done" calls finishQuiz({}) with empty
//   stats, which computeResults short-circuits (!s.total) straight back to "/",
//   committing no record. The score is shown inline here. Config is DEFAULT.
//
//   LESSON DRILL (a session with a NUMBER-unit marker as its teach set): the round
//   is scoped by active.numberQuiz, and "Done" COMPLETES the session (endSession →
//   Session complete → its Done → finishSession) so the marker teach set is claimed
//   the same way any lesson's is, and the counters scheduler advances to the next
//   unit. A generative round has no SRS facts, so closeRound banks an empty round
//   (buildSessionRecord returns null) and no junk record is written.
//
// THREE card types, split like the drill splits a word into hear / read / write:
//   READ  — shown the digits (+ counter glyph, "3 本"), type the reading; live
//           romaji→kana as you type, graded against the engine's accept set. The
//           drill's visual-prompt → typed-answer card. No speaker.
//   HEAR  — the reading is PLAYED (DrillHalo listen mode: speaker in the ring,
//           glyph hidden), type the count as DIGITS; graded against item.digits.
//           The drill's listening card, standalone.
//   WRITE — shown the kana READING (visible, not listen mode), type the count as
//           DIGITS; graded against item.digits. No speaker — audio is HEAR's job.

import { useEffect, useRef, useState } from "react";

import { Btn, SmallBtn } from "@/components/ui";
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
 * handled separately later. Mixes all three card types — read / write / hear —
 * the way the owner asked: "we do hear and read → english separately." */
const DEFAULT_CONFIG: NumberQuizConfig = {
  count: 12,
  includeCounters: true,
  counters: ["nin", "hon", "hiki", "mai", "ko", "dai"],
  numberMax: 9999,
  directions: ["read", "write", "hear"],
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

/** Small kana that ride the previous character as one mora — so a first-mora
 * hint reveals きゃ, not a bare き. */
const SMALL_KANA = new Set([
  "ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゎ",
  "ャ", "ュ", "ョ", "ァ", "ィ", "ゥ", "ェ", "ォ", "ヮ",
]);

/** The first mora of a reading — the READ card's hint. A genuine partial answer
 * (the first sound), never the whole thing. */
function firstMora(reading: string): string {
  const chars = [...reading];
  if (chars.length === 0) return "";
  let out = chars[0];
  if (chars[1] && SMALL_KANA.has(chars[1])) out += chars[1];
  return out;
}

interface NumCard {
  item: NumberQuizItem;
  value: string;
  state: "open" | "right" | "wrong";
  /** Whether a HEAR card has already auto-played, so a re-render / StrictMode
   * double-invoke doesn't replay it — the drill guards its listening card the
   * same way (q.listenPlayed). */
  played?: boolean;
  /** Whether the hint has been taken on this card (READ only). */
  hinted?: boolean;
}

interface NumRuntime {
  cards: NumCard[];
  pos: number;
  correct: number;
  /** Bumps every time the VISIBLE card changes (advance or skip). The autoplay
   * effect keys on it so a HEAR card plays on arrival even when a skip leaves
   * `pos` numerically unchanged. */
  seq: number;
}

function buildRuntime(config: NumberQuizConfig): NumRuntime {
  const items = buildNumberRound(config, Math.random);
  return {
    cards: items.map((item) => ({ item, value: "", state: "open" })),
    pos: 0,
    correct: 0,
    seq: 0,
  };
}

function ensureRuntime(active: ActiveQuiz): NumRuntime {
  const rt = active.runtime as { numberReading?: NumRuntime };
  // A NUMBER-unit lesson carries a range-scoped config (active.numberQuiz); a
  // one-off Practice quiz carries none and gets the full DEFAULT round. Built
  // ONCE per leg and cached under runtime, so the round is stable across
  // re-renders and a refresh resumes it rather than re-rolling.
  const built = (rt.numberReading ??= buildRuntime(
    active.numberQuiz ?? DEFAULT_CONFIG,
  ));
  // Resuming a runtime written before `seq` existed.
  if (typeof built.seq !== "number") built.seq = 0;
  return built;
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

/** The READ card's prompt: the number written in KANJI — 十七, 三百, 三本, 十七人.
 * The card asks how the written number is said, so it shows the number the way it
 * appears in the wild (baked on the item by countToKanji), not the bare digit.
 * The counter kanji is already welded in for a counted form, so READ needs no
 * separate counter glyph beneath it. */
function readPrompt(item: NumberQuizItem): string {
  return item.promptKanji;
}

export function NumberReadingScreen() {
  const { cfg } = useQuizConfig();
  const { active, session, finishQuiz, endSession, setProgress, saveNow } =
    useQuizSession();
  // A lesson drill runs inside a session (its teach set is a NUMBER-unit marker);
  // a Practice quiz has no session. That is the whole distinction — see the file
  // header. `finish` routes each to its own completion.
  const inLesson = !!session;
  const finish = () => {
    if (inLesson) endSession();
    else finishQuiz({});
  };
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

  // Play a HEAR card's reading when it arrives, and only then — the drill plays
  // its listening card the same way (see the drill's listenPlay effect). Keyed on
  // `seq`, which ticks per card change, so a skip that leaves `pos` unchanged
  // still replays; the `played` guard stops a StrictMode double-invoke.
  const seq = rt?.seq ?? 0;
  useEffect(() => {
    if (!rt) return;
    const c = rt.cards[rt.pos];
    if (!c || c.item.direction !== "hear" || c.state !== "open" || c.played)
      return;
    c.played = true;
    speak(c.item.reading, cfg.voiceName);
    // Fires only when a NEW card is shown; the reading and voice are stable for
    // one `seq`, so keying on the card change is the whole intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

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
          <Btn go onClick={finish}>
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
  const isHear = item.direction === "hear";
  // READ types kana; HEAR and WRITE both type the count as digits.
  const digitAnswer = !isRead;

  const submit = () => {
    const out = submitCard(rt, card);
    if (out === "noop") return;
    saveNow();
    rerender();
  };

  const next = () => {
    rt.pos++;
    rt.seq++;
    saveNow();
    rerender();
  };

  // Skip — the drill's "ask this again later": defer the current card to the END
  // of the round and advance. Never scored (open cards don't count as done), so a
  // skipped card simply comes back around, exactly like the drill's Skip.
  const skip = () => {
    if (resolved) return;
    rt.cards.splice(rt.pos, 1);
    rt.cards.push({ ...card, value: "", state: "open", played: false, hinted: false });
    rt.seq++; // the next card shifted into `pos`; force the autoplay effect to re-run
    saveNow();
    rerender();
  };

  // Hint — READ only, and the drill's rule: a hint is a genuine partial answer,
  // so it belongs where the answer is producible, not where it's basically the
  // whole thing. On a READ card that's the first mora of the reading; HEAR/WRITE
  // want a NUMBER, and revealing a digit would be the answer, so they get no Hint
  // — the same reason the drill hides Hint on multiple choice.
  const hintAvailable = isRead && !resolved;
  const takeHint = () => {
    if (!hintAvailable) return;
    card.hinted = true;
    rerender();
  };

  // The prompt glyph the halo shows: the number in kanji (十七, 三本) for READ, the
  // kana reading for WRITE. HEAR hides the glyph (listen mode) and ignores it. jp
  // so the visual prompts render on one pre-fitted line.
  const haloGlyph = isRead ? readPrompt(item) : item.reading;
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

  // What this card is asking for — the drill's white instruction line. A READ
  // card mirrors the word track's exact reading-card phrasing ("Type how this
  // word is said." — see isSound in quiz-instruction.ts) instead of a bespoke
  // "Read this number"; WRITE and HEAR ask for digits, so they keep their own
  // sensible wording.
  const instruction = isRead
    ? "Type how this word is said."
    : isHear
      ? "Write the number you hear"
      : "Write the number";

  // The counter kanji, shown INSIDE the halo beneath the reading (WRITE) or the
  // speaker (HEAR) — the drill's `context` slot. READ needs none: its digit
  // prompt already carries the counter inline ("3 本").
  const haloContext =
    !isRead && counterGlyph ? (
      <span className="text-[20px] leading-none text-text" lang="ja">
        {counterGlyph}
      </span>
    ) : undefined;

  return (
    <div>
      {/* The drill's top band, same layout every quiz uses — count pill on the
          left, End quiz on the right, a progress hairline below. No gear: Numbers
          has no timer, streak or retries to instrument, so there is nothing a
          settings drawer would hold. */}
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
            <SmallBtn onClick={finish}>End quiz</SmallBtn>
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
          // HEAR is the drill's listening card: the audio IS the prompt, so the
          // ring holds a speaker (press to replay) and the glyph is hidden. READ
          // and WRITE show their glyph and have no speaker.
          listen={isHear}
          onListen={() => speak(item.reading, cfg.voiceName)}
          // The counter kanji under the reading (WRITE) / speaker (HEAR).
          context={haloContext}
        />

        {/* WHAT THIS CARD IS ASKING FOR — white, below the halo, like the drill. */}
        <p className="mt-1 text-center text-[15px] font-medium text-text">
          {instruction}
        </p>

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
                ? `Read ${readPrompt(item)}`
                : isHear
                  ? "Write the number you hear"
                  : `Write the number for ${item.reading}`
            }
            placeholder={isRead ? "Type the reading" : "Type the number"}
            className={`kq-material w-[270px] rounded-lg border border-border bg-card px-3 py-2 text-center text-lg text-text outline-none focus:border-accent${
              digitAnswer ? " tabular-nums" : ""
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
        <p
          className={`flex min-h-[38px] flex-col items-center justify-center gap-0.5${
            resolved ? "" : " hidden"
          }`}
        >
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
        </p>

        {/* The control row, the drill's exact shape and position: Skip (always)
            and — on a READ card — Hint, both w-20 Btns in a centered gap-3 row,
            with the hint content revealed beneath. Hidden once the card resolves,
            the way the drill hides its controls at the reveal. */}
        <span
          className={`flex flex-col items-center gap-3${
            resolved ? " invisible pointer-events-none" : ""
          }`}
          aria-hidden={resolved ? true : undefined}
        >
          <span className="flex items-center justify-center gap-3">
            <Btn
              className="w-20"
              onClick={skip}
              title="Skip — ask this again later"
            >
              Skip
            </Btn>
            {hintAvailable ? (
              <Btn
                className="w-20"
                onClick={takeHint}
                disabled={card.hinted}
                title="Hint — reveal the first sound"
              >
                Hint
              </Btn>
            ) : null}
          </span>
          {card.hinted && isRead ? (
            <span className="flex flex-col items-center gap-0.5">
              <span
                className="text-3xl leading-none text-text"
                lang="ja"
                style={{ fontFamily: cardFont }}
              >
                {firstMora(item.reading)}…
              </span>
              <span className="text-[12px] text-text-muted">starts like this</span>
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
