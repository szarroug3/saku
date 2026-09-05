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
import { rollConstructionItem } from "@/lib/engine/number-quiz";
import { pitchInstruction, rollPitchQuestion } from "@/lib/pitch-quiz";
import { CONSTRUCTION_CATEGORIES, constructionConfigForFact, isConstructionFact } from "@/data/counter-categories";
import { fixedDirOf, mcOnlyIn, questionsFor, revealFor } from "@/lib/engine/question";
import { entryOf, factInfo, factsOf } from "@/lib/facts";
import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { VOCAB, VOCAB_SUBJECT } from "@/data/vocab";
import { COUNTER_KIND, entryForGlyph, knownFactsOf, LIB_ENTRIES_BY_KIND, libEntry, type Kind } from "@/lib/library/entries";
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
    // a kanji is never asked how it is said on its own (Sam, 2026-09-05):
    // only inside a word, which the card then shows
    const anchored = /^kanji:(.+?)\/reading@([^#]+)/.exec(fact as string);
    if (anchored && anchored[2] === anchored[1]) continue;
    // a counting rule (11 to 99, 〜本) is asked on a number rolled for this
    // showing, the app's own way: how is 六十七 said
    const construction = isConstructionFact(fact) ? rollConstructionItem({ ...constructionConfigForFact(fact)!, directions: ["read"] }, Math.random) : null;
    if (isConstructionFact(fact) && !construction) continue;
    const dir: Direction = fixedDirOf(fact) ?? "jp2en";
    const typed = !mcOnlyIn(fact, dir);
    const prompt = questionsFor(fact).prompt(fact, dir, construction ? { numberItem: construction } : undefined);
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
    const instruction = construction
      ? (construction.kind === "counter" ? "Type how you say this many." : "Type how this number is said.")
      : quizInstruction(fact, dir, typed ? "typed" : "mc");
    cards.push({
      id: fact,
      item,
      prompt: { glyph: prompt.glyph, jp: prompt.jp, ...(prompt.context && !anchored ? { context: prompt.context } : {}), ...(anchored ? { within: anchored[2] } : {}) },
      ...(instruction ? { instruction } : {}),
      ...(hint ? { hint: hint.kind === "image" ? { image: hint.src } : hint.kind === "text" ? { text: hint.text } : {} } : {}),
      answerIs: construction ? "reading" : answerIsMeaning(fact, dir) ? "meaning" : isSound(fact, dir) ? "reading" : "other",
      typed: construction ? true : typed,
      options: construction ? [{ id: fact, label: construction.reading, jp: true }] : options,
      answerId: fact,
      answer: construction ? construction.reading : revealFor(fact, dir),
      seen: agg?.seen ?? 0,
      missed: agg?.missed ?? 0,
      teach: teachFor(item),
      meta: { dir, ...(construction ? { accept: construction.accept.join("|") } : {}) },
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
    // a kanji's reading is only ever asked inside a word, so a fact anchored on one
    first(KANJI_SUBJECT, (f) => /\/reading@(.+)/.test(f) && !/\/reading@([^#]+)/.exec(f)![1].match(/^.$/), false),
    first(VOCAB_SUBJECT, meaning),
    first(VOCAB_SUBJECT, reading),
    first(COUNTER_KIND, meaning),
    // the counting rules roll a number: how is 六十七 said, how do you say four people
    CONSTRUCTION_CATEGORIES.find((c) => c.id === "tens")?.fact,
    CONSTRUCTION_CATEGORIES.find((c) => c.id === "ko")?.fact,
    first(GRAMMAR_SUBJECT, meaning),
    first(GRAMMAR_SUBJECT, (f) => !meaning(f)),
    first(TRANSITIVITY_SUBJECT, () => true),
    first(KEIGO_SUBJECT, () => true),
  ].filter((f): f is FactId => !!f);
  const cards = quizCards(history, [...new Set(facts)], now);
  // the pitch card sits with the word cards: a real homophone pair when
  // the curriculum has one (悪 and 開く share あく), else a mispitched twin
  const questions = VOCAB.map((w) => [w.keb, rollPitchQuestion(w.keb)] as const).filter((x) => x[1]);
  const keb = (questions.find((x) => x[1]!.mode === "pair") ?? questions[0])?.[0];
  const pitch = keb ? pitchCard(history, keb, now) : undefined;
  const afterWords = cards.findIndex((c) => c.item.kind === "word" && c.answerIs === "reading");
  if (pitch) cards.splice(afterWords >= 0 ? afterWords + 1 : cards.length, 0, pitch);
  return cards;
}

/** The app's own pitch question (SAK-128) as a card: the word's reading
 * twice, once with its true pitch and once with another (a homophone
 * partner's, or a made-up one), the learner picking which means the word.
 * Each choice is drawn with its pitch and can be heard through the app's
 * pitch clips. No fact of its own yet, so it records nothing. */
export function pitchCard(history: HistoryFile, keb: string, now = Date.now()): QuizCard | undefined {
  const q = rollPitchQuestion(keb);
  const id = entryForGlyph(VOCAB_SUBJECT, keb);
  if (!q || !id) return undefined;
  const item = offerings(history, now).offerPick(id);
  if (!item) return undefined;
  const other = q.mode === "pair" ? q.partnerDownstep : q.wrongDownstep;
  if (other === null) return undefined;
  const correctFirst = Math.random() < 0.5;
  const pair: QuizOption[] = [{ id: "pitch:right", label: q.reading, jp: true, pitch: q.downstep }, { id: "pitch:other", label: q.reading, jp: true, pitch: other }];
  return {
    id: `${id}/pitch`,
    item,
    prompt: { glyph: keb, jp: true, context: q.gloss },
    instruction: pitchInstruction({ promptGloss: q.gloss }),
    // the choices are sounds; the hint writes each one out with its pitch,
    // on the clips themselves, so there is nothing to say below
    hint: {},
    answerIs: "other",
    typed: false,
    options: correctFirst ? pair : [pair[1], pair[0]],
    answerId: "pitch:right",
    answer: q.reading,
    answerPitch: q.downstep,
    seen: 0,
    missed: 0,
    teach: teachFor(item),
    meta: { dir: "jp2en" },
  };
}

/** The cards some ids name, in that order: a fact each, or a word's pitch
 * card (`word:X/pitch`). What a retry from the results asks. */
export function cardsFor(history: HistoryFile, ids: readonly string[], now = Date.now()): QuizCard[] {
  const out: QuizCard[] = [];
  for (const id of ids) {
    const pitch = /^(.+)\/pitch$/.exec(id);
    if (pitch) {
      const keb = libEntry(pitch[1] as EntryId)?.glyph;
      const card = keb ? pitchCard(history, keb, now) : undefined;
      if (card) out.push(card);
      continue;
    }
    out.push(...quizCards(history, [id as FactId], now));
  }
  return out;
}

/** The signed-in learner's quiz, or a visitor's. */
export async function learnerQuiz(picks: readonly string[], now = Date.now()): Promise<QuizCard[]> {
  return quizFromHistory(await learnerHistory(), picks, now);
}
