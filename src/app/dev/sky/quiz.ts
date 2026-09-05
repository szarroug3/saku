// The Quiz's cards from the app's own question engine. Server-side and
// dev-only, like the adapters beside it: which facts to ask (the picks'
// quizzable facts, or what is due), and for each the app's prompt, its
// narrowed set with the app's distractors, its reveal, its hint and its
// instruction, plus the thing it is a fact of and what the card teaches,
// so the reveal is the lesson's own card. Grading happens on the client
// with the app's matchers (see quiz-client.tsx); recording is a server
// action (see actions.ts).

import { buildMcOptions } from "@/lib/engine";
import { hintFor } from "@/lib/engine/hint";
import { fixedDirOf, mcOnlyIn, questionsFor, revealFor } from "@/lib/engine/question";
import { entryOf, factInfo } from "@/lib/facts";
import { KANA_SUBJECT } from "@/data/characters";
import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { entryForGlyph } from "@/lib/library/entries";
import { quizzableFacts } from "@/lib/library/reading-proof-facts";
import { answerIsMeaning, isSound, quizInstruction } from "@/lib/quiz-instruction";
import { dueFacts } from "@/lib/selection";
import type { QuizCard, QuizOption } from "@/sky/lib/quiz";
import type { Direction, EntryId, FactId, HistoryFile } from "@/types";

import { learnerHistory } from "./atlas";
import { offerings, pickFacts } from "./observatory";
import { teachFor } from "./teach";

/** The basket: how many cards a session asks (SAK-311's cap). */
export const QUIZ_CAP = 8;

/** The facts a session asks: the picks' quizzable facts when picks are
 * named, else what is due, capped. */
export function quizFacts(history: HistoryFile, picks: readonly string[], now = Date.now()): FactId[] {
  if (picks.length) {
    const facts = picks.flatMap((id) => quizzableFacts(pickFacts([id]), history));
    return [...new Set(facts)].slice(0, QUIZ_CAP);
  }
  return dueFacts(history, [], now).slice(0, QUIZ_CAP);
}

export function quizFromHistory(history: HistoryFile, picks: readonly string[], now = Date.now()): QuizCard[] {
  const facts = quizFacts(history, picks, now);
  const o = offerings(history, now);
  const known = Object.keys(history.facts ?? {}) as FactId[];
  const cards: QuizCard[] = [];
  for (const fact of facts) {
    const info = factInfo(fact);
    if (!info) continue;
    const item = o.offerPick(entryOf(fact));
    if (!item) continue;
    const dir: Direction = fixedDirOf(fact) ?? "jp2en";
    const typed = !mcOnlyIn(fact, dir);
    const prompt = questionsFor(fact).prompt(fact, dir);
    const qt = questionsFor(fact);
    const options: QuizOption[] = buildMcOptions(fact, dir, undefined, known).map((f) => {
      const label = qt.optionLabel?.(f, dir) ?? revealFor(f, dir);
      return { id: f, label, jp: /[぀-ヿ一-龯]/.test(label) };
    });
    // the answer is always among the options; the engine sees to it, but a
    // card with no board at all would be unanswerable by recognition
    if (!options.some((op) => op.id === fact)) options.unshift({ id: fact, label: revealFor(fact, dir), jp: /[぀-ヿ一-龯]/.test(revealFor(fact, dir)) });
    const hint = hintFor(fact, dir);
    const agg = history.facts?.[fact];
    cards.push({
      id: fact,
      item,
      prompt: { glyph: prompt.glyph, jp: prompt.jp, ...(prompt.context ? { context: prompt.context } : {}) },
      ...(quizInstruction(fact, dir, typed ? "typed" : "mc") ? { instruction: quizInstruction(fact, dir, typed ? "typed" : "mc")! } : {}),
      ...(hint ? { hint: hint.kind === "image" ? { image: hint.src } : hint.kind === "text" ? { text: hint.text } : {} } : {}),
      answerIs: answerIsMeaning(fact, dir) ? "meaning" : isSound(fact, dir) ? "reading" : "other",
      typed,
      options,
      answerId: fact,
      answer: revealFor(fact, dir),
      seen: agg?.seen ?? 0,
      missed: agg?.missed ?? 0,
      teach: teachFor(item),
      meta: { dir },
    });
  }
  return cards;
}

/** A handful of the pretend learner's things, for a quiz with nothing
 * due: a few kana, a kanji or two, a word. */
export function samplePicks(): string[] {
  const kana = ["あ", "き", "す"].map((g) => entryForGlyph(KANA_SUBJECT, g));
  const kanji = ["人", "日"].map((g) => entryForGlyph(KANJI_SUBJECT, g));
  const words = ["山", "花火", "水"].map((g) => entryForGlyph(VOCAB_SUBJECT, g));
  return [...kana, ...kanji, ...words].filter((id): id is EntryId => !!id);
}

/** The signed-in learner's quiz, or a visitor's. */
export async function learnerQuiz(picks: readonly string[], now = Date.now()): Promise<QuizCard[]> {
  return quizFromHistory(await learnerHistory(), picks, now);
}
