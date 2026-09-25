// The lesson meter: one bar that fills by how much tonight's picks ask, with
// no numbers on it (SAK-477, which replaced SAK-304's one segment per piece).
//
// The fill is one gradient laid over the whole track, from the green of a
// Solid standing through the accent to coral, and only the filled part of
// it shows. So a light lesson shows the green end, and a full one shows the
// whole run up to coral. Past the cap the whole bar is coral. Going over is
// allowed and warned, never blocked.

import { lessonSize } from "@/sky/lib/weight";

interface LessonMeterProps {
  /** The cart's weight (src/sky/lib/cart.ts). */
  weight: number;
  /** A comfortable lesson, in weight. */
  cap: number;
  className?: string;
}

const GRADIENT = "linear-gradient(to right, var(--sky-solid), var(--sky-accent), var(--sky-coral))";

export function LessonMeter({ weight, cap, className = "" }: LessonMeterProps) {
  const over = weight > cap;
  const share = cap > 0 ? Math.min(Math.max(weight, 0) / cap, 1) : 0;
  // the gradient is sized to the whole track, so the fill shows only its
  // own stretch of it
  const fill = over
    ? { background: "var(--sky-coral)" }
    : share > 0
      ? { backgroundImage: GRADIENT, backgroundSize: `${100 / share}% 100%`, backgroundRepeat: "no-repeat" }
      : {};
  return (
    <div role="img" aria-label={lessonSize(weight, cap)} className={`h-2 w-full overflow-hidden rounded-full bg-sky-card-strong ${className}`}>
      <div data-lesson-fill className="h-full rounded-full" style={{ width: `${share * 100}%`, ...fill }} />
    </div>
  );
}
