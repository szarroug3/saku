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
import { derivePosition } from "@/lib/radical-position";
import { formsOfWord, wordFormKind } from "@/lib/word-forms";
import { COUNTER_CURRICULUM, counterForm, counterRoleNote } from "@/data/counters";
import { TSU_INTRO } from "@/data/track-intros";
import { patternEntry } from "@/data/grammar";
import { autoPatternPage } from "@/data/grammar/auto-page";
import { cluster as clusterById, membersOf } from "@/data/grammar/clusters";
import { formLibraryPages } from "@/data/grammar/lessons";
import { kanjiRuns, PARTICLE_NOTES, type ParticleNoteExample, type ParticleNotePara } from "@/data/grammar/particle-notes";
import { PARTICLE_ROWS } from "@/data/grammar/particles";
import { primaryPatternRecipe, RECIPES, type Recipe } from "@/data/grammar/recipes";
import { PARTICLE_RULE, type BuildHeads, type CountBuildPiece, type IntroBuildRule, type IntroCountGroup, type IntroDeriveRow, type IntroPara, type PhaseIntro } from "@/data/phase-intros";
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
import { readingUnits, vocabRow } from "@/data/vocab";
import { exampleFor } from "@/data/word-examples";
import { lessonsForTier, positionedStepParts, stepPartOrder, type PositionedStepPart, type StepKey, type TierExample } from "@/lib/sentence-rule-walk";
import { libEntry } from "@/lib/library/entries";
import { standingFor } from "./learner";
import { TSU_RULE } from "./observatory";
import { type LessonTeach, type PartedSentence, type SoundLine as SkySoundLine, type TeachForm, type TeachPage, type TeachParagraph, type TeachTable } from "@/sky/lib/lesson";
import type { SkyItem } from "@/sky/lib/types";

import type { EntryId } from "@/types/facts";
import type { HistoryFile } from "@/types/store";

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
 * with those letters colored instead (Sam, 2026-09-05). */
function hookLine(hook: string): SkySoundLine {
  return hookRuns(hook).map((r) => ({ text: r.text, accent: r.hit }));
}

/** The writing rule (dakuten, yōon…) or the grammar concept (keigo) a term
 * shares its name with: the page that carries the fuller teaching. */
