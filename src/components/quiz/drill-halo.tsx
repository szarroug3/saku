"use client";

// The halo — the ring around the drill glyph.
//
// The organizing rule is that motion means something, so the ring only moves
// when it has something to say: a still glow while you think (and ALWAYS when
// the timer is off), waking only for the final seconds of the countdown, a
// correct answer, or a wrong one. A ring draining for the whole card would sit
// in the periphery of the one glyph you're trying to read.
//
// Structure (per the comp): a base circle — soft inner glow, hairline edge,
// and an outer glow whose colour follows the state — with, in the non-resting
// states, a conic-gradient arc laid over it and masked to a ring band
// (`mask: radial-gradient(circle, transparent 84px, #000 85px)`).
//
// The sweep animates through --kq-sweep, a REGISTERED custom property, which
// is the only way to interpolate a conic-gradient stop. Everything is drawn
// from theme tokens (--accent / --warning / --danger / --border), never hex,
// so all four themes work.
//
// The drain and the countdown: the timer ticks once a second, so the draining
// ring re-mounts on every tick (its key carries timerLeft) and restarts the
// window-long animation with a negative delay equal to the part already
// elapsed. Each restart lands exactly where the previous one had reached, so
// the drain reads as one continuous sweep instead of five one-second steps —
// and a resume (tab switch / refresh) mid-drain picks up at the right angle.
//
// prefers-reduced-motion is honored in CSS below: every animation is dropped
// and the inline --kq-sweep (always set to the state's resting value) stands,
// so the drain steps once a second and the answer states appear instantly.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { SoundIcon } from "@/components/ui";

/** resting = still · draining = final seconds · right/wrong = answered.
 * "wrong-flash" is a wrong answer with retries still left: it pulses out and
 * hands the ring back, where plain "wrong" holds until the next card. */
export type HaloState =
  | "resting"
  | "draining"
  | "right"
  | "wrong"
  | "wrong-flash";

/** Ring geometry, from the comp: a 176px halo whose band is the 84–88px
 * annulus, with the glyph at 78px inside it. */
const HALO_PX = 176;
export const GLYPH_PX = 78;

// SVG path tracing the halo rectangle starting at top-center, clockwise.
// viewBox is 440×176 (max container size); vector-effect keeps stroke at 2px on any width.
const HALO_PATH =
  "M 220,0 H 424 A 16,16 0 0,1 440,16 V 160 A 16,16 0 0,1 424,176 H 16 A 16,16 0 0,1 0,160 V 16 A 16,16 0 0,1 16,0 H 220";
// 2*(408+144) + 2π*16 ≈ 1205
const PERIMETER = 1205;

// The usable inner box for a WRAPPING text prompt. A lone glyph never fills it,
// so a single character still renders big and on one line.
const FIT_W = 150;
const FIT_H = 138;
/** The smallest a wrapped text cue is allowed to shrink to before it stops
 * being comfortably legible. Higher than the old single-line glyph floor: a cue
 * that is allowed to wrap has vertical room the one-line path never had, so it
 * reaches this floor only for genuinely long prompts. */
const TEXT_MIN_PX = 22;

/**
 * Split a "MAIN · QUALIFIER" prompt into its main text and a trailing qualifier.
 *
 * The qualifier is a disambiguator — keigo's productionCue appends "· more
 * deferential" so a register with two forms never asks one prompt with two right
 * answers — not the core question, so it drops to a smaller, quieter sub-line
 * rather than competing for space. ONLY the trailing " · " tail splits: a plain
 * glyph, a kanji, or a single-word cue has none and returns unchanged.
 */
function splitQualifier(text: string): { main: string; sub: string | null } {
  const sep = " · ";
  const at = text.lastIndexOf(sep);
  if (at <= 0) return { main: text, sub: null };
  return { main: text.slice(0, at), sub: text.slice(at + sep.length) };
}

/**
 * Shrink a font size until the referenced block fits the ring's inner box on
 * BOTH axes, never below the readable floor.
 *
 * Measurement, not arithmetic: the block WRAPS, so its height depends on where
 * the words break — a thing only the laid-out DOM knows. Runs in a layout effect
 * so the fitted size is in place before the browser paints (no flash of the
 * oversized prompt). `key` changes per card, which re-measures.
 */
function useFitFontSize(maxSize: number, key: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(maxSize);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = maxSize;
    el.style.fontSize = `${s}px`;
    while (
      s > TEXT_MIN_PX &&
      (el.scrollHeight > FIT_H || el.scrollWidth > el.clientWidth)
    ) {
      s -= 1;
      el.style.fontSize = `${s}px`;
    }
    setSize(s);
  }, [maxSize, key]);
  return [ref, size] as const;
}

