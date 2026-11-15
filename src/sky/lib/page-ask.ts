// Questions about a page (#BuildHybridAI). A learner who doesn't follow
// something on a card asks about it in their own words, and Gemini answers
// from the card and from what the learner has already learned, and nothing
// past that.
//
// This file is the model: the card as plain text, what the model is told,
// the shape it answers in and the check on the answer. The learned list is
// read on the server (`pageAskLearned` in src/app/(sky)/actions.ts), the
// models are asked in the browser (src/app/(sky)/page-ask-client.ts), and the
// card gets a function that does both.
//
// WHAT "ONLY WHAT THEY'VE LEARNED" MEANS
// =====================================
// The prompt lists the learner's kana, kanji, words and grammar, and says to
// write no Japanese past those and the card. The check holds the answer to
// it: every Japanese character in the answer must be on the card, in the
// question, or in something the learner has met, and a word of two or more
// kanji must be written in one of those as it is. A kanji they haven't
// learned, katakana before they've started it, or a word made of kanji they
// know but haven't met as a word, fails the check. A device
// answer that fails goes to the cloud; a cloud answer that fails isn't shown.
// English can't be checked this way, which is why the prompt also says to
// leave out what the course hasn't reached.

import { askInOrder, charsOutside, jsonField, type Answer, type Models } from "@/sky/lib/ai-ask";
import type { LessonTeach, SoundLine, TeachPage, TeachParagraph, TeachTable } from "@/sky/lib/lesson";
import type { SkyItem } from "@/sky/lib/types";

/** What the learner has met: answered, said they know, or opened in a
 * lesson. A kanji comes with the readings they have met it in, "人 (じん,
 * ひと)", and each word and grammar line is the thing and its meaning:
 * "食べる (たべる): to eat". */
export interface Learned {
  kana: string;
  kanji: readonly string[];
  words: readonly string[];
  grammar: readonly string[];
}

export interface PageQuestion {
  /** The card as the learner sees it, in plain text (`cardText`). */
  page: string;
  question: string;
  learned: Learned;
}

export type PageAnswer = Answer;

/** The longest question the box takes. */
export const QUESTION_MAX = 300;

/** How much of a card goes in the prompt. Nano's window is small, and the
 * start of a card (the name, the meaning, the page's lead) is what it is
 * about. */
const PAGE_MAX = 4000;

/** How many of the learner's kanji, words and patterns are listed. The newest come
 * first; the check still counts all of them. */
const WORDS_LISTED = 150;
const KANJI_LISTED = 200;
const GRAMMAR_LISTED = 80;

const plain = (line: SoundLine | string) => (typeof line === "string" ? line : line.map((s) => s.text).join("")).trim();

function paragraphText(p: TeachParagraph): string[] {
  return [
    p.heading ?? "",
    p.lead ?? "",
    p.runs ? plain(p.runs) : p.text,
    ...(p.examples ?? []).map((ex) => `${plain(ex.jp)} (${ex.en})${ex.words?.length ? ` words: ${ex.words.map((w) => `${plain(w.word)} ${w.meaning}`).join(", ")}` : ""}`),
  ].filter(Boolean);
}

function tableText(t: TeachTable): string[] {
  return [
    t.title ?? "",
    t.instruction ? plain(t.instruction) : "",
    t.heads.join(" | "),
    ...t.rows.map((row) => row.map(plain).join(" | ")),
  ].filter(Boolean);
}

/** One page of a card, in plain text. */
function pageText(p: TeachPage): string[] {
  return [
    p.eyebrow ?? "",
    p.title,
    p.lead ?? "",
    p.hook ?? "",
    ...p.paragraphs.flatMap(paragraphText),
    p.formula ? [p.formula.base, p.formula.trim ? `minus ${p.formula.trim}` : "", p.formula.add ? `plus ${p.formula.add}` : ""].filter(Boolean).join(" ") : "",
    ...(p.tables ?? []).flatMap(tableText),
    ...(p.after ?? []).flatMap(paragraphText),
    ...(p.examples ?? []).map((ex) => {
      const jp = ex.japanese.map((r) => r.text).join("");
      const en = ex.natural.map((r) => r.text).join("");
      const words = ex.words?.length ? ` words: ${ex.words.map((w) => `${plain(w.word)} ${w.meaning}`).join(", ")}` : "";
      return `${jp} (${en})${words}`;
    }),
  ].filter(Boolean);
}

/** The card as the learner sees it, in plain text: the thing, its meaning and
 * reading, the notes and story, and the page that is open. */
