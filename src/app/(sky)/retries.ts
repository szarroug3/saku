// The retries setting, in the Sky's terms and the app's.
//
// How many more goes a card gets after a first wrong answer. The Sky shows it
// as a number on the quiz's own help bar, where you would reach for it. The
// app stored it as a mode plus a count until SAK-407, and this file was the
// translation; the config holds the number itself now, so what is left is a
// read and a write, kept as functions so Settings and Practice still reach
// the setting without importing the Quiz (SAK-366).

import type { QuizConfig } from "@/types";

/** The setting as the quiz shows it: 0 is none. */
export function retriesOf(cfg: QuizConfig): number {
  return cfg.retries;
}

export function retriesPatch(n: number): Partial<QuizConfig> {
  return { retries: n };
}
