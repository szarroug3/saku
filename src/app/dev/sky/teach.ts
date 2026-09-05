// What tonight's lesson teaches for one star, from the app's tables.
// Server-side and dev-only, like the adapters beside it: each star's card
// is filled from the app's own teaching data (a kana's mnemonic, a kanji's
// origin and readings, a word's example and pitch, a sentence rule's walk,
// a grammar pattern's pages) converted into the Sky's teaching shape
// (src/sky/lib/lesson.ts). Nothing is required; a sparse item stays short.

import { SETS } from "@/data/characters";
import { GRAMMAR_CONCEPTS, grammarConceptEntry, type GrammarConcept } from "@/data/grammar-concepts";
import { bodyFor, markFor, MARKS, type Mark } from "@/data/marks";
import { hookRuns } from "@/data/dakuten-rows";
import { radicalTipFor } from "@/data/radical-tips";
import { radicalVariants } from "@/data/radicals";
import { wordContrastNoteFor } from "@/data/word-contrast-notes";
import { builtPieces } from "@/data/kanji-etymology";
import { teachablePieceMeaning } from "@/lib/kanji-parts";
import { usedAsPartIn } from "@/lib/library/components";
import { derivePosition } from "@/lib/library/character-entry-content";
import { formsOfWord } from "@/lib/word-forms";
import { COUNTER_CURRICULUM, counterForm, counterRoleNote } from "@/data/counters";
import { TSU_INTRO } from "@/data/track-intros";
import { patternEntry } from "@/data/grammar";
import { autoPatternPage } from "@/data/grammar/auto-page";
import { cluster as clusterById, membersOf } from "@/data/grammar/clusters";
import { formLibraryPages } from "@/data/grammar/lessons";
import { RECIPES, type Recipe } from "@/data/grammar/recipes";
import type { CountBuildPiece, IntroBuildRule, IntroCountGroup, IntroDeriveRow, IntroPara, PhaseIntro } from "@/data/phase-intros";
import { buildRow } from "@/lib/grammar/build";
import { CHUNK_ROLE_LABELS, SENTENCE_ORDERING_GUIDES, type SentenceOrderingTierId } from "@/data/sentence-ordering-guides";
import { contextPronunciation } from "@/data/kana-context";
import { keigoSetForEntry } from "@/data/keigo";
import { pairForEntry } from "@/data/transitivity-facts";
import { etymologyOf } from "@/data/kanji-etymology";
import { kanjiRow, READINGS } from "@/data/kanji";
import { getMnemonic, type SoundLine } from "@/data/mnemonics";
import { numberConstructionFor } from "@/data/number-construction";
import { wordPitch } from "@/data/pitch";
import { TERMS, termEntry } from "@/data/terms";
import { vocabRow } from "@/data/vocab";
import { exampleFor } from "@/data/word-examples";
import { lessonsForTier, positionedStepParts, stepPartOrder, type PositionedStepPart, type StepKey, type TierExample } from "@/lib/sentence-rule-walk";
import { TSU_RULE } from "./observatory";
import { type LessonTeach, type PartedSentence, type SoundLine as SkySoundLine, type TeachForm, type TeachPage, type TeachParagraph, type TeachTable } from "@/sky/lib/lesson";
import type { SkyItem } from "@/sky/lib/types";

import type { EntryId } from "@/types";

const spans = (line: SoundLine) => line.map((s) => ({ text: s.text, ...(s.accent ? { accent: true } : {}) }));

/** The keigo registers, in the learner's terms, as the app's keigo page has them. */
const REGISTER: Record<string, { label: string; desc: string }> = {
  honorific: { label: "Honorific", desc: "Use this form to raise another person when they take an action." },
  humble: { label: "Humble", desc: "Use this form to lower yourself when you take an action." },
};

/** A sentence with one span marked, as the Sky's runs. */
function marked(jp: string, span: readonly [number, number]): PartedSentence {
  const [a, b] = span;
  return [{ text: jp.slice(0, a) }, { text: jp.slice(a, b), label: "The verb", active: true }, { text: jp.slice(b) }].filter((r) => r.text);
}

