// Types shared between the session provider (a client module) and the pure
// session model (src/lib/session.ts).
//
// Split out of quiz-session.tsx for one reason: session.ts is pure and has no
// business importing a "use client" module. A type-only import would erase at
// build time and technically work, but it would leave a real import cycle in
// the source (provider → model → provider) for a reader to trip over. One
// small module with no runtime is cheaper than that cycle.

import type { QuizConfig } from "@/types";

/** The Home-builder settings frozen at Start — see quiz-session.tsx. */
export type QuizSnapshot = Pick<
  QuizConfig,
  "mode" | "dirs" | "styleJp2en" | "styleEn2jp" | "length" | "limType" | "limCount"
>;
