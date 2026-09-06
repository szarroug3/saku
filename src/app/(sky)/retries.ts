// The retries setting, in the Sky's terms and the app's.
//
// How many more goes a card gets after a first wrong answer. The Sky shows
// it as a number on the quiz's own help bar, where you would reach for it;
// the app stores it as a mode and a count. This is the whole of the
// translation, in its own file so Settings and Practice can read it
// without importing the Quiz (SAK-366).

import type { QuizConfig } from "@/types";

/** The setting as the quiz shows it: 0 is none. */
export function retriesOf(cfg: QuizConfig): number {
  return cfg.retries === "none" ? 0 : cfg.retries === "unl" ? 9 : cfg.retryN;
}

export function retriesPatch(n: number): Partial<QuizConfig> {
  return n === 0 ? { retries: "none" } : { retries: "lim", retryN: n };
}
