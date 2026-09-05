// What tonight's lesson teaches, from the app's tables. Server-side and
// dev-only, like the adapters beside it: the items come from the same
// build the Observatory uses (so a pick is the same thing here), and each
// star's card is filled from the app's own teaching data: a kana's
// mnemonic, a kanji's origin and readings, a word's example and pitch.
// Nothing is required; a sparse item stays short.

import { SETS } from "@/data/characters";
import { COUNTER_CURRICULUM, counterEntry, counterForm, counterRoleNote } from "@/data/counters";
import { patternEntry } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";
import { CHUNK_ROLE_LABELS, SENTENCE_ORDERING_GUIDES, type SentenceOrderingTierId } from "@/data/sentence-ordering-guides";
import { contextPronunciation } from "@/data/kana-context";
import { KEIGO_SETS, keigoSetEntry, keigoSetForEntry } from "@/data/keigo";
import { VERB_PAIRS } from "@/data/transitivity";
import { pairEntry, pairForEntry } from "@/data/transitivity-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { TERMS, termEntry } from "@/data/terms";
import { etymologyOf } from "@/data/kanji-etymology";
import { kanjiRow, READINGS } from "@/data/kanji";
import { getMnemonic, type SoundLine } from "@/data/mnemonics";
import { wordPitch } from "@/data/pitch";
import { vocabRow } from "@/data/vocab";
import { exampleFor } from "@/data/word-examples";
import { currentUserId } from "@/lib/auth";
import { emptyHistory } from "@/lib/history-ops";
import { loadHistory } from "@/lib/history";
import { entryForGlyph, knownFactsOf, libEntry, LIB_ENTRIES_BY_KIND, SENTENCE_RULE_KIND } from "@/lib/library/entries";
import { lessonSteps as appLessonSteps } from "@/lib/lesson-steps";
import { lessonsForTier, positionedStepParts, stepPartOrder, type PositionedStepPart, type StepKey, type TierExample } from "@/lib/sentence-rule-walk";
import type { SkyLessonData } from "@/sky/components/sky-lesson";
import { buildGraph } from "@/sky/lib/graph";
import { lessonSteps, type LessonPage, type LessonTeach, type PartedSentence, type TeachPage } from "@/sky/lib/lesson";
import type { SkyItem } from "@/sky/lib/types";
import type { HistoryFile } from "@/types";

import { offerings } from "./observatory";

const spans = (line: SoundLine) => line.map((s) => ({ text: s.text, ...(s.accent ? { accent: true } : {}) }));

/** A kana's romaji, from the character sets. */
function romajiOf(glyph: string): string | undefined {
  for (const set of SETS) for (const s of set.sections) for (const ch of s.chars) if (ch.c === glyph) return ch.r[0];
  return undefined;
}

