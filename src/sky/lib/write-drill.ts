// The writing drill, as a model (#BuildHybridAI). The learner sees an English
// sentence and writes it in Japanese, in kana or kanji, in their own words.
// This file is everything about it that is not drawing and not the network:
// the run, the score, the exact-match shortcut, the grading prompt and how a
// grader's answer is read back. The screen is sky-write-drill.tsx, the route
// hands it the pool, and src/app/(sky)/hybrid-grader.ts asks the model.
//
// WHY THIS DRILL NEEDS A MODEL
// ============================
// Saku never marks a right answer wrong. A string compare can only keep that
// promise when a sentence has one right form, so the assembly drill keeps 605
// of the corpus's sentences, the ones whose word order is fixed, and drops the
// rest. A sentence you write yourself has many right forms: kana or kanji, a
// dropped subject, polite or plain, another word order. Only a grader that
// reads the meaning can tell them apart from a real mistake.
//
// WHAT THE GRADER SAYS
// ====================
// One of three verdicts, and a one-sentence note for the learner:
//
//   right  The meaning matches and it is natural Japanese. Kana for kanji,
//          another order, another natural word, or a dropped subject is right.
//   close  One small slip: a particle, a kana typo, one wrong conjugation. A
//          near miss gets another try, the same as the typed quiz (Sam,
//          2026-09-05), with the note as the hint.
//   wrong  The meaning is different, or the grammar breaks in more than one
//          place. The answer is shown.
//
// Nothing is saved. A run lives in the screen's state, like the readings
// drill, and is gone when the page is left.

import type { ExampleWord } from "./lesson";

/** The drill as Practice's Drills panel lists it. The name is the title the
 * drill's own page shows, so the two always match. */
export const WRITE_DRILL = {
  name: "Write it in Japanese",
  about: "Write an English sentence in Japanese, in your own words.",
  note: "Checked by AI on your device when it can be. Nothing is saved.",
} as const;

/** One sentence to write. */
export interface WriteItem {
  /** Tatoeba sentence id, for the attribution link. */
  id: number;
  /** The English the learner sees. A human translation. */
  en: string;
  /** One right answer, as Tatoeba has it. */
  jp: string;
  /** The grammar pattern the sentence uses, as the app writes it (〜てから). */
  pattern: string;
  /** What the pattern means, in English (after doing X). */
  gloss: string;
  /** The answer's words line: each content word with its furigana and the
   * meaning it has here, the same line a pattern page's sentence has. */
  words: ExampleWord[];
}

export type Verdict = "right" | "close" | "wrong";

/** Whether Gemini Nano can run in this browser, from Chrome's Prompt API.
 * "unsupported" is a browser with no Prompt API at all. */
export type DeviceModelState = "available" | "downloadable" | "downloading" | "unavailable" | "unsupported";

/** Where a verdict came from. `exact` was decided without a model. */
export type GradeSource = "exact" | "on_device" | "in_cloud";

/** A graded answer. */
export interface Graded {
  verdict: Verdict;
  /** One sentence for the learner. Empty on an exact match. */
  note: string;
  source: GradeSource;
  /** The device said close or wrong, and the cloud was asked to check. */
  checked?: boolean;
  /** The device said close or wrong and the cloud could not check it
   * (offline, or the cloud failed). The verdict is not shown: on test
   * answers Nano called 5 of 6 right answers "close", and its notes on them
   * were made up. The learner compares with the answer. */
  unsure?: boolean;
}

/** A device verdict the cloud could not check, made safe to show. */
export function unconfirmed(graded: Graded): Graded {
  return { verdict: graded.verdict, note: "", source: graded.source, unsure: true };
}

// ---------------------------------------------------------------- matching

/** Punctuation and spaces that never change what a sentence says. The long
 * vowel mark ー is a letter, not punctuation, and stays. */
