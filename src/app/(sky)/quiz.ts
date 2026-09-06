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
import { pitchFactId, PITCH_SUBJECT } from "@/data/pitch-facts";
import { pitchInstruction, rollPitchQuestion } from "@/lib/pitch-quiz";
import { assemblyFacts, canonicalOrder, pickAssemblyForTiers } from "@/data/assembly";
import { isSentenceTierMarkerFact, sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { SENTENCE_RULE_KIND } from "@/lib/library/entries";
import { currentUserId } from "@/lib/auth";
import { loadSettings } from "@/lib/settings";
import { CONSTRUCTION_CATEGORIES, constructionConfigForFact, isConstructionFact } from "@/data/counter-categories";
import { answerIsJapanese, fixedDirOf, grammarVehicleFor, mcOnlyIn, questionsFor, revealFor, type PromptContext } from "@/lib/engine/question";
import { isKatakana } from "@/lib/romaji";
import { entryOf, factInfo, factsOf } from "@/lib/facts";
import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { VOCAB, VOCAB_SUBJECT, vocabRow } from "@/data/vocab";
import { COUNTER_KIND, entryForGlyph, knownFactsOf, LIB_ENTRIES_BY_KIND, libEntry, type Kind } from "@/lib/library/entries";
import { quizzableFacts } from "@/lib/library/reading-proof-facts";
import { answerIsMeaning, isSound, quizInstruction } from "@/lib/quiz-instruction";
import { dueFacts } from "@/lib/selection";
import type { QuizCard, QuizOption } from "@/sky/lib/quiz";
import type { SkyItem } from "@/sky/lib/types";
import type { Direction, EntryId, FactId, HistoryFile } from "@/types";

import { learnerHistory } from "./atlas";
import { offerings, pickFacts } from "./observatory";
import { teachFor } from "./teach";

/** The basket: how many cards a session asks (SAK-311's cap). */
export const QUIZ_CAP = 8;

/** The facts a session asks: the picks' quizzable facts when picks are
 * named, else what is due, capped. */
/** What the learner's settings allow a quiz to ask: pitch cards, and
 * listening cards (SAK-345). */
export interface QuizOptions {
  pitch?: boolean;
  audio?: boolean;
}

export function quizFacts(history: HistoryFile, picks: readonly string[], now = Date.now(), pitch = true): FactId[] {
  if (picks.length) {
    const facts = picks.flatMap((id) => quizzableFacts(pickFacts([id]), history));
    // a word's pitch is asked in its lesson too, as its own fact (SAK-344),
    // while pitch questions are on in Settings
    if (pitch) for (const id of picks) { const e = libEntry(id as never); if (e?.kind === VOCAB_SUBJECT) { const pf = pitchFactId(e.glyph); if (factInfo(pf)) facts.push(pf); } }
    return [...new Set(facts)].slice(0, QUIZ_CAP);
  }
  return dueFacts(history, [], now).filter((f) => pitch || factInfo(f)?.subject !== PITCH_SUBJECT).slice(0, QUIZ_CAP);
}

export function quizFromHistory(history: HistoryFile, picks: readonly string[], now = Date.now(), options: QuizOptions = {}): QuizCard[] {
  return quizCards(history, quizFacts(history, picks, now, options.pitch ?? true), now, options);
}

/** What a listening card plays for a fact, or undefined when the fact has
 * no sound to ask by: a word's meaning or reading card plays the reading
 * asked about, a kana's card plays the kana. A reading card asked by ear is
 * the app's transcription card: hear it, type the kana in romaji. */
function listenTextFor(fact: FactId, item: SkyItem): string | undefined {
  const id = fact as string;
  if (item.kind === "kana") return item.glyph;
  if (item.kind === "word" && (id.includes("/meaning") || id.includes("/reading"))) return wordReadingAsked(fact, item);
  return undefined;
}

/** The cards for some facts, in order. With `audio`, a card that has a
 * sound to ask by becomes a listening card half the time. */
export function quizCards(history: HistoryFile, facts: readonly FactId[], now = Date.now(), opts: QuizOptions = {}): QuizCard[] {
  const o = offerings(history, now);
  const known = Object.keys(history.facts ?? {}) as FactId[];
  const cards: QuizCard[] = [];
  // A grammar production card is drilled on a VERB, and which verb is a
  // property of the showing rather than the fact: the pool prefers one the
  // learner knows, and when she knows none it hands back a filler drawn in
  // KANA, since a card built on 買う measures whether she can read 買う and
  // not whether she knows the pattern (Sam's standing rule). Nothing called
  // for one after the cutover, so every grammar card fell back to the fact's
  // baked kanji lemma. The set is the deck's own: two patterns in a sitting
  // should not both roll およぐ.
  const usedVehicles = new Set<string>();
  for (const fact of facts) {
    // a sentence tier's marker is asked as an ordering (SAK-346)
    if (isSentenceTierMarkerFact(fact)) { const c = orderCard(history, fact, now); if (c) cards.push(c); continue; }
    const info = factInfo(fact);
    if (!info) continue;
    // a pitch fact is the app's pitch question, as a card of its own
    if (info.subject === PITCH_SUBJECT) { const c = pitchCard(history, info.glyph, now); if (c) cards.push(c); continue; }
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
    const vehicle = grammarVehicleFor(fact, history, Math.random, usedVehicles);
    if (vehicle) usedVehicles.add(vehicle.surface);
    // One context for the whole card, so the prompt, the board, the reveal
    // and the grader all speak about the same showing. The board's other
    // facts take it too: a distractor should be this vehicle's wrong form
    // (食べたい against 食べてから), not another verb's.
    const ctx: PromptContext | undefined = construction ? { numberItem: construction } : vehicle ? { grammarVehicle: vehicle } : undefined;
    const prompt = questionsFor(fact).prompt(fact, dir, ctx);
    const qt = questionsFor(fact);
    const options: QuizOption[] = buildMcOptions(fact, dir, ctx, known).map((f) => {
      const label = qt.optionLabel?.(f, dir, ctx) ?? revealFor(f, dir, ctx);
      return { id: f, label, jp: /[぀-ヿ一-龯]/.test(label) };
    });
    // the answer is always among the options; the engine sees to it, but a
    // card with no board at all would be unanswerable by recognition
    if (!options.some((op) => op.id === fact)) options.unshift({ id: fact, label: revealFor(fact, dir, ctx), jp: /[぀-ヿ一-龯]/.test(revealFor(fact, dir, ctx)) });
    const hint = hintFor(fact, dir);
    const agg = history.facts?.[fact];
    const listen = opts.audio && typed ? listenTextFor(fact, item) : undefined;
    const listenIt = listen !== undefined && Math.random() < 0.5 ? listen : undefined;
    // The box types kana for any card whose answer is Japanese, which is
    // every reading but a kana's: asked あ you say "a", and there is no
    // romaji for a meaning. A rolled counting card is read aloud, so it
    // answers in kana too.
    const typedCard = construction ? true : typed;
    const answer = construction ? construction.reading : revealFor(fact, dir, ctx);
    const inKana = typedCard && (!!construction || answerIsJapanese(fact, dir));
    const instruction = listenIt
      ? (item.kind === "kana" ? "Listen, then type the reading in romaji." : (fact as string).includes("/reading") ? "Listen, then type the reading." : "Listen, then type what it means.")
      : construction
        ? (construction.kind === "counter" ? "Type how you say this many." : "Type how this number is said.")
        : quizInstruction(fact, dir, typed ? "typed" : "mc");
    cards.push({
      id: fact,
      item,
      prompt: { glyph: prompt.glyph, jp: prompt.jp, ...(prompt.context && !anchored ? { context: prompt.context } : {}), ...(anchored ? { within: anchored[2] } : {}) },
      ...(instruction ? { instruction } : {}),
      ...(hint ? { hint: hint.kind === "image" ? { image: hint.src } : hint.kind === "text" ? { text: hint.text } : {} } : {}),
      answerIs: construction ? "reading" : answerIsMeaning(fact, dir) ? "meaning" : isSound(fact, dir) ? "reading" : "other",
      typed: typedCard,
      ...(inKana ? { answerInKana: isKatakana(answer) ? "katakana" as const : "hiragana" as const } : {}),
      options: construction ? [{ id: fact, label: construction.reading, jp: true }] : options,
      answerId: fact,
      answer,
      seen: agg?.seen ?? 0,
      missed: agg?.missed ?? 0,
      ...(listenIt ? { listen: listenIt } : {}),
      // a word card asks about one reading (a qualified fact names it, a
      // plain one is the word's first), so its reveal is that reading's
      // lesson card, not the whole entry (Sam, 2026-09-05)
      teach: teachFor(item, { reading: wordReadingAsked(fact, item) }),
      // the vehicle rides back with the answer, so the client grades the
      // pattern built on the verb it was ASKED on, not the fact's baked one
      meta: {
        dir,
        ...(construction ? { accept: construction.accept.join("|") } : {}),
        ...(vehicle ? { vehicle: vehicle.surface, vehicleKana: vehicle.kana, vehicleCls: vehicle.cls ?? "", vehicleKnown: vehicle.known ? "1" : "" } : {}),
      },
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
    // a sentence tier: put the pieces in order (its marker is a known fact,
    // never a listed one)
    first(SENTENCE_RULE_KIND, () => true),
  ].filter((f): f is FactId => !!f);
  const cards = quizCards(history, [...new Set(facts)], now);
  // and one listening card: a word's meaning, asked by ear
  const spoken = facts.find((f) => (f as string).startsWith("word:") && (f as string).includes("/meaning"));
  const spokenCard = spoken ? cards.find((c) => c.id === spoken) : undefined;
  if (spoken && spokenCard) {
    const heard: QuizCard = { ...spokenCard, id: `${spoken}#listen`, listen: wordReadingAsked(spoken, spokenCard.item), instruction: "Listen, then type what it means." };
    cards.splice(cards.indexOf(spokenCard) + 1, 0, heard);
  }
  // the pitch card sits with the word cards: a real homophone pair when
  // the curriculum has one (悪 and 開く share あく), else a mispitched twin
  const questions = VOCAB.map((w) => [w.keb, rollPitchQuestion(w.keb)] as const).filter((x) => x[1]);
  const keb = (questions.find((x) => x[1]!.mode === "pair") ?? questions[0])?.[0];
  const pitch = keb ? pitchCard(history, keb, now) : undefined;
  const afterWords = cards.findIndex((c) => c.item.kind === "word" && c.answerIs === "reading");
  if (pitch) cards.splice(afterWords >= 0 ? afterWords + 1 : cards.length, 0, pitch);
  return cards;
}

/** A sentence tier's ordering (SAK-346): one of the tier's sentences the
 * learner can read, its pieces dealt shuffled, the English as the prompt,
 * the app's one accepted order as the answer. The card is the tier's
 * marker fact; the recorder credits the sentence's pattern facts, as the
 * app's assembly drill does. */
export function orderCard(history: HistoryFile, marker: FactId, now = Date.now()): QuizCard | undefined {
  const tierId = (marker as string).replace(/^grammar:sentence-ordering-tier\//, "");
  const entry = (LIB_ENTRIES_BY_KIND.get(SENTENCE_RULE_KIND) ?? []).find((e) => knownFactsOf(e).includes(sentenceTierMarkerFact(tierId)));
  const item = pickAssemblyForTiers(history, [tierId]);
  const pick = entry ? offerings(history, now).offerPick(entry.id) : undefined;
  if (!item || !pick) return undefined;
  const answer = canonicalOrder(item);
  const pieces = [...answer];
  for (let i = pieces.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; }
  // a deal that is already the answer is no question; deal again once
  if (pieces.every((p, i) => p === answer[i]) && pieces.length > 1) pieces.push(pieces.shift()!);
  const agg = history.facts?.[marker];
  return {
    id: marker,
    item: pick,
    prompt: { glyph: item.en, jp: false },
    instruction: "Put the pieces in the order that says this.",
    answerIs: "other",
    typed: false,
    options: [],
    answerId: marker,
    answer: item.jp,
    order: { pieces, answer },
    seen: agg?.seen ?? 0,
    missed: agg?.missed ?? 0,
    teach: teachFor(pick),
    meta: { dir: "jp2en", assembly: String(item.id), facts: assemblyFacts(item).join("|") },
  };
}

/** The app's own pitch question (SAK-128) as a card: the word's reading
 * twice, once with its true pitch and once with another (a homophone
 * partner's, or a made-up one), the learner picking which means the word.
 * Each choice is drawn with its pitch and can be heard through the app's
 * pitch clips. The card is the word's pitch fact (SAK-344), so it records. */
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
    seen: history.facts?.[pitchFactId(keb)]?.seen ?? 0,
    missed: history.facts?.[pitchFactId(keb)]?.missed ?? 0,
    teach: teachFor(item),
    meta: { dir: "jp2en" },
  };
}

/** The reading a word fact is about: word:日/reading@にち names にち; a plain
 * word fact is the word's first reading. Undefined for anything else. */
function wordReadingAsked(fact: FactId, item: SkyItem): string | undefined {
  if (item.kind !== "word" || !(fact as string).startsWith("word:")) return undefined;
  const m = /@([^#]+)/.exec(fact as string);
  return m ? m[1] : vocabRow(item.glyph)?.reb;
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
  const userId = await currentUserId();
  const cfg = userId ? (await loadSettings(userId)).cfg : undefined;
  return quizFromHistory(await learnerHistory(), picks, now, { pitch: cfg?.pitchQuestions ?? true, audio: cfg?.audioPrompts ?? true });
}
