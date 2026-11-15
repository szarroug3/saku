// The mix-up coach's models (#BuildHybridAI). Browser only.
//
// `explainWith` in src/sky/lib/mixup-coach.ts asks them in order and checks
// that each answer stands on the facts it was given. This file hands it the
// two models for an explanation, from firebase-ai.ts, and puts the server's
// fact-gathering in front.

import { COACH_SCHEMA, explainWith, type CoachAnswer } from "@/sky/lib/mixup-coach";

import { mixupCoachRequest } from "./actions";
import { aiConfigured, askModel, modelPair, online } from "./firebase-ai";

/** How two entries differ, from Gemini: Nano on the device when it can, the
 * cloud when not, or when Nano's answer reached past the facts. Null when
 * nothing usable came back, or the site has no Firebase set up. */
export async function explainMixup(asked: string, other: string): Promise<CoachAnswer | null> {
  if (!aiConfigured()) return null;
  const req = await mixupCoachRequest(asked, other);
  if (!req) return null;
  return explainWith(req, {
    first: async (prompt) => askModel((await modelPair(COACH_SCHEMA)).hybrid, prompt),
    cloud: async (prompt) => askModel((await modelPair(COACH_SCHEMA)).cloud, prompt),
    online,
  });
}

/** Whether the coach can be offered at all on this site. */
export const coachConfigured = aiConfigured;