export function cardText(item: SkyItem, teach: LessonTeach | undefined, page?: TeachPage): string {
  const t = teach ?? {};
  const lines = [
    `${item.glyph}: ${(t.meanings?.length ? t.meanings : [item.english]).join(", ")}`,
    // a pattern's "reading" is its own spelling
    (t.reading ?? item.reading) && (t.reading ?? item.reading) !== item.glyph ? `reading: ${t.reading ?? item.reading}` : "",
    t.wordKind ? `kind of word: ${t.wordKind.label}` : "",
    ...(t.notes ?? []).map(plain),
    t.story ? plain(t.story) : "",
    t.hook ? plain(t.hook) : "",
    t.headsUp ? [t.headsUp.summary, ...t.headsUp.rules.map((r) => `${r.when}: ${r.sounds} (${r.example})`)].join("\n") : "",
    t.exampleWord ? `heard in ${t.exampleWord.word} (${t.exampleWord.reading}, ${t.exampleWord.gloss})` : "",
    t.etymology ? plain(t.etymology) : "",
    t.parts?.length ? `made of: ${t.parts.map((p) => `${p.glyph} (${p.sense})`).join(", ")}` : "",
    t.writtenWith?.length ? `written with: ${t.writtenWith.map((w) => `${w.kanji} read ${w.reading}`).join(", ")}` : "",
    t.readings?.length ? `readings: ${t.readings.map((r) => `${r.reading}${r.words.length ? ` (as in ${r.words.slice(0, 2).map((w) => w.word).join(", ")})` : ""}`).join("; ")}` : "",
    t.example ? `example: ${t.example.jp} (${t.example.en})` : "",
    ...(t.forms ?? []).map((f) => `${f.role}: ${f.word}${f.reading ? ` (${f.reading})` : ""}${f.note ? `, ${f.note}` : ""}`),
    ...(page ? pageText(page) : []),
  ].filter(Boolean);
  const text = lines.join("\n");
  return text.length > PAGE_MAX ? text.slice(0, PAGE_MAX) : text;
}

/** The prompt both models get. */
export function pageAskPrompt(q: PageQuestion): string {
  const list = (items: readonly string[], max: number) => (items.length ? items.slice(0, max).join("; ") : "nothing yet");
  return [
    "You answer a beginner's question about one card of a Japanese course. Answer only with the JSON asked for.",
    "",
    "THE CARD",
    q.page,
    "",
    "WHAT THE LEARNER HAS LEARNED SO FAR",
    `kana: ${q.learned.kana || "none yet"}`,
    `kanji, with the readings they know: ${list(q.learned.kanji, KANJI_LISTED)}`,
    `words: ${list(q.learned.words, WORDS_LISTED)}`,
    `grammar: ${list(q.learned.grammar, GRAMMAR_LISTED)}`,
    "",
    "THE QUESTION",
    q.question,
    "",
    // Sam, 2026-11-15: the answers only said what the card already said. The
    // card is where an answer starts, and what limits it is the Japanese.
    "Answer in three to five short sentences of plain English, the way a good teacher would. Talk to the learner as \"you\".",
    "- Answer what they asked, and add what helps them understand it, from what you know about Japanese. Go past the card when that helps; don't just repeat it, and don't say what the card leaves out.",
    "- Write no Japanese except what is on the card, in the question, or in the lists above. When an example would help, build it only from those. When the answer needs a word, kanji or pattern they haven't learned, explain the idea in English without writing it in Japanese.",
    // "this card" alone turned away "When would I use が instead?" on は's card
    "- Questions about anything in Japanese are fine, related or not. Only when the question has nothing to do with Japanese, say you can only help with Japanese.",
    // the cloud told シ from ツ by a stroke count that was wrong (2026-11-15)
    "- Only describe how a character is drawn (its strokes or parts) when the card describes it.",
    "- Put a Japanese word's meaning in round brackets after it the first time you write it, with its kana reading first if it has kanji: 私 (わたし, I).",
    // the cloud wrote すい as "suu" without it (2026-11-15), and English
    // can't be checked
    "- Write a reading the way the card writes it, never in your own romaji.",
    "- No dashes, no lists, no headings.",
  ].join("\n");
}

/** The answer's shape, as JSON Schema: a response constraint on the device,
 * a response schema in the cloud. */
export const PAGE_ASK_SCHEMA = {
  type: "object",
  properties: { answer: { type: "string" } },
  required: ["answer"],
} as const;

export const parsePageAnswer = (reply: string) => jsonField(reply, "answer");

/** The Japanese characters in an answer that are not on the card, in the
 * question, or in anything the learner has learned, and the words of two or
 * more kanji that aren't written in any of those. Empty means it can be
 * shown. */
export function unlearned(text: string, q: PageQuestion): string[] {
  const given = [q.page, q.question, q.learned.kana, ...q.learned.kanji, ...q.learned.words, ...q.learned.grammar].join("\n");
  const chars = charsOutside(text, given);
  // a word of two or more kanji must be written somewhere as it is: 水道
  // passes 水 and 道 one at a time, and is still a word they haven't met
  // (the kanji lines are single characters, so they don't count)
  const written = [q.page, q.question, ...q.learned.words, ...q.learned.grammar].join("\n");
  const words = [...new Set(text.match(KANJI_RUN) ?? [])].filter((w) => !written.includes(w) && [...w].every((c) => !chars.includes(c)));
  return [...chars, ...words];
}

const KANJI_RUN = /[\p{Script=Han}々]{2,}/gu;

/** Asks the question: the first model, then the cloud when the first failed,
 * ran out of time, or wrote Japanese the learner hasn't met. Null when
 * nothing usable came back. */
export function answerWith(q: PageQuestion, models: Models): Promise<PageAnswer | null> {
  return askInOrder({ prompt: pageAskPrompt(q), parse: parsePageAnswer, check: (text) => unlearned(text, q), label: "Page questions" }, models);
}
