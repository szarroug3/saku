// The writing drill's grader (#BuildHybridAI). Browser only.
//
// The steps (exact match, Nano on the device, the cloud's second look, the
// offline path) and their time limits are `gradeWith` in
// src/sky/lib/write-drill.ts, with tests. This file only hands it the two
// models for a verdict, from firebase-ai.ts.

import type { Graded, WriteItem } from "@/sky/lib/write-drill";
import { gradeWith, parseVerdict, VERDICT_SCHEMA } from "@/sky/lib/write-drill";

import { askModel, modelPair, online, type ModelPair } from "./firebase-ai";

export { aiConfigured as graderConfigured, deviceModelState, prepareDeviceModel } from "./firebase-ai";

/** One model's verdict on one answer. */
async function ask(which: keyof ModelPair, prompt: string): Promise<Graded | null> {
  const reply = await askModel((await modelPair(VERDICT_SCHEMA))[which], prompt);
  const parsed = parseVerdict(reply.text);
  return parsed && { ...parsed, source: reply.source };
}

/** Grades what the learner wrote, through `gradeWith`. Throws only when no
 * grader could answer (no connection and no on-device model, or Firebase is
 * not set up). The models load on the first answer that is not an exact
 * match. */
export function gradeAnswer(item: WriteItem, given: string): Promise<Graded> {
  return gradeWith(item, given, {
    first: (prompt) => ask("hybrid", prompt),
    cloud: (prompt) => ask("cloud", prompt),
    online,
  });
}