/** A kana's romaji, from the character sets. */
/** Where a radical's variant sits in a kanji, in a word: "Left", "Top". */
const POSITION: Record<string, string> = { kanmuri: "Top", hen: "Left", tsukuri: "Right", ashi: "Bottom", nyou: "Bottom left", kamae: "Around", tare: "Top and left" };
function positionOf(v: { position?: { romaji: string; kana: string }; name: { kana: string } }): string {
  if (v.position) return POSITION[v.position.romaji] ?? v.position.kana;
  return derivePosition(v.name.kana).en;
}

/** A hook with its letters in brackets ("The [k]arate [k]ick"), as runs
 * with those letters coloured instead (Sam, 2026-09-05). */
function hookLine(hook: string): SkySoundLine {
  return hookRuns(hook).map((r) => ({ text: r.text, accent: r.hit }));
}

/** The writing rule (dakuten, yōon…) or the grammar concept (keigo) a term
 * shares its name with: the page that carries the fuller teaching. */
export function markTwin(name: string): Mark | undefined {
  return MARKS.find((m) => m.shelf === "writing" && m.name.toLowerCase() === name.toLowerCase());
}
export function conceptTwin(name: string): GrammarConcept | undefined {
  return GRAMMAR_CONCEPTS.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

/** A writing rule, read as one page (Sam, 2026-09-05): the lesson's
 * explanation once (the hiragana card; the katakana copy says the same
 * with other glyphs), then the conversion tables for both scripts side by
 * side, then the aside. Okurigana's three cards are three pages. */
function markPages(mark: Mark): TeachPage[] {
  const hasHiragana = mark.intros.some((i) => i.setId === "hiragana");
  const intros = mark.intros.filter((i) => !(hasHiragana && i.setId === "katakana"));
  const pages = intros.map((intro) => ({ ...pageFromIntro(intro, mark.glyph), eyebrow: mark.name }));
  if (!pages.length) pages.push({ eyebrow: mark.name, title: mark.name, paragraphs: [] });
  const tables: TeachTable[] = [];
  for (const conv of [...new Set(mark.rows.map((r) => r.conv))]) {
    const rows = mark.rows.filter((r) => r.conv === conv);
    const first = rows[0];
    const hiragana = rows.find((r) => r.setId === "hiragana")?.pairs ?? [];
    const katakana = rows.find((r) => r.setId === "katakana")?.pairs ?? [];
    const notes = rows.flatMap((r) => [r.callout, r.aside]).filter((x): x is string => !!x);
    tables.push({
      title: `${first.from} to ${first.to}`,
      ...(first.hook ? { instruction: hookLine(first.hook) } : {}),
      heads: [...(hiragana.length ? ["Hiragana"] : []), ...(katakana.length ? ["Katakana"] : [])],
      rows: Array.from({ length: Math.max(hiragana.length, katakana.length) }, (_, i) => [hiragana[i], katakana[i]].filter((x): x is [string, string] => !!x).map(([base, converted]) => [{ text: `${said(base)} → ` }, { text: said(converted), accent: true }])),
      ...(notes.length ? { note: [...new Set(notes)].join(" ") } : {}),
    });
  }
  // the yōon read like dakuten: every one, with how it is said (Sam, 2026-09-05)
  if (mark.id === "small-ya") tables.push(yoonTable());
  const last = pages[pages.length - 1];
  pages[pages.length - 1] = { ...last, ...(tables.length ? { tables: [...(last.tables ?? []), ...tables] } : {}), ...(mark.note ? { after: [...(last.after ?? []), { text: mark.note }] } : {}) };
  return pages;
}

/** "か (ka)": a kana with its reading. */
function said(kana: string): string {
  const r = romajiOf(kana);
  return r ? `${kana} (${r})` : kana;
}

/** Every yōon, hiragana beside katakana: き + ゃ → きゃ (kya). */
function yoonTable(): TeachTable {
  const rowsOf = (setId: string) => SETS.find((set) => set.id === setId)?.sections.filter((sec) => sec.label.startsWith("Yōon")) ?? [];
  const h = rowsOf("hiragana");
  const k = rowsOf("katakana");
  const cell = (c: string, r: string): SkySoundLine => [{ text: `${[...c][0]} + ${[...c][1]} → ` }, { text: `${c} (${r})`, accent: true }];
  const rows: SkySoundLine[][] = [];
  h.forEach((sec, i) => sec.chars.forEach((ch, j) => {
    const kc = k[i]?.chars[j];
    rows.push([cell(ch.c, ch.r[0]), ...(kc ? [cell(kc.c, kc.r[0])] : [])]);
  }));
  return { title: "Every yōon", heads: ["Hiragana", "Katakana"], rows };
}

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
    // how to spot it inside a kanji, and the shapes it takes there (the
    // app's "As a radical" block)
    const tip = radicalTipFor(glyph);
    if (tip) t.notes = [tip];
    const variants = radicalVariants(glyph).map((v) => ({ glyph: v.glyph, position: positionOf(v), example: usedAsPartIn(v.glyph)[0] }));
    if (variants.length) t.variants = variants.map((v) => ({ glyph: v.glyph, position: v.position, ...(v.example ? { example: v.example } : {}) }));
    return t;
  }
  if (item.kind === "kanji") {
    const row = kanjiRow(glyph);
    if (row) { t.meanings = row.meanings; t.strokes = row.strokes; }
    const e = etymologyOf(glyph);
    if (e?.originText) t.etymology = e.originText;
    // on'yomi are written in katakana, kun'yomi in hiragana, the dictionary's own convention
    t.readings = READINGS.filter((r) => r.k === glyph).map((r) => ({ reading: r.base, kind: /[\u30a0-\u30ff]/.test(r.base) ? "on" as const : "kun" as const, words: r.words.slice(0, 4) }));
    // what each piece does in it, the app's "Built from" labels: a phonetic
    // piece lends its sound, a semantic one its sense (or its own meaning)
    const parts = builtPieces(glyph).map((p) => ({
      glyph: p.glyph,
      role: p.role,
      sense: p.role === "phonetic" ? (p.label ? `lends ${p.label}` : "lends its sound") : (p.label ?? teachablePieceMeaning(p.glyph) ?? ""),
    }));
    if (parts.length) t.parts = parts;
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
    // how it differs from the word it is weighed against, and every form
    // it takes, grouped as the app's word page groups them
    const contrast = wordContrastNoteFor(glyph);
    if (contrast) t.notes = [contrast];
    const groups = row ? formsOfWord(row) : null;
    if (groups) t.tables = groups.map((g) => ({ title: g.title, heads: ["Form", "Written"], rows: g.rows.map((r) => [[{ text: r.label }], [{ text: r.value }]]) }));
    return t;
  }
  if (item.kind === "counter") {
    // a counted form: how you say it; a counting rule: how it is built, the
    // app's own rule card with its worked tables (Sam, 2026-09-05: the
    // counting rules had rich content)
    if (item.id === TSU_RULE) {
      // the native numbers as one rule: the track's own pitch, then the ten
      const forms = COUNTER_CURRICULUM.filter((f) => f.counter === "つ");
      t.meanings = ["The native way to count things, one to ten, for anything without a counter of its own."];
      t.pages = [{ ...pageFromIntro(TSU_INTRO), eyebrow: "〜つ", tables: [{ title: "One to ten", heads: ["Count", "Written", "Meaning"], rows: forms.map((f, i) => [[{ text: String(i + 1) }], [{ text: f.glyph, accent: true }], [{ text: f.meaning }]]) }] }];
      return t;
    }
    const form = counterForm(item.id as Parameters<typeof counterForm>[0]);
    if (form) { t.reading = form.reading; t.meanings = [form.meaning]; const note = counterRoleNote(form); if (note) t.notes = [note]; t.pitch = wordPitch(form.glyph); }
    const construction = numberConstructionFor(item.id as EntryId);
    if (construction) {
      t.meanings = [construction.summary];
      t.pages = [pageFromIntro({ id: `construction-${construction.id}`, setId: "", title: construction.name, name: "How it's built", body: [...construction.body], countTables: construction.exampleGroups })];
    }
    return t;
  }
  if (item.kind === "grammar") {
    // a pattern: the app's own teaching pages (the build, its tables, the
    // sentence) and its family, page by page, the way the app's grammar page
    // shows them (Sam's call, 2026-09-05: keep that richness)
    const recipe = RECIPES.find((r) => patternEntry(r.id) === item.id);
    if (recipe) { t.reading = recipe.pattern; t.meanings = [recipe.gloss]; if (recipe.sense) t.notes = [recipe.sense]; t.pages = grammarPages(recipe); return t; }
    return t;
  }
  if (item.kind === "sentence") {
    // a sentence rule: the app's walk, page by page
    const tier = (Object.keys(SENTENCE_ORDERING_GUIDES) as SentenceOrderingTierId[]).find((k) => item.id.endsWith(`sentence-rule-${k}`));
    if (tier) t.pages = sentenceRulePages(tier);
    return t;
  }
  if (item.kind === "verbPair") {
    // the two verbs by their role, the way the app's pair page shows them
    const p = pairForEntry(item.id as Parameters<typeof pairForEntry>[0]);
    if (p) {
      const side = (m: typeof p.happens, role: string, note: string): TeachForm => ({
        role, note, word: m.word, reading: m.reading, pitch: wordPitch(m.word), sentence: m.en,
        ...(m.example ? { example: marked(m.example.jp, m.example.highlightSpan) } : {}),
      });
      t.forms = [
        side(p.happens, "It happens on its own", "No one is named as making it happen; it just happens."),
        side(p.doIt, "Someone does it", "Someone makes it happen."),
      ];
    }
    return t;
  }
  if (item.kind === "term") {
    // a term is its definition, then whatever the same name teaches
    // elsewhere (Sam, 2026-09-05: the writing rules and the grammar
    // concepts are terms): the mark's page for Dakuten, the concept's
    // cards for Keigo, else the term's own cards
    const term = TERMS.find((x) => termEntry(x.id) === item.id);
    if (term) {
      t.meanings = [term.summary];
      const mark = markTwin(term.name);
      const concept = conceptTwin(term.name);
      if (mark) t.pages = markPages(mark);
      else if (concept?.cards.length) t.pages = concept.cards.map((c) => pageFromIntro(c));
      else if (term.cards?.length) t.pages = term.cards.map((c) => pageFromIntro(c, term.cardMark));
      // the definition, unless a fuller page says the same thing
      if (!mark && !concept) t.notes = [...term.body];
    }
    return t;
  }
  if (item.kind === "mark") {
    const mark = markFor(item.id as EntryId);
    if (mark) { t.meanings = [mark.summary]; t.pages = markPages(mark); }
    return t;
  }
  if (item.kind === "concept") {
    // a grammar concept: its cards, the lesson's own; the short answer
    // stands alone only when there are no cards, as on the app's page
    const concept = GRAMMAR_CONCEPTS.find((c) => grammarConceptEntry(c.id) === item.id);
    if (concept) {
      t.meanings = [concept.summary];
      if (concept.cards.length) t.pages = concept.cards.map((c) => pageFromIntro(c));
      else t.notes = [...concept.body];
    }
    return t;
  }
  if (item.kind === "keigo") {
    const set = keigoSetForEntry(item.id as Parameters<typeof keigoSetForEntry>[0]);
    if (set) {
      t.meanings = [set.meaning];
      if (set.formulaic) {
        t.notes = ["This one is different. It isn't the polite version of a verb you already know. It's a fixed phrase: the greeting shop and restaurant staff call out to welcome a customer in, roughly \"welcome, come in!\" You'll hear it, not say it, so learn it by ear."];
        t.forms = set.words.map((w) => ({ role: "The phrase", word: w.word, reading: w.reading }));
      } else {
        // the plain verb, then each polite form by its register with when to
        // use it, the way the app's keigo page reads; these are new words,
        // not a politer spelling of the plain one
        t.notes = ["Keigo doesn't change the everyday word. These are entirely new words."];
        t.forms = [
          ...set.plain.map((v) => ({ role: "Plain", note: "The everyday verb these replace.", word: v.keb, reading: v.reading, pitch: wordPitch(v.keb) })),
          ...set.words.map((w) => ({ role: `${REGISTER[w.register]?.label ?? w.register}${w.use ? ` · ${w.use}` : ""}`, note: REGISTER[w.register]?.desc, word: w.word, reading: w.reading })),
        ];
      }
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

/** A grammar pattern's pages: the app's own teaching (a form's authored
 * Library pages, or the generated pattern page: the meaning, the build
 * formula, the conjugation or derivation tables, the sentence), then its
 * family side by side when it has one. Converted from the app's PhaseIntro
 * shape into the Sky's, so the two show the same build by construction. */
function grammarPages(recipe: Recipe): TeachPage[] {
  const intros = formLibraryPages(recipe.id);
  const pages = (intros.length ? intros : [autoPatternPage(recipe)]).map((intro) => pageFromIntro(intro));
  const family = recipe.cluster ? clusterById(recipe.cluster) : undefined;
  const members = family ? membersOf(family) : [];
  if (family && members.length > 1) {
    const rows = members.map((m) => {
      const built = buildRow(m)?.built ?? "";
      const me = m.id === recipe.id;
      const pattern = m.sense ? `${m.pattern} ${m.sense}` : m.pattern;
      return [[{ text: pattern, ...(me ? { accent: true } : {}) }], [{ text: m.gloss }], [{ text: built }]] as const;
    });
    pages.push({
      eyebrow: "Family",
      title: "Ways to say this",
      paragraphs: [{ text: "Japanese often has more than one pattern for the same idea. These are its near neighbours, and how each is built." }],
      tables: [{ heads: ["Pattern", "Meaning", "Built"], rows, ...(family.feel ? { note: family.feel } : {}) }],
      ...(family.link ? { link: { href: family.link.url, label: family.link.label } } : {}),
    });
  }
  return pages;
}

const text = (s: string, accent = false): SkySoundLine[number] => (accent ? { text: s, accent: true } : { text: s });

/** A build rule as a row: ending · verb · change · result, with the added
 * piece in the accent, plus a meaning and a note when any row has them. */
function ruleRow(r: IntroBuildRule, cols: RuleColumns): SkySoundLine[] {
  const change: SkySoundLine = r.to ? [] : [...(r.drop ? [text(`− ${r.drop}`)] : []), ...(r.add ? [text(r.drop ? " + " : "+ "), text(r.add, true)] : [])];
  let result: SkySoundLine;
  if (r.to) {
    const at = r.accent === false ? -1 : typeof r.accent === "string" ? r.to.indexOf(r.accent) : -1;
    result = at >= 0 && typeof r.accent === "string" ? [text(r.to.slice(0, at)), text(r.accent, true), text(r.to.slice(at + r.accent.length))] : [text(r.to, r.accent !== false)];
  } else {
    const stem = r.verb && r.drop && r.verb.endsWith(r.drop) ? r.verb.slice(0, r.verb.length - r.drop.length) : (r.verb ?? "");
    result = [text(stem), ...(r.add ? [text(r.add, true)] : [])];
  }
  return [
    ...(cols.ending ? [[text(r.label ?? r.drop ?? "")]] : []),
    [text(r.verb ?? "")],
    ...(cols.change ? [change] : []),
    result,
    ...(cols.gloss ? [[text(r.gloss ?? "")]] : []),
    ...(cols.note ? [[text(r.note ?? "")]] : []),
  ];
}

/** Which columns a rule table needs: the ending only when a row names one
 * (its label, or the kana it drops); the change only when a row is built
 * by a rule rather than given whole; meaning and note when any row has one.
 * So a list of memorised forms (たべる → たべて) is verb, result, meaning. */
interface RuleColumns { ending: boolean; change: boolean; gloss: boolean; note: boolean }

function ruleTable(rules: readonly IntroBuildRule[], heads?: { label?: string; change?: string; note?: string; gloss?: string }, title?: string, extra: Partial<TeachTable> = {}): TeachTable {
  const cols: RuleColumns = {
    ending: rules.some((r) => r.label || r.drop),
    change: rules.some((r) => !r.to && (r.drop || r.add)),
    gloss: rules.some((r) => r.gloss),
    note: rules.some((r) => r.note),
  };
  const head = [
    ...(cols.ending ? [heads?.label ?? "Ending"] : []),
    "Verb",
    ...(cols.change ? [heads?.change ?? "Change"] : []),
    "Result",
    ...(cols.gloss ? [heads?.gloss ?? "Meaning"] : []),
    ...(cols.note ? [heads?.note ?? "Note"] : []),
  ];
  return { ...(title ? { title } : {}), heads: head, rows: rules.map((r) => ruleRow(r, cols)), ...extra };
}

/** A derivation as a row: verb · form · pattern · meaning, the pattern's
 * added piece in the accent when it can be told from the form. */
function deriveTable(rules: readonly IntroDeriveRow[], heads?: { verb?: string; form?: string; pattern?: string }, title?: string, extra: Partial<TeachTable> = {}): TeachTable {
  const form = rules.some((r) => r.form), gloss = rules.some((r) => r.gloss), cls = rules.some((r) => r.classLabel);
  const rows = rules.map((r) => {
    const base = r.form ?? r.verb;
    const result: SkySoundLine = r.result.startsWith(base) ? [text(base), text(r.result.slice(base.length), true)] : [text(r.result)];
    return [[text(r.verb)], ...(form ? [[text(r.form ?? "")]] : []), result, ...(gloss ? [[text(r.gloss ?? "")]] : []), ...(cls ? [[text(r.classLabel ?? "")]] : [])];
  });
  return { ...(title ? { title } : {}), heads: [heads?.verb ?? "Verb", ...(form ? [heads?.form ?? "Form"] : []), heads?.pattern ?? "Pattern", ...(gloss ? ["Meaning"] : []), ...(cls ? ["Class"] : [])], rows, ...extra };
}

export /** A count table: each row a count, its word and reading, and the pieces it
 * is built from with the result. */
function countTable(g: IntroCountGroup): TeachTable {
  const piece = (p: CountBuildPiece, accent = false): SkySoundLine => [text(p.kana, accent), ...(p.value ? [text(` (${p.value})`)] : [])];
  return {
    title: g.title,
    heads: [g.counter ? "Count" : "Number", "Written", "Reading", "Built from"],
    rows: g.examples.map((r) => [
      [text(r.label)],
      [text(r.word)],
      [text(r.reading), ...(r.alternateReadings?.length ? [text(` · ${r.alternateReadings.join(" · ")}`)] : [])],
      [...r.build.flatMap((p, i) => (i === 0 ? piece(p) : [text(` ${p.op ?? "+"} `), ...piece(p)])), text(" → "), ...piece(r.result, true)],
    ]),
  };
}

export const paragraphs = (body: readonly IntroPara[] | undefined): TeachParagraph[] =>
  (body ?? []).filter((p) => p.text.trim().length > 0).map((p) => ({ ...(p.heading ? { heading: p.heading } : {}), ...(p.lead ? { lead: p.lead } : {}), text: p.text, ...(p.accent ? { accent: p.accent } : {}) }));

/** One of the app's teaching pages in the Sky's shape. */
function pageFromIntro(intro: PhaseIntro, mark?: string): TeachPage {
  const tables: TeachTable[] = [];
  // a punctuation catalogue: the marks, their names and their English jobs
  if (intro.punctuation?.length) tables.push({ title: "The marks", heads: ["Mark", "Name", "Does the job of", "Note"], rows: intro.punctuation.map((r) => [[{ text: r.mark }], [{ text: r.name }], [{ text: r.english }], [{ text: r.note }]]) });
  for (const section of intro.buildSections ?? []) {
    const title = section.hideTitle ? undefined : section.title;
    const instruction = section.body.map((p) => p.text).join(" ");
    const footer = section.footer ? `${section.footer.chain} · ${section.footer.gloss}` : undefined;
    const extra = { ...(instruction ? { instruction } : {}), ...(section.formula ? { formula: section.formula } : {}), ...(footer ? { footer } : {}) };
    if (section.rules?.length) tables.push(ruleTable(section.rules, section.heads, title, extra));
    for (const t of section.tables ?? []) tables.push(ruleTable(t.rules, t.heads, title ? `${title} · ${t.title}` : t.title, tables.length === 0 ? extra : {}));
    if (!section.rules?.length && !section.tables?.length && (instruction || section.formula)) tables.push({ ...(title ? { title } : {}), ...extra, heads: [], rows: [] });
  }
  if (intro.buildRules?.length) tables.push(ruleTable(intro.buildRules, intro.buildHeads));
  for (const t of intro.buildTables ?? []) tables.push(ruleTable(t.rules, t.heads, t.title));
  if (intro.deriveRules?.length) tables.push(deriveTable(intro.deriveRules, intro.deriveHeads));
  for (const t of intro.deriveTables ?? []) tables.push(deriveTable(t.rules, t.heads, t.title, { ...(t.instruction ? { instruction: t.instruction } : {}), ...(t.formula ? { formula: t.formula } : {}) }));
  if (intro.buildFooter && tables.length) tables[tables.length - 1] = { ...tables[tables.length - 1], footer: `${intro.buildFooter.chain} · ${intro.buildFooter.gloss}` };
  for (const g of intro.countTables ?? []) tables.push(countTable(g));
  // the card's worked examples: きて → きって (kite → kitte), 時 + 時 = 時々 (ときどき) sometimes
  if (intro.examples?.length && mark !== "ゃゅょ") {
    const anyReading = intro.examples.some((e) => e.reading);
    const anyGloss = intro.examples.some((e) => e.gloss);
    tables.push({
      title: "Examples",
      heads: ["Written", ...(anyReading ? ["Said"] : []), ...(anyGloss ? ["Meaning"] : [])],
      rows: intro.examples.map((e) => [[{ text: `${e.from} ${e.op ?? "="} ` }, { text: e.to, accent: true }], ...(anyReading ? [[{ text: e.reading ?? "" }]] : []), ...(anyGloss ? [[{ text: e.gloss ?? "" }]] : [])]),
    });
  }
  const ex = intro.sentenceExample;
  const examples = ex ? [{ natural: [{ text: ex.en }], japanese: [{ text: ex.jp.slice(0, ex.span[0]) }, { text: ex.jp.slice(ex.span[0], ex.span[1]), label: "Pattern", active: true }, { text: ex.jp.slice(ex.span[1]) }].filter((r) => r.text) }] : undefined;
  return {
    // the page's own name on the pager pill (〜ので, "The て/で-form"); the
    // app's eyebrow is the same "Grammar" on every generated page
    eyebrow: intro.name ?? (intro.eyebrow && intro.eyebrow !== "Grammar" ? intro.eyebrow : intro.title.replace(/[.。]$/, "")),
    title: intro.title,
    // a mark's card keeps only the paragraphs about that mark (see bodyFor)
    paragraphs: paragraphs(mark === undefined ? intro.body : bodyFor(intro, mark)),
    ...(intro.buildFormula ? { formula: intro.buildFormula } : {}),
    ...(tables.length ? { tables } : {}),
    ...(intro.bodyAfterBuild?.length ? { after: paragraphs(intro.bodyAfterBuild) } : {}),
    ...(examples ? { examples } : {}),
  };
}
