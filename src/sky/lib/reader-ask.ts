// Translate, in the reader (#BuildHybridAI): a stretch of the text the
// learner selected, put into natural English with the text around it for
// context. Gemini Nano first, the cloud when Nano fails or writes Japanese
// that isn't in the passage, through `askInOrder` (ai-ask.ts).
//
// Asking about a selection is a question about a page (page-ask.ts) whose
// page is the passage.

import { askInOrder, charsOutside, jsonField, type Answer, type Models } from "@/sky/lib/ai-ask";

export interface TranslateRequest {
  /** The text the learner selected. */
  selected: string;
  /** The text around it (`passageAround`), so a pronoun or a dropped
   * subject reads right. */
  passage: string;
}

/** The longest selection the reader translates. */
export const SELECTION_MAX = 400;

export function translatePrompt(r: TranslateRequest): string {
  return [
    "You translate Japanese for a beginner who is reading it. Answer only with the JSON asked for.",
    "",
    "THE TEXT AROUND IT",
    r.passage,
    "",
    "TRANSLATE THIS PART",
    r.selected,
    "",
    "- Put only the part to translate into natural English, read in light of the text around it.",
    "- When the part is one word, give its meaning here in a few words.",
    "- Write no Japanese.",
  ].join("\n");
}

export const TRANSLATE_SCHEMA = {
  type: "object",
  properties: { translation: { type: "string" } },
  required: ["translation"],
} as const;

export const parseTranslation = (reply: string) => jsonField(reply, "translation");

/** Translates the selection. Null when nothing usable came back. */
export function translateWith(r: TranslateRequest, models: Models): Promise<Answer | null> {
  const selected = r.selected.trim().slice(0, SELECTION_MAX);
  if (!selected) return Promise.resolve(null);
  const req = { ...r, selected };
  return askInOrder({
    prompt: translatePrompt(req),
    parse: parseTranslation,
    // a translation has no Japanese of its own to add
    check: (text) => charsOutside(text, `${req.selected}\n${req.passage}`),
    label: "Reader translation",
  }, models);
}