const IGNORED = /[\s。、.,!?・…「」『』"'“”‘’~〜]/gu;

/** A sentence with its punctuation and spacing taken out, and full-width
 * letters and marks folded (NFKC turns ！ into ! before the strip). Katakana
 * stays as written: ア is not あ to a reader. */
export function normalize(s: string): string {
  return s.normalize("NFKC").replace(IGNORED, "");
}

/** Whether what was typed is the stored answer, give or take punctuation.
 * This is the only check that needs no model. */
export function exactMatch(item: WriteItem, given: string): boolean {
  const g = normalize(given);
  return g.length > 0 && g === normalize(item.jp);
}

// ------------------------------------------------------------------ prompt

/** The prompt both graders get, on the device and in the cloud. It carries
 * everything the grader needs: the English, one right answer, the pattern,
 * and what was typed. The rules are written to keep the never-mark-wrong
 * promise: another right answer is right. */
export function gradingPrompt(item: WriteItem, given: string): string {
  return [
    "You check a beginner's Japanese. Answer only with the JSON asked for.",
    "",
    `The learner was asked to write this English sentence in Japanese: "${item.en}"`,
    `One correct answer is: ${item.jp}`,
    `The sentence practices the pattern ${item.pattern}, which means "${item.gloss}".`,
    `The learner wrote: ${given.trim()}`,
    "",
    "How to judge it:",
    "- Hiragana or katakana in place of kanji is right, if the words are the same.",
    "- Another word order, a dropped subject, polite or plain style, or another natural word with the same meaning is right. Never call an answer wrong only because it is not the correct answer above.",
    "- The answer does not have to use the pattern, if it says the same thing naturally.",
    // without this line the cloud model told a learner to drop the を from
    // 何かをしてみましょう, which is fine Japanese (2026-11-14 test set)
    "- Adding a particle the correct answer leaves out, or leaving out one it has, is right when the sentence still sounds natural (何かをしてみましょう and 何かしてみましょう are both right). A particle that changes the meaning or sounds wrong is not.",
    "- \"close\" means one small slip: a wrong particle, one wrong or missing kana, or one word in the wrong form.",
    "- \"wrong\" means the meaning is different, or there is more than one mistake.",
    "",
    "Write the note to the learner in one short sentence of plain English.",
    "If it is right, say so briefly. If not, name the slip and what goes there instead.",
    // the model glossed the first word and skipped the rest ("を (marks the
    // object) instead of に after ギター"), so the line says every one
    // the example is about no real answer, so it can't be copied as a note
    "Every Japanese word or particle the note names gets its meaning in brackets right after it, each one, like: は (marks the topic) after 私 (わたし, I) and が (marks the subject) after 猫 (ねこ, cat).",
    // beginners may not know the kanji, so a word with kanji gets its kana too
    "If that word has kanji, put its reading in kana first inside the brackets, like 弾ける (ひける, be able to play).",
  ].join("\n");
}

/** The answer's shape, as JSON Schema. The device's model gets it as a
 * response constraint and the cloud model as a response schema. */
export const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["right", "close", "wrong"] },
    note: { type: "string" },
  },
  required: ["verdict", "note"],
} as const;

const VERDICTS: readonly Verdict[] = ["right", "close", "wrong"];

/** A grader's reply read back, or null when it is not one. A model that
 * wraps its JSON in a code fence or adds a line before it is still read. */
export function parseVerdict(text: string): { verdict: Verdict; note: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { verdict, note } = parsed as { verdict?: unknown; note?: unknown };
  if (typeof verdict !== "string" || !VERDICTS.includes(verdict as Verdict)) return null;
  return { verdict: verdict as Verdict, note: typeof note === "string" ? note.trim() : "" };
}

/** Whether the cloud should check what the device said. A device "right" is
 * taken as it is. A device "close" or "wrong" is checked by the larger model
 * first, because telling a learner a right answer is wrong is the one thing
 * this drill must not do.
 *
 * Measured on Gemini Nano in Chrome 157 (2026-11-14), 12 answers through
 * this prompt: it never called a mistake right, called all 3 wrong answers
 * wrong and all 3 one-slip answers close, but called 5 of 6 right answers
 * close (kana for kanji, a polite form, an added を, another word for "go
 * back"). Its right is safe to trust; its close and wrong are not. */
export function needsCloudCheck(graded: Graded): boolean {
  return graded.source === "on_device" && graded.verdict !== "right";
}

// ----------------------------------------------------------------- grading

/** One grader asked about one prompt: its verdict, or null when its reply
 * could not be read. A rejection is a grader that failed. */
export type AskGrader = (prompt: string) => Promise<Graded | null>;

export interface Graders {
  /** On the device when it can be, the cloud when not. */
  first: AskGrader;
  /** The cloud only, for the second look. */
  cloud: AskGrader;
  online: () => boolean;
  /** How long each grader gets, in ms. */
  firstMs?: number;
  cloudMs?: number;
  /** Where a failed or slow grader is reported. */
  warn?: (message: string, error: unknown) => void;
}

