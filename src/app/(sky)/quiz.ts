// The Quiz's cards from the app's own question engine. Server-side and
// dev-only, like the adapters beside it: which facts to ask (the picks'
// quizzable facts, or what is due), and for each the app's prompt, its
// narrowed set with the app's distractors, its reveal, its hint and its
// instruction, plus the thing it is a fact of and what the card teaches,
// so the reveal is the lesson's own card. Grading happens on the client
// with the app's matchers (see quiz-client.tsx); recording is a server
// action (see actions.ts).

import { answerKeyFor, buildMcOptions } from "@/lib/engine";
import { hintFor } from "@/lib/engine/hint";
import { derivationLines } from "@/lib/grammar/derivation";
import { rollConstructionItem } from "@/lib/engine/number-quiz";
import { pitchFactId, PITCH_SUBJECT } from "@/data/pitch-facts";
import { pitchInstruction, rollPitchQuestion } from "@/lib/pitch-quiz";
import { assemblyFacts, canonicalOrder, pickAssemblyForTiers } from "@/data/assembly";
import { isSentenceTierMarkerFact, sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { confusableWith, SENTENCE_RULE_KIND } from "@/lib/library/entries";
import { CONSTRUCTION_CATEGORIES, constructionConfigForFact, isConstructionFact } from "@/data/counter-categories";
import { answerIsJapanese, fixedDirOf, grammarVehicleFor, interchangeableReadings, mcOnlyIn, questionsFor, revealFor, type PromptContext } from "@/lib/engine/question";
import { isKatakana } from "@/lib/romaji";
import { entryOf, factInfo, factsOf } from "@/lib/facts";
import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { kanjiRow, KANJI_SUBJECT } from "@/data/kanji";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { isWordReadingFact, VOCAB, VOCAB_SUBJECT, vocabRow } from "@/data/vocab";
import { COUNTER_KIND, entryForGlyph, knownFactsOf, LIB_ENTRIES_BY_KIND, libEntry, type Kind } from "@/lib/library/entries";
import { quizzableFacts } from "@/lib/library/reading-proof-facts";
import { answerIsMeaning, isSound, quizInstruction } from "@/lib/quiz-instruction";
import { dueFacts } from "@/lib/selection";
import { buildGraph } from "@/sky/lib/graph";
import { shuffleDeck, type AnswerKey, type QuizCard, type QuizOption } from "@/sky/lib/quiz";
import type { SkyItem } from "@/sky/lib/types";
import type { EntryId, FactId } from "@/types/facts";
import type { Direction } from "@/types/sky";
import type { HistoryFile } from "@/types/store";

import { offerPicker, pickFacts } from "./observatory";
import { readingRuleFor } from "./quiz-rules";
import { teachFor } from "./teach";

/** The basket: how many cards a session asks (SAK-311's cap). It is the
 * daily review's, and only the daily review's. A lesson's quiz asks about
 * what the lesson taught, however much that is (SAK-447): a night of nine
 * words teaches eighteen stars, and a quiz that stopped at eight left ten
 * of them taught and never asked. */
const QUIZ_CAP = 8;

/** What the learner's settings allow a quiz to ask: pitch cards, and
 * listening cards (SAK-345). `everyWay` is not a setting: it is a lesson's
 * quiz saying it wants every question type a taught thing has, rather than
 * one card a fact (SAK-447). */
export interface QuizOptions {
  pitch?: boolean;
  audio?: boolean;
  everyWay?: boolean;
}

/** Whether a fact has never been put to the learner: nothing recorded
 * against it and no claim. Opening a star in a lesson marks it seen, which
 * is not the same as being asked, so this is what tells a prerequisite the
 * lesson TAUGHT tonight from one the lesson merely rests on. */
function untested(fact: FactId, history: HistoryFile): boolean {
  return !(history.facts?.[fact]?.seen ?? 0) && history.claims?.[fact] === undefined;
}

/** A word's pitch as a fact of its own (SAK-344), where the app has one. */
function pitchFactsOf(id: string): FactId[] {
  const entry = libEntry(id as never);
  if (entry?.kind !== VOCAB_SUBJECT) return [];
  const fact = pitchFactId(entry.glyph);
  return factInfo(fact) ? [fact] : [];
}

/** Every star a lesson of these picks teaches, in the lesson's own order:
 * each pick and the prerequisites taught under it. The lesson walks
 * `graph.orderOf(pick)` over the items the Observatory offers
 * (src/sky/lib/lesson.ts's `lessonSteps`, through ./lesson.ts), so this
 * walks the same order over the same items and the quiz can only ask about
 * what the lesson put on the screen. `offerPicker` builds the picks and
 * what is under them rather than the whole sky, which is all the walk
 * reads (SAK-382). A group (a kana row, the 〜つ rule) is a place rather
 * than a star, and `pickFacts` already knows what each one holds, so it
 * rides along and its members dedupe against it. */
function taughtStars(history: HistoryFile, picks: readonly string[], now: number): string[] {
  const offer = offerPicker(history, now);
  const built = picks.filter((id) => !!offer.offerPick(id));
  const graph = buildGraph([...offer.items.values()]);
  const stars: string[] = [];
  const seen = new Set<string>();
  for (const pick of built) for (const id of graph.orderOf(pick)) { if (!seen.has(id)) { seen.add(id); stars.push(id); } }
  return stars;
}

/** The facts a session asks: everything a lesson taught when picks are
 * named, else what is due, capped.
 *
 * A lesson teaches more than its picks. Nine words bring their kanji and
 * the pieces those are drawn from, and every one of them is a star the
 * learner was walked through tonight, so every one of them is asked
 * (SAK-447). A prerequisite that already had a record before tonight is a
 * reference rather than a step, and is left alone; a pick is asked because
 * it was picked. `quizzable` still gates a kanji's readings, so a kanji
 * taught tonight is asked what it means, and how it is said only inside a
 * word that proves the reading. */
function quizFacts(history: HistoryFile, picks: readonly string[], now = Date.now(), pitch = true): FactId[] {
  if (picks.length) {
    const chosen = new Set(picks);
    const facts: FactId[] = [];
    for (const id of taughtStars(history, picks, now)) {
      const own = [...pickFacts([id]), ...(pitch ? pitchFactsOf(id) : [])];
      facts.push(...quizzableFacts(chosen.has(id) ? own : own.filter((f) => untested(f, history)), history));
    }
    return [...new Set(facts)];
  }
  return dueFacts(history, now).filter((f) => pitch || factInfo(f)?.subject !== PITCH_SUBJECT).slice(0, QUIZ_CAP);
}

/** The deck a session asks. Shuffled here rather than in `quizCards`, so
 * the cards themselves stay in whatever order they were asked for and only
 * the deck is dealt: what is due is picked in the schedule's order and cut
 * to the cap first, and the order that survives is the one nobody chose
 * (SAK-388). */
export function quizFromHistory(history: HistoryFile, picks: readonly string[], now = Date.now(), options: QuizOptions = {}): QuizCard[] {
  const facts = quizFacts(history, picks, now, options.pitch ?? true);
  // a lesson's quiz asks every way it can (SAK-447); the daily review keeps
  // one card to a fact
  return shuffleDeck(quizCards(history, facts, now, { ...options, ...(picks.length ? { everyWay: true } : {}) }));
}

/** Why a wrong choice was on the board, in a few words, or nothing when the
 * app cannot say honestly (SAK-315).
 *
 * The board is already the confusable set: `buildMcOptions` draws it from the
 * lookalike tables, a kanji's own other readings, a word's neighbors in rank,
 * a keigo set's opposite register, a verb pair's other side, another pattern
 * on the same verb. A random distractor tests nothing, because you can throw
 * it out without knowing anything, and a distractor you cannot NAME teaches
 * nothing either: the shape of the mistake you were about to make is the
 * lesson. So each rung below is a relationship the app can check between the
 * asked fact and the option, and it says that relationship in a few words.
 *
 * The rungs are ordered sharpest first, and anything that lands on none of
 * them gets no line. That is the engine's own backstop showing through: when a
 * subject runs out of sharp distractors the board is filled from the subject
 * at large, and there is nothing true to say about such an option beyond "it
 * was another one of these". Better to say nothing than to invent a reason.
 */
function whyOption(fact: FactId, option: FactId, onAVehicle: boolean): string | undefined {
  if (option === fact) return undefined;
  const asked = entryOf(fact);
  const other = entryOf(option);
  const subject = factInfo(fact)?.subject;
  const reading = (f: FactId) => (f as string).includes("/reading");
  if (other === asked) {
    // 生 in 人生 against 生 in 先生: the same character, and which reading
    // applies is the whole question
    if (reading(fact) && reading(option)) return "another reading of the same character";
    if (subject === KEIGO_SUBJECT) return "the same verb in the other register";
  }
  // the flagged pairs: kana's look groups, CONFUSABLE_WITH for kanji, the
  // hand-authored radical pairs. Either way round, since which side carries
  // the pair depends on which of the two is taught as a kanji.
  const a = libEntry(asked);
  const b = libEntry(other);
  if (a && b && (confusableWith(a).includes(other) || confusableWith(b).includes(asked))) return "drawn almost the same";
  // A PIECE OF THE GLYPH BEING ASKED (SAK-315's second example, SAK-432). 曜 is
  // 日 beside 翟, and 翟 is 羽 over 隹: an option that is one of those is not a
  // stranger on the board, it is something you were just looking at inside the
  // character. The engine does not aim for these, it fills a board from the
  // subject at large and lands on one often: of the first 900 kanji, 120 of
  // their meaning boards carry a piece of the very character they ask about,
  // 分's offering 刀, 動's offering 力. Every one of them used to get no line.
  // `comps` is the taught decomposition, the same one the card's "Made of"
  // tiles draw, so the sentence is true of what the app itself shows.
  if (a && b && (kanjiRow(a.glyph)?.comps ?? []).includes(b.glyph)) return `a piece of ${a.glyph}`;
  if (subject === KEIGO_SUBJECT) return "another polite verb";
  if (subject === TRANSITIVITY_SUBJECT) return "the other verb of the pair";
  if (subject === GRAMMAR_SUBJECT && onAVehicle) return "the same verb in another pattern";
  if (subject === VOCAB_SUBJECT && factInfo(option)?.subject === VOCAB_SUBJECT) return "a word about as common as this one";
  return undefined;
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

/** What a card asked by ear asks for: a kana's sound in romaji, a reading
 * transcribed, or what the word means. */
function listenInstruction(fact: FactId, item: SkyItem): string {
  if (item.kind === "kana") return "Listen, then type the reading in romaji, or how it sounds.";
  return (fact as string).includes("/reading") ? "Listen, then type the reading." : "Listen, then type what it means.";
}

/** The same card again, asked by ear (SAK-447). A lesson asks every question
 * type a taught thing has, so the sound is a card BESIDE the writing rather
 * than instead of it: Sam's seven-card lesson quiz came out as six "Listen"
 * cards and one written one, because a coin flip chose between the two and
 * a short deck can lose that flip six times.
 *
 * It carries an id of its own, the `#listen` shape the sample already used,
 * which the recorder strips back to the fact (actions.ts), so both cards
 * count for the one thing they ask about and the run knows which was heard.
 * The writing stays hidden until the card is answered or the hint is asked
 * (sky-quiz.tsx), so the twin gives nothing away. */
function heardTwin(card: QuizCard, listen: string): QuizCard {
  return { ...card, id: `${card.id}#listen`, listen, instruction: listenInstruction(card.id as FactId, card.item) };
}

/** A key that also takes these readings, for a word read more than one way
 * for the same sense (SAK-393). */
function withReadings(key: AnswerKey, readings: readonly string[]): AnswerKey {
  // The readings ARE what it takes, not an addition to them. That is what
  // makes 九's two reading cards the same question, so the deck keeps one.
  const takes = [...readings].sort();
  return { ...key, produce: takes, loose: takes, typo: [] };
}

/** What a card asks, for telling two cards that ask it apart from two that do
 * not: the thing it is about, the direction, and what it will accept. Two
 * facts of one entry that take the same answers are one question. */
function questionAsked(entry: string | undefined, dir: Direction, key: AnswerKey): string {
  const takes = [...(key.produce ?? []), ...(key.loose ?? []), ...(key.strict ?? [])].sort().join("|");
  return `${entry ?? ""}|${dir}|${takes}`;
}

/** Whether a word's meaning card turns its reading into a hint instead of
 * printing it under the glyph (SAK-429).
 *
 * Sam, 2026-09-08: "when i'm supposed to know the word, don't show the kana
 * when it's kanji. that can be a hint instead." A meaning card asks what 行く
 * means, and いく sitting under it answers half of that for free: read the
 * kana, say the word out loud, remember what you said. The reading earns its
 * place the first time the word is asked, where the quiz is still teaching
 * the two halves together, and not after.
 *
 * So a word meaning card written with kanji always hides the reading and
 * offers it as the hint, the first time too (SAK-448): the lesson taught it a
 * minute ago, and printing it under the glyph gives half the word away. A
 * reading card keeps its context either way, because there the glosses are
 * what tells a word's two readings apart, and a kana-only word never had a
 * reading to print.
 */
function readingIsAHint(fact: FactId, glyph: string): boolean {
  if (factInfo(fact)?.subject !== VOCAB_SUBJECT || !(fact as string).includes("/meaning")) return false;
  return /[一-龯]/.test(glyph);
}

/** The card's hint, from the engine's and the reading a kanji word hides.
 * A grammar card's hint is the kind of word and the form it uses; a card with
 * neither has no hint at all rather than an empty one, so no Hint button is
 * drawn that would open onto nothing. */
function hintFields(hint: ReturnType<typeof hintFor>, reading: string): { hint?: NonNullable<QuizCard["hint"]> } {
  const out: NonNullable<QuizCard["hint"]> = {
    ...(hint?.kind === "image" ? { image: hint.src } : {}),
    ...(hint?.kind === "text" ? { text: hint.text } : {}),
    ...(hint?.kind === "derivation" && (hint.text || hint.form) ? { text: [hint.text, hint.form].filter(Boolean).join(". ") } : {}),
    ...(reading ? { reading } : {}),
  };
  return Object.keys(out).length ? { hint: out } : {};
}

/** The cards for some facts, in order. With `audio`, a card that has a
 * sound to ask by becomes a listening card half the time. */
export function quizCards(history: HistoryFile, facts: readonly FactId[], now = Date.now(), opts: QuizOptions = {}): QuizCard[] {
  const o = offerPicker(history, now);
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
  // One card per QUESTION, not per fact that asks it (SAK-393). 九 carries a
  // meaning fact under each of its two readings, both answered "nine", and
  // once the two reading cards accept each other's readings they are the same
  // question too. A deck that asks the same thing twice teaches nothing the
  // second time and costs a card of the eight it has.
  const asked = new Set<string>();
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
      // and why it was there, for the reveal to name (SAK-315)
      const why = whyOption(fact, f, !!vehicle);
      return { id: f, label, jp: /[぀-ヿ一-龯]/.test(label), ...(why ? { why } : {}) };
    });
    // the answer is always among the options; the engine sees to it, but a
    // card with no board at all would be unanswerable by recognition
    if (!options.some((op) => op.id === fact)) options.unshift({ id: fact, label: revealFor(fact, dir, ctx), jp: /[぀-ヿ一-龯]/.test(revealFor(fact, dir, ctx)) });
    // The vehicle goes to the hint and the instruction too (SAK-427). Both take
    // it and neither was given it, so a grammar card could say only "This is
    // the 〜てはいけない pattern" and "said in the 〜てはいけない form": the
    // pattern twice, and never which kind of word was on the card.
    const hint = hintFor(fact, dir, undefined, false, vehicle ?? undefined);
    const agg = history.facts?.[fact];
    const listen = opts.audio && typed ? listenTextFor(fact, item) : undefined;
    // In a lesson's quiz the sound is a card of its own, dealt after this
    // one, so the written question is always asked (SAK-447). Everywhere
    // else one fact is one card, and the sound replaces the writing on a
    // coin flip.
    const listenIt = listen !== undefined && !opts.everyWay && Math.random() < 0.5 ? listen : undefined;
    // SAK-429: the kana under a known word moves behind the Hint button. A
    // listening card is left alone, since its glyph is off screen and its
    // hint is already the written form. When the card has a hint of its own
    // (the component breakdown), the reading goes first, on its own line.
    const readingHint = !listenIt && prompt.context && !anchored && readingIsAHint(fact, prompt.glyph) ? prompt.context : "";
    // The box types kana for any card whose answer is Japanese, which is
    // every reading but a kana's: asked あ you say "a", and there is no
    // romaji for a meaning. A rolled counting card is read aloud, so it
    // answers in kana too.
    const typedCard = construction ? true : typed;
    // A word read two ways for one sense has one right answer with two
    // spellings (SAK-393): 九 is きゅう and く and both mean nine, so a card
    // that takes only the one it was minted for marks the learner down for
    // knowing the word. The engine has decided which readings count as the
    // same for a long time, in wordReadingCredit; this asks it.
    const alsoRead = dir === "jp2en" && isWordReadingFact(fact) ? interchangeableReadings(fact) : [];
    const answer = construction
      ? construction.reading
      : alsoRead.length > 1 ? alsoRead.join(" · ") : revealFor(fact, dir, ctx);
    const inKana = typedCard && (!!construction || answerIsJapanese(fact, dir));
    const key = alsoRead.length > 1 ? withReadings(answerKeyFor(fact, dir, ctx), alsoRead) : answerKeyFor(fact, dir, ctx);
    const question = questionAsked(entryOf(fact), dir, key);
    if (asked.has(question)) continue;
    asked.add(question);
    const rule = readingRuleFor(fact, item);
    const instruction = listenIt
      ? listenInstruction(fact, item)
      : construction
        ? (construction.kind === "counter" ? "Type how you say this many." : "Type how this number is said.")
        : quizInstruction(fact, dir, typed ? "typed" : "mc", vehicle ?? undefined);
    const card: QuizCard = {
      id: fact,
      item,
      prompt: { glyph: prompt.glyph, jp: prompt.jp, ...(prompt.context && !anchored && !readingHint ? { context: prompt.context } : {}), ...(anchored ? { within: anchored[2] } : {}) },
      ...(instruction ? { instruction } : {}),
      // A hint nudges, it does not answer (SAK-454): a grammar card's hint is
      // the kind of word and the form it uses, and the arithmetic, whose last
      // line is the answer, waits for the reveal as `built`. A kanji word's
      // reading is a field of its own so the hint can say it in a sentence
      // (SAK-453).
      ...hintFields(hint, readingHint),
      ...(hint?.kind === "derivation" ? { built: derivationLines(hint.derivation) } : {}),
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
      // and the rule the card exercises, which is mostly not what a thing
      // means but which of its readings applies here (SAK-316)
      ...(rule ? { rule } : {}),
      // What answers this card, worked out here so the browser can grade
      // without the engine and its tables (SAK-380). It is the key for THIS
      // showing: the rolled count, or the verb the pattern was built on.
      key,
      // the vehicle rides back with the answer, so the recorder knows the
      // verb the pattern was asked on
      meta: {
        dir,
        ...(construction ? { accept: construction.accept.join("|") } : {}),
        ...(vehicle ? { vehicle: vehicle.surface, vehicleKana: vehicle.kana, vehicleCls: vehicle.cls ?? "", vehicleKnown: vehicle.known ? "1" : "" } : {}),
      },
    };
    cards.push(card);
    if (opts.everyWay && listen !== undefined) cards.push(heardTwin(card, listen));
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
  const heardText = spokenCard ? wordReadingAsked(spoken!, spokenCard.item) : undefined;
  if (spokenCard && heardText) cards.splice(cards.indexOf(spokenCard) + 1, 0, heardTwin(spokenCard, heardText));
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
function orderCard(history: HistoryFile, marker: FactId, now = Date.now()): QuizCard | undefined {
  const tierId = (marker as string).replace(/^grammar:sentence-ordering-tier\//, "");
  const entry = (LIB_ENTRIES_BY_KIND.get(SENTENCE_RULE_KIND) ?? []).find((e) => knownFactsOf(e).includes(sentenceTierMarkerFact(tierId)));
  const item = pickAssemblyForTiers(history, [tierId]);
  const pick = entry ? offerPicker(history, now).offerPick(entry.id) : undefined;
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
function pitchCard(history: HistoryFile, keb: string, now = Date.now()): QuizCard | undefined {
  const q = rollPitchQuestion(keb);
  const id = entryForGlyph(VOCAB_SUBJECT, keb);
  if (!q || !id) return undefined;
  const item = offerPicker(history, now).offerPick(id);
  if (!item) return undefined;
  const other = q.mode === "pair" ? q.partnerDownstep : q.wrongDownstep;
  if (other === null) return undefined;
  const correctFirst = Math.random() < 0.5;
  // the wrong clip says what it is: a real homophone partner when the
  // curriculum has one, else the same word said with a pitch it does not take
  const pair: QuizOption[] = [
    { id: "pitch:right", label: q.reading, jp: true, pitch: q.downstep },
    { id: "pitch:other", label: q.reading, jp: true, pitch: other, why: q.mode === "pair" ? "another word said the same way" : "the same reading, said with the other pitch" },
  ];
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
    key: answerKeyFor(pitchFactId(keb), "jp2en"),
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

/** The cards some ids name, in that order: a fact each, a word's pitch card
 * (`word:X/pitch`), or a fact asked by ear (`fact#listen`). What a retry
 * from the results asks, and what a half-finished run comes back to. A
 * lesson's deck holds a card of each kind for one fact now (SAK-447), so an
 * id that ends in `#listen` has to deal the card it named rather than
 * nothing: a resumed lesson quiz came back five cards shorter than it went
 * away, having quietly dropped every card it had asked by ear. */
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
    const heard = /^(.+)#listen$/.exec(id);
    if (heard) {
      const fact = heard[1] as FactId;
      const [written] = quizCards(history, [fact], now);
      const listen = written ? listenTextFor(fact, written.item) : undefined;
      if (written && listen !== undefined) out.push(heardTwin(written, listen));
      continue;
    }
    out.push(...quizCards(history, [id as FactId], now));
  }
  return out;
}

