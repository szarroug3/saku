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
const HOLE_PX = 84;
export const GLYPH_PX = 78;

const RING_MASK = `radial-gradient(circle, transparent ${HOLE_PX}px, #000 ${HOLE_PX + 1}px)`;

const HALO_CSS = `
@property --kq-sweep {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}
@keyframes kq-drain { from { --kq-sweep: 100%; } to { --kq-sweep: 0%; } }
@keyframes kq-fill  { from { --kq-sweep: 0%; }   to { --kq-sweep: 100%; } }
@keyframes kq-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@keyframes kq-flash { 0% { opacity: 1; } 55% { opacity: 0.25; } 100% { opacity: 0; } }
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

function mix(token: string, pct: number): string {
  return `color-mix(in srgb, var(${token}) ${pct}%, transparent)`;
}

/** The base circle's outer glow — the only thing that changes when resting. */
function baseGlow(state: HaloState): string {
  switch (state) {
    case "draining":
      return `0 0 26px ${mix("--warning", 30)}`;
    case "right":
      return `0 0 34px ${mix("--accent", 45)}`;
    case "wrong":
    case "wrong-flash":
      return `0 0 30px ${mix("--danger", 38)}`;
    default:
      return `0 0 26px -8px ${mix("--accent", 55)}`;
  }
}

interface RingSpec {
  key: string;
  color: string;
  sweep: string;
  animation: string;
}

/** The masked conic arc for a non-resting state, or null while resting. */
function ringSpec(
  state: HaloState,
  cardKey: string,
  timerLeft: number,
  drainWindow: number,
): RingSpec | null {
  switch (state) {
    case "draining": {
      const left = Math.max(0, Math.min(drainWindow, timerLeft));
      return {
        // Re-mounts each tick; the negative delay skips to where the last
        // one left off, so the sweep is continuous across restarts.
        key: `drain-${cardKey}-${left}`,
        color: "var(--warning)",
        sweep: `${(100 * left) / drainWindow}%`,
        animation: `kq-drain ${drainWindow}s linear ${left - drainWindow}s forwards`,
      };
    }
    case "right":
      return {
        key: `right-${cardKey}`,
        color: "var(--accent)",
        sweep: "100%",
        animation: "kq-fill 340ms ease-out forwards",
      };
    case "wrong":
      return {
        key: `wrong-${cardKey}`,
        color: "var(--danger)",
        sweep: "100%",
        animation: "kq-pulse 460ms ease-in-out 2",
      };
    case "wrong-flash":
      return {
        key: `flash-${cardKey}`,
        color: "var(--danger)",
        sweep: "100%",
        animation: "kq-flash 720ms ease-out forwards",
      };
    default:
      return null;
  }
}

export interface DrillHaloProps {
  state: HaloState;
  /** `${asked}-${tries}` — the parent keys the halo by this, so entry
   * animations (and the shake) replay on every new card and every attempt. */
  cardKey: string;
  /** Seconds left on the countdown; only read while draining. */
  timerLeft: number;
  /** Length of the drain window in seconds — min(5, timerSec). */
  drainWindow: number;
  /** The character (jp2en) or the romaji prompt (en2jp). */
  glyph: string;
  /** The question's font, rolled once and kept in the runtime. */
  font: string;
  fontSize: number;
  /** Cross-fade the glyph in — true on a new card, false on a retry of the
   * same one, where re-fading the unchanged glyph would just be noise. */
  crossFade: boolean;
}

export function DrillHalo({
  state,
  cardKey,
  timerLeft,
  drainWindow,
  glyph,
  font,
  fontSize,
  crossFade,
}: DrillHaloProps) {
  const ring = ringSpec(state, cardKey, timerLeft, drainWindow);
  const wrong = state === "wrong" || state === "wrong-flash";

  return (
    <div
      // The shake replays because the parent re-mounts this component on
      // every attempt — the same trick the grid screen's cards use.
      className={`kq-halo relative grid place-items-center ${wrong ? "animate-gshake" : ""}`}
      style={{ width: HALO_PX, height: HALO_PX }}
    >
      <style>{HALO_CSS}</style>
      <div
        className="kq-base absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${mix("--accent", 9)}, transparent 68%)`,
          border: "1px solid var(--border)",
          boxShadow: baseGlow(state),
          transition: "box-shadow .3s",
        }}
      />
      {ring ? (
        <div
          key={ring.key}
          className="kq-ring absolute inset-0 rounded-full"
          style={{
            // The untravelled part of the band is the hairline track, so the
            // arc always reads against something.
            background: `conic-gradient(${ring.color} var(--kq-sweep), var(--border) 0)`,
            maskImage: RING_MASK,
            WebkitMaskImage: RING_MASK,
            animation: ring.animation,
            // Also the reduced-motion (and no-@property) resting value.
            ["--kq-sweep" as string]: ring.sweep,
          }}
        />
      ) : null}
      <span
        // leading-[1.15] is the drill glyph's theme hook (see globals.css).
        // whitespace-nowrap so a multi-char word stays on ONE line — the parent
        // has already sized the glyph (see fitGlyphSize) to fit the hole across.
        className="kq-glyph relative block whitespace-nowrap leading-[1.15]"
        style={{
          fontSize,
          fontFamily: font,
          animation: crossFade ? "kq-glyph-in 260ms ease-out" : undefined,
        }}
      >
        {glyph}
      </span>
    </div>
  );
}