function markTwin(name: string): Mark | undefined {
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
/** What a lesson narrows the card to: the one reading being taught, and the
 * grammar the learner can read, which a sentence type's page shows its
 * examples from (SAK-468). No `readable` set is every example, which is what
 * a card with no learner behind it shows. */
interface TeachScope {
  reading?: string;
  readable?: ReadonlySet<string>;
}

/**
 * The grammar a learner can read, by recipe id: every pattern they have
 * learned or claimed, plus the ones they have picked for tonight, which count
 * the same here as everywhere else in the Sky (SAK-464's rule for a tile,
 * SAK-468's for an example sentence).
 *
 * Worked out once per request and handed to `teachFor`, not once per card:
 * it walks the whole pattern table, and only a sentence type's page reads it.
 */
export function readablePatterns(history: HistoryFile, picks: readonly string[] = [], now = Date.now()): ReadonlySet<string> {
  const picked = new Set(picks);
  const out = new Set<string>();
  for (const recipe of RECIPES) {
    const entry = libEntry(patternEntry(recipe.id));
    if (!entry) continue;
    if (picked.has(entry.id) || standingFor(entry, history, now).met) out.add(recipe.id);
  }
  return out;
}

export function teachFor(item: SkyItem, scope: TeachScope = {}): LessonTeach {
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
    // piece gives its sound, a semantic one its sense (or its own meaning)
    const parts = builtPieces(glyph).map((p) => ({
      glyph: p.glyph,
      role: p.role,
      sense: p.role === "phonetic" ? (p.label ? `gives ${p.label}` : "gives its sound") : (p.label ?? teachablePieceMeaning(p.glyph) ?? ""),
    }));
    if (parts.length) t.parts = parts;
    return t;
  }
  if (item.kind === "word") {
    const row = vocabRow(glyph);
    if (row) {
      // every way it is read, each with what it means read that way; a
      // lesson keeps only the reading it is teaching (the head shows that
      // one), the Atlas shows them all
      const units = readingUnits(row);
      const shown = scope.reading ? units.filter((u) => u.reb === scope.reading) : units;
      const head = shown[0] ?? { reb: row.reb, glosses: row.glosses };
      t.reading = head.reb; t.meanings = head.glosses;
      if (shown.length) t.pronunciations = shown.map((u) => ({ reading: u.reb, glosses: u.glosses, pitch: u.reb === row.reb ? wordPitch(glyph) : null }));
      if (row.align?.length) t.writtenWith = row.align.filter(([k]) => kanjiRow(k)).map(([kanji, surface]) => ({ kanji, reading: surface }));
      // which group it conjugates in, and where to read about that group.
      // Neither concept has a term of the same name, so the concept entry is
      // the page (`readAbout` in atlas.ts is that rule, for the ones that do).
      const kind = wordFormKind(row);
      if (kind) t.wordKind = { label: kind, readAbout: grammarConceptEntry(kind.endsWith("adjective") ? "adjective-types" : "verb-classes") };
    }
    // the span comes across with the sentence (SAK-443): the payload used to
    // drop it, so the card had no way to underline the word it is showing the
    // learner and printed the sentence plain
    const ex = exampleFor(glyph);
    if (ex) t.example = { jp: ex.jp, en: ex.en, ...(ex.span ? { span: ex.span } : {}) };
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
      // the card's head already says what it is: the page is the pitch and the table, no title
      t.pages = [{ ...pageFromIntro(TSU_INTRO), eyebrow: undefined, title: "", tables: [{ title: "One to ten", heads: ["Count", "Written", "Meaning"], rows: forms.map((f, i) => [[{ text: String(i + 1) }], [{ text: f.glyph, accent: true }], [{ text: f.meaning }]]), note: "Ten is the exception: とお has no つ on the end. The other nine all end in つ." }] }];
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
    if (recipe) { t.reading = recipe.pattern; t.meanings = [recipe.gloss]; if (recipe.sense) t.notes = [recipe.sense]; t.pages = withoutRepeatedTitle(grammarPages(recipe), recipe.pattern, recipe.gloss); return t; }
    return t;
  }
  if (item.kind === "sentence") {
    // a sentence rule: the app's walk, page by page
    const tier = (Object.keys(SENTENCE_ORDERING_GUIDES) as SentenceOrderingTierId[]).find((k) => item.id.endsWith(`sentence-rule-${k}`));
    if (tier) t.pages = sentenceRulePages(tier, scope.readable);
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
        side(p.happens, "It happens on its own", "No one is named as making it happen."),
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
      // Particle is the one term the app can answer in full from its own
      // tables, so it does (SAK-466): every particle it teaches, listed.
      else if (term.id === PARTICLE_TERM) t.pages = [particleListPage()];
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
        t.notes = ["This is not the polite version of a verb you already know. It's a fixed phrase: the greeting shop and restaurant staff call out to welcome a customer in, roughly \"welcome, come in!\" You will hear it far more often than you say it, so learn it by ear."];
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
/**
 * A sentence type's walk: the intro, then a page per step, each showing the
 * examples the learner can read (`readable`, the patterns they have learned,
 * claimed or picked for tonight).
 *
 * The page says nothing about an example it is holding back, which is Sam's
 * rule from SAK-464 for anything a learner cannot take yet. The intro's own
 * headline sentence stays whatever the guide wrote: it is what that page's
 * paragraphs are about, not one of a list.
 */
function sentenceRulePages(tier: SentenceOrderingTierId, readable?: ReadonlySet<string>): TeachPage[] {
  const g = SENTENCE_ORDERING_GUIDES[tier];
  const labels = CHUNK_ROLE_LABELS[tier];
  const order = stepPartOrder(tier);
  /** The sentence as runs: its parts labeled, the active one marked, the rest plain. */
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
    ...lessonsForTier(tier, readable).map((l) => ({
      eyebrow: l.step,
      title: l.title,
      hook: g.hook,
      paragraphs: l.details.map((text) => ({ text })),
      examples: l.examples.map(({ example, activePart }) => threeWays(example, activePart)),
    })),
  ];
}

/** The letters of a line, for comparing two of them: case, spacing and the
 * full stop a heading adds are not a difference. */
const bareWords = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * A pattern page whose heading only says again what the card says above it,
 * with that heading dropped (SAK-464).
 *
 * The generated pattern page leads with "〜は: Marks the topic.", which is
 * the pattern (the card's own glyph, in the size a card leads with) and its
 * meaning (the line right under it) and nothing else, so 〜は told the
 * learner "marks the topic" twice. Sam, 2026-09-17: drop the repeat.
 *
 * Only a heading that adds nothing goes. A pattern whose heading says more
 * than its meaning line keeps it, and so does every authored page, whose
 * heading is its own ("The て/で-form", "Ways to say this").
 */
function withoutRepeatedTitle(pages: TeachPage[], pattern: string, meaning: string): TeachPage[] {
  return pages.map((page) => {
    const at = page.title.indexOf(": ");
    if (at < 0 || page.title.slice(0, at) !== pattern) return page;
    const rest = bareWords(page.title.slice(at + 2)), said = bareWords(meaning);
    return rest && said && (rest.includes(said) || said.includes(rest)) ? { ...page, title: "" } : page;
  });
}

/** The term whose page is the whole list of what it names (SAK-466). Shared
 * with the Atlas, which links a particle's own page back to it. */
export const PARTICLE_TERM = "particle";

/** A sentence with one written form picked out: the particle itself, found in
 * the sentence the pattern's own page shows. The first occurrence, and none at
 * all when the sentence writes the particle some other way (しか〜ない is two
 * pieces with a word between them), which leaves the line plain rather than
 * marking the wrong part of it. */
function withParticleMarked(jp: string, particle: string): SkySoundLine {
  const at = jp.indexOf(particle);
  if (at < 0) return [{ text: jp }];
  return [{ text: jp.slice(0, at) }, { text: particle, accent: true }, { text: jp.slice(at + particle.length) }].filter((r) => r.text);
}

/**
 * The Particle page: every particle the app teaches, in one table.
 *
 * Nothing here is written twice. The rows come from the recipes
 * (src/data/grammar/particles.ts): the particle, the recipe's own meaning line,
 * and the sentence that particle's own page shows. Each row opens that page.
 * The closing note is the kana cards' own words about は and へ
 * (PARTICLE_RULE), which is where a learner first meets them; the fourth
 * paragraph of that card is about WHEN the lesson teaches the rule, which a
 * reference page opened on purpose does not need.
 */
function particleListPage(): TeachPage {
  return {
    eyebrow: "Every particle",
    title: "The particles Saku teaches",
    paragraphs: [{ text: "What each one does, and a sentence it is used in. Open a particle to read its own page." }],
    tables: [{
      // four columns, which is wider than the panel opens: the table scrolls
      // sideways there (the rule `Table` already follows), and the widen
      // control shows the whole of it. Putting the sentence and its English in
      // one cell instead was measured and is worse: the column still does not
      // fit, and every row then wraps to three or four lines.
      heads: ["Particle", "What it does", "In a sentence", "In English"],
      rows: PARTICLE_ROWS.map((p) => [
        [{ text: p.particle }],
        [{ text: p.does }],
        p.example ? withParticleMarked(p.example.jp, p.particle) : [],
        [{ text: p.example?.en ?? "" }],
      ]),
      opens: PARTICLE_ROWS.map((p) => p.entry),
    }],
    after: PARTICLE_RULE.body.slice(0, 3).map((para, i) => ({ ...(i === 0 ? { heading: "How they are read" } : {}), text: para.text })),
  };
}

/** A written particle marked wherever it appears in a stretch of kana. Every
 * occurrence, not the first, so the two は of 夏は暑いですが、冬は寒いです are both
 * picked out, which is the whole point of the sentence being there. */
function withEveryMark(text: string, mark: string): SkySoundLine {
  return text
    .split(mark)
    .flatMap((piece, i) => (i === 0 ? [{ text: piece }] : [{ text: mark, accent: true }, { text: piece }]))
    .filter((r) => r.text);
}

/** An example sentence from a particle's page: the particle picked out, and
 * each run of kanji carrying the reading written for it (SAK-470).
 *
 * The readings are authored beside the sentence, one per run, because the
 * grammar corpus has none and these sentences are written rather than drawn
 * from it. A run with no reading written for it is printed as plain kanji,
 * which is what a sentence added without its readings looks like until the
 * test catches it. A particle is kana, so it never falls inside a kanji run
 * and the two passes cannot collide. */
function exampleLine(ex: ParticleNoteExample): SkySoundLine {
  const readings = ex.readings ?? [];
  const runs: Array<{ text: string; accent?: boolean; ruby?: string }> = [];
  let at = 0;
  let n = 0;
  for (const run of kanjiRuns(ex.jp)) {
    const from = ex.jp.indexOf(run, at);
    if (from > at) runs.push(...withEveryMark(ex.jp.slice(at, from), ex.mark));
    const reading = readings[n++];
    runs.push(reading ? { text: run, ruby: reading } : { text: run });
    at = from + run.length;
  }
  if (at < ex.jp.length) runs.push(...withEveryMark(ex.jp.slice(at), ex.mark));
  return runs;
}

/** One paragraph of a particle's page, with its sentences. */
function notePara(para: ParticleNotePara): TeachParagraph {
  return {
    ...(para.heading ? { heading: para.heading } : {}),
    text: para.text,
    ...(para.examples
      ? { examples: para.examples.map((ex) => ({ jp: exampleLine(ex), en: ex.en })) }
      : {}),
  };
}

/**
 * A particle's page of prose (SAK-470), or nothing for a particle that has none
 * written yet.
 *
 * It goes between the build page and Family: the build page says how to attach
 * the particle, this says what it means, and Family puts it beside the ones it
 * is confused with. Two particles can name one note between them, and は and が
 * do: both cards print the same page, word for word, because a page about one
 * of them that leans on the other's page is a page a learner can open first and
 * not follow. The page names the article it drew on once, which is why the
 * wa-ga cluster no longer links it again on the Family page right after.
 */
function particleNotePage(recipeId: string): TeachPage | undefined {
  const note = PARTICLE_NOTES.find((n) => n.recipes.includes(recipeId));
  if (!note) return undefined;
  return {
    eyebrow: note.eyebrow,
    title: note.title,
    paragraphs: note.body.map(notePara),
    link: { href: note.link.url, label: note.link.label },
  };
}

/** The entry a recipe's card is, which is the page its written pattern has:
 * 〜から is one page holding "because" and "from", the same rule the Particle
 * page's rows follow. */
function patternEntryOf(r: Recipe): EntryId | undefined {
  const page = primaryPatternRecipe(r.id);
  return page ? patternEntry(page.id) : undefined;
}

/**
 * What each row of a Family table opens: that pattern's own page (SAK-470,
 * Sam: "the family tables in the patterns should be links similar to how they
 * are on the particle terms page").
 *
 * The pattern the card is already on opens nothing, and neither does a member
 * that shares its page, so a row is a link only where the click takes a reader
 * somewhere they are not.
 */
function familyOpens(recipe: Recipe, members: readonly Recipe[]): ReadonlyArray<string | undefined> {
  const here = patternEntryOf(recipe);
  return members.map((m) => {
    const entry = patternEntryOf(m);
    return entry && entry !== here ? entry : undefined;
  });
}

/** A grammar pattern's pages: the app's own teaching (a form's authored
 * Library pages, or the generated pattern page: the meaning, the build
 * formula, the conjugation or derivation tables, the sentence), then its
 * family side by side when it has one. Converted from the app's PhaseIntro
 * shape into the Sky's, so the two show the same build by construction. */
function grammarPages(recipe: Recipe): TeachPage[] {
  const intros = formLibraryPages(recipe.id);
  const pages = (intros.length ? intros : [autoPatternPage(recipe)]).map((intro) => pageFromIntro(intro));
  const note = particleNotePage(recipe.id);
  if (note) pages.push(note);
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
      paragraphs: [{ text: "Japanese often has more than one pattern for the same idea. These are the closest ones, and how each is built." }],
      tables: [{ heads: ["Pattern", "Meaning", "Built"], rows, opens: familyOpens(recipe, members), ...(family.feel ? { note: family.feel } : {}) }],
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
 * So a list of memorized forms (たべる → たべて) is verb, result, meaning. */
interface RuleColumns { ending: boolean; change: boolean; gloss: boolean; note: boolean }

function ruleTable(rules: readonly IntroBuildRule[], heads?: BuildHeads, title?: string, extra: Partial<TeachTable> = {}): TeachTable {
  const cols: RuleColumns = {
    ending: rules.some((r) => r.label || r.drop),
    change: rules.some((r) => !r.to && (r.drop || r.add)),
    gloss: rules.some((r) => r.gloss),
    note: rules.some((r) => r.note),
  };
  const head = [
    ...(cols.ending ? [heads?.label ?? "Ending"] : []),
    // what the rows are built from, named for the kind of word it is: a table
    // of adjectives reads "Adjective" (SAK-455)
    heads?.word ?? "Verb",
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

const paragraphs = (body: readonly IntroPara[] | undefined): TeachParagraph[] =>
  (body ?? []).filter((p) => p.text.trim().length > 0).map((p) => ({ ...(p.heading ? { heading: p.heading } : {}), ...(p.lead ? { lead: p.lead } : {}), text: p.text, ...(p.accent ? { accent: p.accent } : {}) }));

/** One of the app's teaching pages in the Sky's shape. */
export function pageFromIntro(intro: PhaseIntro, mark?: string): TeachPage {
  const tables: TeachTable[] = [];
  // a punctuation catalogue: the marks, their names and their English jobs
  if (intro.punctuation?.length) tables.push({ title: "The marks", heads: ["Mark", "Name", "Works like", "Note"], rows: intro.punctuation.map((r) => [[{ text: r.mark }], [{ text: r.name }], [{ text: r.english }], [{ text: r.note }]]) });
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
