// The mix-up coach, as a model (#BuildHybridAI). When a learner mixes up two
// things (シ and ツ, 待 and 持), Gemini says how to tell them apart, in a few
// sentences, from Saku's own facts about the two and nothing else.
//
// This file is everything about it that is not drawing and not the network:
// what the model is told, the shape it answers in, the check that what it
// said uses only the facts it was given. The order the models are asked in
// is src/sky/lib/ai-ask.ts, shared with the page questions. The facts are gathered on the server (src/app/(sky)/mixup-facts.ts),
// the model is asked in the browser (src/app/(sky)/mixup-coach-client.ts),
// and the screens get a function that does both.
//
// WHY A CHECK, AND WHICH ONE
// ==========================
// Gemini Nano made things up when it graded the writing drill: a note read
// 食べる as "たんべい". An explanation that invents a reading or a component
// teaches the mistake it was meant to fix. Most of what can be invented here
// is Japanese (a reading, a component, a word), and every piece of Japanese
// the model was given is in the facts. So the check is: every Japanese
// character in the answer must appear somewhere in the facts. One that does
// not means the model used something it wasn't given, and the answer is
// thrown out. A device answer that fails goes to the cloud; a cloud answer
// that fails is not shown. English can't be checked this way, which is why
// the prompt says to use only the facts.

import { askInOrder, charsOutside, jsonField, type Answer, type AskModel, type Models } from "@/sky/lib/ai-ask";

/** One of the two things mixed up, as the coach is told about it. */
export interface CoachSide {
  /** What it looks like: シ, 待, 先生. */
  glyph: string;
  /** "katakana", "kanji", "word"... in plain English. */
  kind: string;
  /** Facts about it, one plain line each: "read: shi", "means: wait",
   * "made of: 彳 and 寺". Saku's own data, nothing else. */
  facts: string[];
}

export interface CoachRequest {
  /** The one the card asked about, or the pair's first side on the home
   * panel. */
  asked: CoachSide;
  /** The one it was mixed up with. */
  other: CoachSide;
  /** A tip Saku already has for this pair (the radical tips), when there is
   * one. The coach adds to it. */
  tip?: string;
}

/** A few sentences of plain English on how to tell the two apart, and where
 * they were worked out. */
export type CoachAnswer = Answer;

/** The prompt both models get. */
export function coachPrompt(req: CoachRequest): string {
  const side = (s: CoachSide) => [`${s.glyph} (${s.kind})`, ...s.facts.map((f) => `- ${f}`)].join("\n");
  return [
    "You help a beginner learning Japanese tell apart two things they keep mixing up. Answer only with the JSON asked for.",
    "",
    side(req.asked),
    "",
    side(req.other),
    ...(req.tip ? ["", `How the app tells this pair apart: ${req.tip}`] : []),
    "",
    "Write two or three short sentences of plain English that tell the learner how to tell them apart and remember which is which.",
    "- Use only the facts above. Don't add readings, meanings, components or words that are not listed.",
    // without this the model told 人 from 入 by which "leg" leans, which no
    // fact says (2026-11-14 test pairs)
    "- Only describe strokes or the parts of a shape when a fact or the tip above describes them.",
    "- Point at the difference that matters most first: the shape, the sound or the meaning.",
    "- If a story or picture is listed for either one, use it.",
    // "once": without it the model glossed 休 three times in one answer
    "- Write any Japanese exactly as it appears above. Put its meaning in brackets after it once, the first time, and write it bare after that.",
    "- No dashes, no lists, no headings. Talk to the learner as \"you\".",
  ].join("\n");
}

/** The answer's shape, as JSON Schema: a response constraint on the device,
 * a response schema in the cloud. */
export const COACH_SCHEMA = {
  type: "object",
  properties: { explanation: { type: "string" } },
  required: ["explanation"],
} as const;

/** A model's reply read back: the explanation, or null when there is none. */
export function parseCoach(text: string): string | null {
  return jsonField(text, "explanation");
}

/** Two or more kana in a row: a reading or a word, which must be in the
 * facts as written, not just letter by letter. */
const KANA_RUN = /[\p{Script=Hiragana}\p{Script=Katakana}ー]{2,}/gu;

/** What in `text` the facts the model was given don't hold: a Japanese
 * character that appears nowhere in them, or a run of kana that isn't
 * written there (ひか for 日, whose facts have ひ and か but never ひか).
 * Empty means the answer uses only the facts. Kanji are checked one at a
 * time, so 待つ passes on 待 and つ; English can't be checked at all. */
export function ungrounded(text: string, req: CoachRequest): string[] {
  // the facts, not the whole prompt: the prompt's own instructions must not
  // count as something the model was told about these two
  const facts = [req.asked, req.other].flatMap((s) => [s.glyph, ...s.facts]).concat(req.tip ?? []).join("\n");
  const chars = charsOutside(text, facts);
  const runs = [...new Set(text.match(KANA_RUN) ?? [])].filter((r) => !facts.includes(r) && [...r].every((c) => !chars.includes(c)));
  return [...chars, ...runs];
}

// ------------------------------------------------------------------ asking

/** One model asked about one prompt. */
export type AskCoach = AskModel;
export type Coaches = Models;

/** Asks for an explanation: the first model, then the cloud when the first
 * failed, ran out of time, or said something the facts don't hold. Null
 * when nothing usable came back; the screen then says it couldn't explain. */
export function explainWith(req: CoachRequest, coaches: Coaches): Promise<CoachAnswer | null> {
  return askInOrder({ prompt: coachPrompt(req), parse: parseCoach, check: (text) => ungrounded(text, req), label: "Mix-up coach" }, coaches);
}