const HALO_CSS = `
@keyframes kq-stroke-fill   { from { stroke-dashoffset: 1205; } to { stroke-dashoffset: 0; } }
@keyframes kq-stroke-fill-a { from { stroke-dashoffset: 1205; } to { stroke-dashoffset: 0; } }
@keyframes kq-stroke-fill-b { from { stroke-dashoffset: 1205; } to { stroke-dashoffset: 0; } }
@keyframes kq-glyph-in {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .kq-halo, .kq-ring, .kq-glyph, .kq-base {
    animation: none !important;
    transition: none !important;
  }
}
`;

interface FeedbackSpec {
  key: string;
  color: string;
  strokeDashoffset: number;
  animation: string;
}

/** SVG stroke feedback: fills outline clockwise from top-center for timer/correct, pulses for wrong. */
function feedbackSpec(
  state: HaloState,
  cardKey: string,
  timerLeft: number,
  drainWindow: number,
): FeedbackSpec | null {
  switch (state) {
    case "draining": {
      const left = Math.max(0, Math.min(drainWindow, timerLeft));
      // Alternate a/b so changing the name restarts the animation each tick without remounting.
      const name = left % 2 === 0 ? "kq-stroke-fill-a" : "kq-stroke-fill-b";
      return {
        key: `feedback-${cardKey}`,
        color: "var(--accent)",
        strokeDashoffset: PERIMETER,
        animation: `${name} ${drainWindow}s linear ${left - drainWindow}s forwards`,
      };
    }
    case "right":
      return { key: `feedback-${cardKey}`, color: "var(--accent)",      strokeDashoffset: PERIMETER, animation: "kq-stroke-fill 500ms ease-out forwards" };
    case "wrong":
    case "wrong-flash": {
      return { key: `feedback-${cardKey}`, color: "oklch(58% 0.22 25)", strokeDashoffset: PERIMETER, animation: "kq-stroke-fill 300ms ease-out forwards" };
    }
    default:
      return null;
  }
}

function mix(token: string, pct: number): string {
  return `color-mix(in srgb, var(${token}) ${pct}%, transparent)`;
}

/** The base circle's outer glow — the only thing that changes when resting. */
function baseGlow(state: HaloState): string {
  switch (state) {
    case "right":
      return `0 0 34px ${mix("--accent", 45)}`;
    case "wrong":
    case "wrong-flash":
      return `0 0 30px oklch(58% 0.22 25 / 45%)`;
    default:
      return `0 0 26px -8px ${mix("--accent", 55)}`;
  }
}


export interface DrillHaloProps {
  state: HaloState;
  /** `${asked}-${tries}` — re-mounts the halo on every card/attempt so animations replay. */
  cardKey: string;
  /** Seconds left on the countdown; only read while draining. */
  timerLeft: number;
  /** Length of the drain window in seconds — min(5, timerSec). */
  drainWindow: number;
  /** The character (jp2en) or the romaji prompt (en2jp). For a kanji-reading
   * card this is the WHOLE WORD (電話), so the reading is asked in context; see
   * `highlight`. */
  glyph: string;
  /** For a kanji-reading card: the ONE kanji whose reading is asked (話 in 電話).
   * Every occurrence of it is drawn at full brightness with a soft glow and the
   * rest of the word is dimmed, so the word gives context without the highlighted
   * glyph's reading ever being shown. Unset elsewhere — the glyph renders plain. */
  highlight?: string;
  /** Whether the prompt is Japanese. A Japanese prompt is a WORD with no spaces
   * to break at (はなす, 電話), so it renders on ONE line at the caller's
   * pre-fitted `fontSize` — never broken between characters. Only a latin cue,
   * which has spaces, takes the wrapping path. */
  jp?: boolean;
  /** The question's font, rolled once and kept in the runtime. */
  font: string;
  /** The size for the SINGLE-LINE glyph paths (a lone glyph, a Japanese word,
   * and the highlighted kanji-reading word), pre-fitted by the caller with
   * fitGlyphSize so a multi-character word already sits on one line. */
  fontSize: number;
  /** The BASE (unshrunk) size for a wrapping text prompt — GLYPH_PX for the
   * Japanese side, 0.6× for a latin cue. The prompt starts here and shrinks by
   * measurement to fit the ring on both axes (see useFitFontSize); a lone glyph
   * measures well within the box and stays at this size. Optional: a caller that
   * only shows a sentence frame (assembly) never reaches the wrapping path, and
   * omitting it falls back to `fontSize`. */
  maxFontSize?: number;
  /** Cross-fade the glyph in — true on a new card, false on a retry of the
   * same one, where re-fading the unchanged glyph would just be noise. */
  crossFade: boolean;
  /** A LISTENING card: the audio is the prompt, so the centre holds a speaker
   * the learner can press to replay rather than the glyph (which would be the
   * answer). `glyph` is ignored while this is set. */
  listen?: boolean;
  /** Replay the word. Called by the centre speaker on a listening card. */
  onListen?: () => void;
  /**
   * A grammar selection card: render a square sentence frame instead of the
   * circular halo glyph stage.
   */
  sentenceFrame?: string;
  /** Grammar frames are Japanese; sentence-building prompts are English. */
  sentenceFrameLang?: "ja" | "en";
  /** A smaller frame for short English sentence-building prompts. */
  compactSentenceFrame?: boolean;
  /** Optional pronunciation shown inside the halo beneath the main glyph. */
  reading?: ReactNode;
  /**
   * Optional context line shown inside the halo beneath the main glyph (or the
   * listening speaker) — a WORD card's other half of its reading-unit: the
   * definition under a reading card, the reading (or, for a homophone collision,
   * the written word) under a meaning card. The owner wants this INSIDE the box
   * rather than on a muted line below the instruction, so it renders here for the
   * lone-glyph AND the listening centre. Distinct from `reading` (pitch) so a
   * visual homophone meaning card can keep its pitch line untouched.
   */
  context?: ReactNode;
  /** Pause the outline animation while the settings drawer is open. */
  paused?: boolean;
}