/** What the card says for one star, from whatever the app knows about it. */
export function teachFor(item: SkyItem): LessonTeach {
  const t: LessonTeach = {};
  const glyph = item.glyph;
  if (item.kind === "kana") {
    t.reading = romajiOf(glyph);
    const m = getMnemonic(glyph);
    if (m) { t.story = spans(m.mnemonic); t.hook = spans(m.analogy); t.mnemonicImage = m.image; t.exampleWord = { word: m.example.word, reading: m.example.reading, gloss: m.example.gloss }; }
    const ctx = contextPronunciation(glyph);
    if (ctx) t.headsUp = { summary: ctx.summary, rules: ctx.rules };
    return t;
  }
  if (item.kind === "radical") {
    const m = getMnemonic(glyph);
    if (m) { t.story = spans(m.mnemonic); t.mnemonicImage = m.image; }
    return t;
  }
  if (item.kind === "kanji") {
    const row = kanjiRow(glyph);
    if (row) { t.meanings = row.meanings; t.strokes = row.strokes; }
    const e = etymologyOf(glyph);
    if (e?.originText) t.etymology = e.originText;
    // on'yomi are written in katakana, kun'yomi in hiragana, the dictionary's own convention
    t.readings = READINGS.filter((r) => r.k === glyph).map((r) => ({ reading: r.base, kind: /[\u30a0-\u30ff]/.test(r.base) ? "on" as const : "kun" as const, words: r.words.slice(0, 4) }));
    return t;
  }
  if (item.kind === "word") {
    const row = vocabRow(glyph);
    if (row) {
      t.reading = row.reb; t.meanings = row.glosses;
      if (row.align?.length) t.writtenWith = row.align.filter(([k]) => kanjiRow(k)).map(([kanji, surface]) => ({ kanji, reading: surface }));
    }
    const ex = exampleFor(glyph);
    if (ex) t.example = { jp: ex.jp, en: ex.en };
    t.pitch = wordPitch(glyph);
    return t;
  }
  if (item.kind === "counter") {
    const form = counterForm(item.id as Parameters<typeof counterForm>[0]);
    if (form) { t.reading = form.reading; t.meanings = [form.meaning]; const note = counterRoleNote(form); if (note) t.notes = [note]; t.pitch = wordPitch(form.glyph); }
    return t;
  }
  if (item.kind === "grammar") {
    const recipe = RECIPES.find((r) => patternEntry(r.id) === item.id);
    if (recipe) { t.reading = recipe.pattern; t.meanings = [recipe.gloss]; t.notes = [recipe.sense, recipe.intro?.blurb].filter((x): x is string => !!x); return t; }
    return t;
  }
  if (item.kind === "sentence") {
    // a sentence rule: the app's walk, page by page
    const tier = (Object.keys(SENTENCE_ORDERING_GUIDES) as SentenceOrderingTierId[]).find((k) => item.id.endsWith(`sentence-rule-${k}`));
    if (tier) t.pages = sentenceRulePages(tier);
    return t;
  }
  if (item.kind === "verbPair") {
    const p = pairForEntry(item.id as Parameters<typeof pairForEntry>[0]);
    if (p) t.notes = [`${p.happens.word} (${p.happens.reading}): ${p.happens.en}`, `${p.doIt.word} (${p.doIt.reading}): ${p.doIt.en}`];
    return t;
  }
  if (item.kind === "keigo") {
    const set = keigoSetForEntry(item.id as Parameters<typeof keigoSetForEntry>[0]);
    if (set) {
      t.meanings = [set.meaning];
      t.notes = set.formulaic
        ? ["This one is different. It isn't the polite version of a verb you already know. It's a fixed phrase: the greeting shop and restaurant staff call out to welcome a customer in, roughly \"welcome, come in!\" You'll hear it, not say it, so learn it by ear."]
        : [
            ...(set.plain.length ? [`Plain: ${set.plain.map((v) => `${v.keb} (${v.reading})`).join(", ")}`] : []),
            ...set.words.map((w) => `${w.word} (${w.reading}): ${w.register}${w.use ? ` · ${w.use}` : ""}`),
          ];
    }
    return t;
  }
  return t;
}

/** The sentence-rule walk as pages: the intro (the guide's paragraphs, its
 * hook and its worked example, plain), then one step per part of the frame,
 * each with the tier's examples three ways and that part marked. The same
 * data and span maths the app's walk renders (src/lib/sentence-rule-walk.ts). */
function sentenceRulePages(tier: SentenceOrderingTierId): TeachPage[] {
  const g = SENTENCE_ORDERING_GUIDES[tier];
  const labels = CHUNK_ROLE_LABELS[tier];
  const order = stepPartOrder(tier);
  /** The sentence as runs: its parts labelled, the active one marked, the rest plain. */
  const runs = (sentence: string, parts: readonly PositionedStepPart[], active: StepKey): PartedSentence => {
    const out: Array<{ text: string; label?: string; active?: boolean }> = [];
    let cursor = 0;
    for (const p of parts) {
      if (p.start > cursor) out.push({ text: sentence.slice(cursor, p.start) });
      out.push({ text: sentence.slice(p.start, p.end), label: labels[p.part] ?? p.part, ...(p.part === active ? { active: true } : {}) });
      cursor = p.end;
    }
    if (cursor < sentence.length) out.push({ text: sentence.slice(cursor) });
    return out;
  };
  const threeWays = (example: TierExample, active: StepKey) => {
    const ordered = example.enOrdered.replaceAll(", ", " → ");
    return {
      natural: runs(example.en, positionedStepParts(example.en, example, order, "en"), active),
      ordered: runs(ordered, positionedStepParts(ordered, example, order, "enOrdered"), active),
      japanese: runs(example.jp, positionedStepParts(example.jp, example, order, "jp"), active),
    };
  };
  const intro: TeachPage = {
    eyebrow: "Intro",
    title: g.title,
    hook: g.hook,
    paragraphs: g.body,
    ...(g.example ? { examples: [{ natural: [{ text: g.example.en }], ordered: [{ text: g.example.enOrdered }], japanese: [{ text: g.example.jp }] }] } : {}),
  };
  return [
    intro,
    ...lessonsForTier(tier).map((l) => ({
      eyebrow: l.step,
      title: l.title,
      hook: g.hook,
      paragraphs: l.details.map((text) => ({ text })),
      examples: l.examples.map(({ example, activePart }) => threeWays(example, activePart)),
    })),
  ];
}

