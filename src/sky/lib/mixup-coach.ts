// The mix-up coach, as a model (#BuildHybridAI). When a learner mixes up two
// things (シ and ツ, 待 and 持), Gemini says how to tell them apart, in a few
// sentences, from Saku's own facts about the two and nothing else.
//
// This file is everything about it that is not drawing and not the network:
// what the model is told, the shape it answers in, the check that what it
// said stands on the facts it was given, and the order the graders are
// asked in. The facts are gathered on the server (src/app/(sky)/mixup-facts.ts),
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
// not means the model reached past what it was told, and the answer is
// thrown out. A device answer that fails goes to the cloud; a cloud answer
// that fails is not shown. English can't be checked this way, which is why
// the prompt says to use only the facts.

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
   * one. The coach builds on it rather than replacing it. */
  tip?: string;
}

export interface CoachAnswer {
  /** A few sentences of plain English on how to tell the two apart. */
  text: string;
  source: "on_device" | "in_cloud";
  /** The first model answered, but with something the facts don't hold, so
   * the cloud was asked instead. */
  replaced?: boolean;
}

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
    // it glossed 休 three times in one answer before this said "once"
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
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { explanation?: unknown };
    const out = typeof parsed.explanation === "string" ? parsed.explanation.trim() : "";
    return out || null;
  } catch {
    return null;
  }
}

/** Kana and kanji, the characters a made-up reading or component is written
 * in. The long vowel mark and the iteration mark count too. */
const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々]/gu;

/** Two or more kana in a row: a reading or a word, which must be in the
 * facts as written, not just letter by letter. */
const KANA_RUN = /[\p{Script=Hiragana}\p{Script=Katakana}ー]{2,}/gu;

/** What in `text` the facts the model was given don't hold: a Japanese
 * character that appears nowhere in them, or a run of kana that isn't
 * written there (ひか for 日, whose facts have ひ and か but never ひか).
 * Empty means the answer stands on the facts. Kanji are checked one at a
 * time, so 待つ passes on 待 and つ; English can't be checked at all. */
export function ungrounded(text: string, req: CoachRequest): string[] {
  // the facts, not the whole prompt: the prompt's own instructions must not
  // count as something the model was told about these two
  const facts = [req.asked, req.other].flatMap((s) => [s.glyph, ...s.facts]).concat(req.tip ?? []).join("\n");
  const given = new Set(facts.match(JAPANESE) ?? []);
  const chars = [...new Set(text.match(JAPANESE) ?? [])].filter((c) => !given.has(c));
  const runs = [...new Set(text.match(KANA_RUN) ?? [])].filter((r) => !facts.includes(r) && [...r].every((c) => given.has(c)));
  return [...chars, ...runs];
}

// ------------------------------------------------------------------ asking

/** One model asked about one prompt: its reply text, and where it ran. */
export type AskCoach = (prompt: string) => Promise<{ text: string; source: "on_device" | "in_cloud" } | null>;

export interface Coaches {
  /** On the device when it can be, the cloud when not. */
  first: AskCoach;
  /** The cloud only, for when the first answer can't be used. */
  cloud: AskCoach;
  online: () => boolean;
  /** How long each gets, in ms. */
  firstMs?: number;
  cloudMs?: number;
  /** Where a failed, slow or made-up answer is reported. */
  warn?: (message: string, detail: unknown) => void;
}

/** Nano took 3 to 7.5 s on the writing drill's prompts and can take longer
 * the first time after Chrome starts; the cloud takes about a second. */
export const COACH_MS = 20_000;

function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms / 1000} s`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Asks for an explanation: the first model, then the cloud when the first
 * failed, ran out of time, or said something the facts don't hold. Null
 * when nothing usable came back; the screen then says it couldn't explain. */
export async function explainWith(req: CoachRequest, coaches: Coaches): Promise<CoachAnswer | null> {
  const { first, cloud, online, firstMs = COACH_MS, cloudMs = COACH_MS, warn = console.warn } = coaches;
  const prompt = coachPrompt(req);
  let madeUp = false;
  const usable = async (ask: AskCoach, ms: number, what: string): Promise<CoachAnswer | null> => {
    try {
      const reply = await within(ask(prompt), ms, what);
      const text = reply && parseCoach(reply.text);
      if (!reply || !text) return null;
      const off = ungrounded(text, req);
      if (off.length) {
        // only Nano's answer is "replaced"; with no Nano the first answer
        // was the cloud's own
        if (reply.source === "on_device") madeUp = true;
        warn(`Mix-up coach: ${what} used Japanese the facts don't have.`, { off, text });
        return null;
      }
      return { text, source: reply.source };
    } catch (error) {
      warn(`Mix-up coach: ${what} gave no answer.`, error);
      return null;
    }
  };
  const one = await usable(first, firstMs, "the first model");
  // a cloud answer from the first model is as good as the cloud gets
  if (one) return one;
  if (!online()) return null;
  const two = await usable(cloud, cloudMs, "the cloud model");
  return two && (madeUp ? { ...two, replaced: true } : two);
}