export function DrillHalo({
  state,
  cardKey,
  timerLeft,
  drainWindow,
  glyph,
  highlight,
  jp = false,
  font,
  fontSize,
  maxFontSize,
  crossFade,
  listen = false,
  onListen,
  sentenceFrame,
  sentenceFrameLang = "ja",
  compactSentenceFrame = false,
  reading,
  context,
  paused = false,
}: DrillHaloProps) {
  const square = !!sentenceFrame;
  const feedback = feedbackSpec(state, cardKey, timerLeft, drainWindow);

  return (
    <div
      className="kq-halo relative grid place-items-center"
      style={{
        width: compactSentenceFrame ? "min(84vw, 360px)" : "min(92vw, 440px)",
        minHeight: compactSentenceFrame ? 132 : HALO_PX,
      }}
    >
      <style>{HALO_CSS}</style>
      <div
        className="kq-base absolute inset-0 rounded-2xl"
        style={{
          background: `radial-gradient(circle, ${mix("--accent", 9)}, transparent 68%)`,
          border: "1px solid var(--border)",
          boxShadow: baseGlow(state),
          transition: "box-shadow .3s",
        }}
      />
      {feedback ? (
        <svg
          key={feedback.key}
          className="kq-ring pointer-events-none absolute inset-0 overflow-visible"
          width="100%"
          height="100%"
          viewBox="0 0 440 176"
          preserveAspectRatio="none"
        >
          <path
            d={HALO_PATH}
            fill="none"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={PERIMETER}
            strokeDashoffset={feedback.strokeDashoffset}
            style={{
              stroke: feedback.color,
              // Append play-state inside the shorthand to avoid the shorthand/longhand React warning.
              animation: paused && feedback.animation !== "none"
                ? `${feedback.animation} paused`
                : feedback.animation,
              transition: "stroke 250ms ease-out",
            }}
          />
        </svg>
      ) : null}
      {square ? (
        <div
          className={`kq-glyph relative text-center ${
            compactSentenceFrame ? "px-4 py-4" : "px-5 py-6"
          }`}
          style={{ animation: crossFade ? "kq-glyph-in 260ms ease-out" : undefined }}
        >
          <p
            lang={sentenceFrameLang}
            className="whitespace-normal wrap-break-word text-[30px] leading-[1.35] text-text"
            style={{ fontFamily: sentenceFrameLang === "ja" ? font : undefined }}
          >
            {sentenceFrame}
          </p>
        </div>
      ) : listen ? (
        // The audio IS the question, so the centre is a speaker, not the glyph.
        // Pressing it replays the word; the crossFade keeps it arriving like the
        // glyph it stands in for. A `context` line (e.g. a reading card's
        // definition) sits beneath it, inside the box.
        <span
          className="kq-glyph relative flex flex-col items-center justify-center gap-1"
          style={{ animation: crossFade ? "kq-glyph-in 260ms ease-out" : undefined }}
        >
          <button
            type="button"
            onClick={onListen}
            aria-label="Play the word again"
            className="relative flex size-26 cursor-pointer items-center justify-center rounded-full text-text-muted transition-colors hover:text-text"
          >
            <SoundIcon className="size-12" />
          </button>
          {context ? (
            <span className="mt-2 px-4 text-center leading-snug whitespace-normal">
              {context}
            </span>
          ) : null}
        </span>
      ) : (
        <PromptGlyph
          glyph={glyph}
          highlight={highlight}
          jp={jp}
          font={font}
          fontSize={fontSize}
          maxFontSize={maxFontSize ?? fontSize}
          crossFade={crossFade}
          reading={reading}
          context={context}
        />
      )}
    </div>
  );
}