/** One of everything, for a look at every kind of card: a plain kana row,
 * the row with ん (a heads up), a word with a piece and a kanji under it,
 * a glyph that is a piece, a kanji and a word, a counter, a grammar rule,
 * a sentence rule, a verb pair and a keigo set. Built on an empty history,
 * so all of it is new. */
export function showcasePicks(): string[] {
  const word = (keb: string) => entryForGlyph(VOCAB_SUBJECT, keb);
  const sentenceRule = LIB_ENTRIES_BY_KIND.get(SENTENCE_RULE_KIND)?.[0]?.id;
  return [
    "kana-row:h-vowels",
    "kana-row:h-w",
    word("花火"), word("山"),
    counterEntry(COUNTER_CURRICULUM[0]),
    patternEntry("te-sequence"),
    sentenceRule,
    pairEntry(VERB_PAIRS[0]),
    keigoSetEntry(KEIGO_SETS[0]),
  ].filter((id): id is string => !!id);
}

/** The signed-in learner's lesson for these picks, or a visitor's. */
export async function learnerLesson(picks: readonly string[], now = Date.now()): Promise<SkyLessonData> {
  const userId = await currentUserId();
  const history = userId ? await loadHistory(userId) : emptyHistory();
  return lessonFromPicks(history, picks, now);
}

export function lessonFromPicks(history: HistoryFile, picks: readonly string[], now = Date.now()): SkyLessonData {
  const offer = offerings(history, now);
  // every pick is built, whether or not its section had it on its first page
  const known = picks.filter((p) => !!offer.offerPick(p));
  const items = [...offer.items.values()];
  const byId = offer.items;
  const learned = [...offer.learned];
  const graph = buildGraph(items);
  const learnedSet = offer.learned;
  // the card for every star tonight: the steps, the picks, and the known stars under them
  const teach: Record<string, LessonTeach> = {};
  const ids = new Set<string>();
  const stars = lessonSteps(graph, known, learnedSet);
  for (const s of stars) ids.add(s.id);
  for (const p of known) for (const id of graph.orderOf(p)) ids.add(id);
  for (const id of ids) { const it = byId.get(id); if (it && !it.group) teach[id] = teachFor(it); }
  // the pages, per pick: the app's walk branches on what a teach set is
  // (a counter unit, a grammar sitting), so each pick gets its own walk;
  // a page two picks would both open with is read once, at its first use
  const seen = new Set<string>();
  const pages = known
    .flatMap((pick) => pagesFor(stars.filter((s) => s.pick === pick).map((s) => s.id), history))
    .filter((page) => { const key = `${page.kind}:${page.title}`; if (seen.has(key)) return false; seen.add(key); return true; });
  return { items, learned, picks: known, teach, pages };
}

/** The pages the app's own lesson walk puts between these stars (a track's
 * intro, the terms it defines, a sound shift), each attached to the star it
 * comes before. The walk reads history, so an intro already shown is not
 * shown again. */
function pagesFor(starIds: readonly string[], history: HistoryFile): LessonPage[] {
  const facts = starIds.flatMap((id) => { const e = libEntry(id as Parameters<typeof libEntry>[0]); return e ? [...knownFactsOf(e)] : []; });
  const pages: LessonPage[] = [];
  let pending: Omit<LessonPage, "before">[] = [];
  // pages go before the first of OUR stars not yet passed, not before the
  // app's next item: a piece with no facts of its own (艹) is a star here
  // but never an item there, and a page must not land after it
  let cursor = 0;
  for (const step of appLessonSteps(facts, history)) {
    if (step.type === "item") {
      const at = starIds.indexOf(step.item.entry);
      if (at < 0) continue;
      const before = starIds[Math.min(cursor, at)];
      for (const page of pending) pages.push({ ...page, before });
      pending = [];
      cursor = at + 1;
    } else if (step.type === "intro") {
      // named the way the app's own rail names it: a short name, else the eyebrow
      const title = step.intro.name ?? step.intro.eyebrow ?? step.intro.title;
      pending.push({ kind: "Intro", title, lead: title === step.intro.title ? undefined : step.intro.title, body: step.intro.body.map((b) => (b.heading ? `${b.heading}. ` : "") + b.text) });
    } else if (step.type === "term") {
      const term = TERMS.find((t) => termEntry(t.id) === step.entry);
      if (term) pending.push({ kind: "Term", title: term.name, lead: term.summary, body: [...term.body] });
    } else if (step.type === "conversion") {
      pending.push({ kind: "Sound shift", title: `${step.row.from} to ${step.row.to}`, body: [step.row.hook] });
    }
  }
  return pages;
}
