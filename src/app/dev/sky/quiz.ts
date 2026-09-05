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
import { entryOf, factInfo, factsOf } from "@/lib/facts";
import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { VOCAB, VOCAB_SUBJECT, vocabRow } from "@/data/vocab";
import { wordPitch } from "@/data/pitch";
import { COUNTER_KIND, entryForGlyph, knownFactsOf, LIB_ENTRIES_BY_KIND, type Kind } from "@/lib/library/entries";
import { quizzableFacts } from "@/lib/library/reading-proof-facts";
import { answerIsMeaning, isSound, quizInstruction } from "@/lib/quiz-instruction";
import { dueFacts } from "@/lib/selection";
import type { QuizCard, QuizOption } from "@/sky/lib/quiz";
import type { Direction, FactId, HistoryFile } from "@/types";

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
  return quizCards(history, quizFacts(history, picks, now), now);
}

/** The cards for some facts, in order. */
export function quizCards(history: HistoryFile, facts: readonly FactId[], now = Date.now()): QuizCard[] {
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

/** Every question type of every kind (Sam, 2026-09-05), for the sample:
 * kana, type the reading; radical and kanji, type the meaning; kanji, type
 * the reading in a word; word, type the meaning, type the reading, pick
 * the reading with the right pitch; counter, type the meaning and the
 * reading; grammar, pick the meaning, build the form; a verb pair and a
 * keigo set, pick. One thing of each kind, the first that has the fact. */
export function sampleCards(history: HistoryFile, now = Date.now()): QuizCard[] {
  const first = (kind: Kind, want: (fact: string) => boolean, strict = true): FactId | undefined => {
    for (const e of LIB_ENTRIES_BY_KIND.get(kind) ?? []) {
      // a reading fact waits on a proving word (reading-proof-facts); the
      // pretend learner has proved none, so the unproved list is searched too
      const facts = strict ? quizzableFacts(knownFactsOf(e), history) : factsOf(e.id);
      const f = facts.find((x) => want(x as string));
      if (f) return f;
    }
    return undefined;
  };
  const meaning = (f: string) => f.includes("/meaning");
  const reading = (f: string) => f.includes("/reading");
  const facts = [
    first(KANA_SUBJECT, reading),
    // a radical that is a kanji too (一) carries the kanji's fact; ask one of its own
    first(RADICAL_SUBJECT, (f) => f.startsWith("radical:") && meaning(f)),
    first(KANJI_SUBJECT, meaning),
    first(KANJI_SUBJECT, reading, false),
    first(VOCAB_SUBJECT, meaning),
    first(VOCAB_SUBJECT, reading),
    first(COUNTER_KIND, meaning),
    first(COUNTER_KIND, reading, false),
    first(GRAMMAR_SUBJECT, meaning),
    first(GRAMMAR_SUBJECT, (f) => !meaning(f)),
    first(TRANSITIVITY_SUBJECT, () => true),
    first(KEIGO_SUBJECT, () => true),
  ].filter((f): f is FactId => !!f);
  const cards = quizCards(history, [...new Set(facts)], now);
  // the pitch card sits with the word cards
  const word = VOCAB.find((w) => wordPitch(w.keb) !== null && [...w.reb].length >= 3);
  const pitch = word ? pitchCard(history, word.keb, now) : undefined;
  const afterWords = cards.findIndex((c) => c.item.kind === "word" && c.answerIs === "reading");
  if (pitch) cards.splice(afterWords >= 0 ? afterWords + 1 : cards.length, 0, pitch);
  return cards;
}

/** The morae of a reading: each kana, a small ゃゅょ joining the one before. */
function moraeOf(reading: string): number {
  return [...reading].filter((c) => !/[ゃゅょャュョ]/.test(c)).length;
}

/** A card asking which pitch a word takes: its reading drawn with the fall
 * in different places, the true one among them. The Sky's own question,
 * with no fact behind it yet, so it records nothing (see recordQuiz). */
export function pitchCard(history: HistoryFile, keb: string, now = Date.now()): QuizCard | undefined {
  const row = vocabRow(keb);
  const downstep = wordPitch(keb);
  const id = entryForGlyph(VOCAB_SUBJECT, keb);
  if (!row || downstep === null || !id) return undefined;
  const item = offerings(history, now).offerPick(id);
  if (!item) return undefined;
  const n = moraeOf(row.reb);
  const wrong = [0, 1, n, 2, 3, n - 1].filter((d, i, all) => d >= 0 && d <= n && d !== downstep && all.indexOf(d) === i).slice(0, 3);
  const options: QuizOption[] = [downstep, ...wrong].map((d) => ({ id: `pitch:${d}`, label: row.reb, jp: true, pitch: d })).sort(() => Math.random() - 0.5);
  return {
    id: `${id}/pitch`,
    item,
    prompt: { glyph: keb, jp: true, context: row.glosses[0] },
    instruction: "Pick how this word is said, with the pitch in the right place.",
    answerIs: "other",
    typed: false,
    options,
    answerId: `pitch:${downstep}`,
    answer: row.reb,
    seen: 0,
    missed: 0,
    teach: teachFor(item),
    meta: { dir: "jp2en" },
  };
}

/** The signed-in learner's quiz, or a visitor's. */
export async function learnerQuiz(picks: readonly string[], now = Date.now()): Promise<QuizCard[]> {
  return quizFromHistory(await learnerHistory(), picks, now);
}