/**
 * The centre prompt for a non-listening, non-sentence card.
 *
 * Two shapes share this seat. A HIGHLIGHTED kanji-reading word (電話 with 話 lit)
 * stays a single pre-fitted line — the per-character colouring is the point and a
 * short word never needs to wrap. Everything else — a lone glyph, and a long
 * English cue like "say (humble) · more deferential" — WRAPS and shrink-to-fits
 * the ring's inner box on both axes: a single character measures well within the
 * box and stays big, a multi-word cue lands on two or three comfortable lines
 * fully inside the ring rather than one line that pokes out of it. A trailing
 * "· qualifier" is peeled onto a smaller, quieter sub-line (see splitQualifier).
 */
function PromptGlyph({
  glyph,
  highlight,
  jp,
  font,
  fontSize,
  maxFontSize,
  crossFade,
  reading,
  context,
}: {
  glyph: string;
  highlight?: string;
  jp?: boolean;
  font: string;
  fontSize: number;
  maxFontSize: number;
  crossFade: boolean;
  reading?: ReactNode;
  context?: ReactNode;
}) {
  const { main, sub } = splitQualifier(glyph);
  // Re-fit whenever the prompt text or its font changes — that is one per card.
  const [fitRef, fitSize] = useFitFontSize(maxFontSize, `${glyph} ${font}`);

  return (
    <span
      className="kq-glyph relative flex flex-col items-center justify-center gap-1"
      style={{ animation: crossFade ? "kq-glyph-in 260ms ease-out" : undefined }}
    >
      {jp || highlight ? (
        // A Japanese prompt is a word with no spaces to break at, so it stays on
        // ONE line at the caller's pre-fitted fontSize (fitGlyphSize already
        // shrank a multi-char word to fit the ring across) — never broken
        // between characters. The wrapping path below is only for a latin cue.
        <span
          // leading-[1.15] is the drill glyph's theme hook (see globals.css).
          // whitespace-nowrap so the word stays on ONE line — the caller has
          // already sized it (fitGlyphSize) to fit the hole across.
          className="block whitespace-nowrap leading-[1.15]"
          style={{ fontSize, fontFamily: font }}
        >
          {/* A highlighted reading word lights the asked kanji and dims the
              rest: context without a leak, since the highlighted glyph's reading
              is the answer and is never shown. A plain word (no highlight)
              renders whole, at full brightness. */}
          {highlight
            ? [...glyph].map((ch, i) =>
                ch === highlight ? (
                  <span
                    key={i}
                    style={{
                      color: "var(--text)",
                      textShadow: `0 0 18px ${mix("--accent", 55)}`,
                    }}
                  >
                    {ch}
                  </span>
                ) : (
                  <span
                    key={i}
                    style={{ color: "var(--text-muted)", opacity: 0.6 }}
                  >
                    {ch}
                  </span>
                ),
              )
            : glyph}
        </span>
      ) : (
        <div
          ref={fitRef}
          // Fixed width so the block WRAPS (and so a too-long token overflows
          // measurably); the layout effect shrinks fontSize until it also fits
          // FIT_H. wrap-break-word lets an over-long word break rather than
          // force the whole prompt microscopic.
          className="flex flex-col items-center justify-center text-center leading-[1.15] wrap-break-word"
          style={{
            width: FIT_W,
            maxWidth: FIT_W,
            fontSize: fitSize,
            fontFamily: font,
          }}
        >
          <span className="block">{main}</span>
          {sub ? (
            // The qualifier: smaller, muted, quiet — a disambiguator under the
            // question, not part of it.
            <span className="mt-1 text-[0.6em] leading-[1.2] text-text-muted">
              {sub}
            </span>
          ) : null}
        </div>
      )}
      {reading ? <span className="leading-none">{reading}</span> : null}
      {context ? (
        <span className="mt-2 px-4 text-center leading-snug whitespace-normal">
          {context}
        </span>
      ) : null}
    </span>
  );
}