/** How long each grader gets before the next step runs. Nano answered
 * in 3 to 7.5 s on test answers, but its first session after Chrome starts
 * can take far longer; the cloud answers in about 1 s. Without a limit a
 * stuck session left the screen on "Checking…" for good (2026-11-14). */
const GRADER_MS = 15_000;

/** The promise, or a rejection once `ms` have passed. */
function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms / 1000} s`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Grades an answer, step by step:
 *
 *   1. The stored answer, give or take punctuation: right, no grader asked.
 *   2. The first grader (Nano on the device, or the cloud where there's no
 *      Nano). A "right" stands.
 *   3. A device "close" or "wrong", or no verdict at all, goes to the cloud
 *      when online (`needsCloudCheck` says why).
 *   4. With no cloud verdict, a device verdict is shown as `unconfirmed`.
 *   5. With nothing at all, it throws, and the screen says nothing could
 *      check the answer.
 *
 * A grader that fails or runs out of time counts as no verdict, and is
 * reported so it can be told apart from a wrong answer. */
export async function gradeWith(item: WriteItem, given: string, graders: Graders): Promise<Graded> {
  if (exactMatch(item, given)) return { verdict: "right", note: "", source: "exact" };
  const { first, cloud, online, firstMs = GRADER_MS, cloudMs = GRADER_MS, warn = console.warn } = graders;
  const prompt = gradingPrompt(item, given);
  const none = (what: string) => (error: unknown): null => {
    warn(`Writing drill: ${what} gave no verdict.`, error);
    return null;
  };
  const one = await within(first(prompt), firstMs, "the first grader").catch(none("the first grader"));
  if (one && !needsCloudCheck(one)) return one;
  if (online()) {
    const two = await within(cloud(prompt), cloudMs, "the cloud grader").catch(none("the cloud grader"));
    if (two) return { ...two, checked: one !== null };
  }
  if (one) return unconfirmed(one);
  throw new Error("No grader answered");
}

// --------------------------------------------------------------------- run

export interface WriteScore {
  /** Sentences answered (right, or given up on). */
  answered: number;
  /** Right on the first try. */
  firstTry: number;
  /** Right, on any try. */
  right: number;
}

export interface WriteRun {
  /** Index into the pool of the sentence on screen. */
  at: number;
  /** Tries on the sentence on screen. */
  tries: number;
  /** The last grade for the sentence on screen. */
  last?: Graded;
  /** The answer is shown: right, wrong, or given up. */
  done: boolean;
  score: WriteScore;
  ended: boolean;
}

export function startRun(): WriteRun {
  return { at: 0, tries: 0, done: false, score: { answered: 0, firstTry: 0, right: 0 }, ended: false };
}

/** A grade for the sentence on screen. A near miss leaves it open for another
 * try; right or wrong closes it and counts it. */
export function recordGrade(run: WriteRun, graded: Graded): WriteRun {
  if (run.done || run.ended) return run;
  const tries = run.tries + 1;
  // an unchecked device verdict closes the sentence with the answer shown,
  // counted as answered and not right, like Show the answer
  if (graded.unsure) return { ...run, tries, last: graded, done: true, score: { ...run.score, answered: run.score.answered + 1 } };
  if (graded.verdict === "close") return { ...run, tries, last: graded };
  const right = graded.verdict === "right";
  return {
    ...run,
    tries,
    last: graded,
    done: true,
    score: {
      answered: run.score.answered + 1,
      firstTry: run.score.firstTry + (right && tries === 1 ? 1 : 0),
      right: run.score.right + (right ? 1 : 0),
    },
  };
}

/** The learner asks to see the answer: it counts as answered, not right. */
export function giveUp(run: WriteRun): WriteRun {
  if (run.done || run.ended) return run;
  return { ...run, done: true, score: { ...run.score, answered: run.score.answered + 1 } };
}

/** The next sentence, or the end of the run when the pool is used up. */
export function nextItem(run: WriteRun, pool: readonly WriteItem[]): WriteRun {
  const at = run.at + 1;
  if (at >= pool.length) return { ...run, ended: true };
  return { ...run, at, tries: 0, last: undefined, done: false };
}

export function endRun(run: WriteRun): WriteRun {
  return { ...run, ended: true };
}
