// What a word's Atlas page says it is (SAK-428).
//
// The forms folds listed every form a word takes without ever naming the group
// those forms come from, so a learner could read the whole of 知れる and still
// not know it was a る-verb. `wordFormKind` has named the group all along and
// nothing in the Sky read it. The block carries it now, with the entry that
// explains the group, and the Atlas sends that entry along so the chip has
// somewhere to go.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { patternEntry } from "@/data/grammar";
import { grammarConceptEntry } from "@/data/grammar-concepts";
import { cluster } from "@/data/grammar/clusters";
import { CURRICULUM_LESSONS } from "@/data/grammar/lessons";
import { kanjiRuns, PARTICLE_NOTES, type ParticleNote } from "@/data/grammar/particle-notes";
import { PARTICLE_ROWS } from "@/data/grammar/particles";
import { primaryPatternRecipe, recipe as recipeById } from "@/data/grammar/recipes";
import { PARTICLE_RULE } from "@/data/phase-intros";
import { termEntry } from "@/data/terms";
import { emptyHistory } from "@/lib/history-ops";
import { knownFactsOf, libEntry } from "@/lib/library/entries";
import { readableTierExamples } from "@/lib/sentence-rule-walk";
import type { EntryId } from "@/types/facts";
import type { HistoryFile } from "@/types/store";

import { atlasEntryFromHistory } from "./atlas";
import { pageFromIntro } from "./teach";

const NOW = Date.UTC(2026, 8, 8);
const VERBS = grammarConceptEntry("verb-classes");
const ADJECTIVES = grammarConceptEntry("adjective-types");

const kindOf = (glyph: string) => atlasEntryFromHistory(emptyHistory(), `word:${glyph}`, NOW)?.teach?.wordKind;

describe("a word's page names the kind of word it is", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ["知れる", "る-verb", VERBS],
    ["食べる", "る-verb", VERBS],
    ["知る", "う-verb", VERBS],
    ["する", "irregular verb", VERBS],
    ["来る", "irregular verb", VERBS],
    ["静か", "な-adjective", ADJECTIVES],
    ["高い", "い-adjective", ADJECTIVES],
  ];
  for (const [glyph, label, readAbout] of cases) {
    it(`calls ${glyph} ${label === "irregular verb" ? "an" : "a"} ${label}`, () => {
      assert.deepEqual(kindOf(glyph), { label, readAbout });
    });
  }

  it("says nothing about a word that does not conjugate", () => {
    assert.equal(kindOf("猫"), undefined);
    assert.equal(kindOf("勉強"), undefined);
  });

  it("sends the page the chip opens along with the word", () => {
    const entry = atlasEntryFromHistory(emptyHistory(), "word:知れる", NOW);
    assert.ok(entry, "no entry for 知れる");
    assert.ok(entry.items.some((x) => x.id === VERBS), "the verb classes page did not travel with the word");
  });

  it("points at pages that exist", () => {
    for (const id of [VERBS, ADJECTIVES]) assert.ok(libEntry(id as EntryId), `${id} is not an entry`);
  });
});

// ===========================================================================
// SAK-423: the two teaching decisions, read off the pages that carry them.
//
// Both are REVEAL tests as much as page tests: the reveal mounts the same
// LessonCard on the same `teach` payload these assertions read, so a line that
// is here is a line the learner sees after answering.
// ===========================================================================

/** Every string of prose on an entry's teach pages, flattened. */
function pageProse(entryId: string): string {
  const entry = atlasEntryFromHistory(emptyHistory(), entryId, NOW);
  const pages = entry?.teach?.pages ?? [];
  const out: string[] = [];
  for (const page of pages) {
    for (const p of [...(page.paragraphs ?? []), ...(page.after ?? [])]) out.push(p.text);
    for (const t of page.tables ?? []) {
      // `instruction` is prose or a run of tinted spans; both say words.
      if (typeof t.instruction === "string") out.push(t.instruction);
      else if (t.instruction) out.push(t.instruction.map((run) => run.text).join(""));
      if (t.note) out.push(t.note);
    }
  }
  return out.join("\n");
}

describe("the causative-passive page names the contraction", () => {
  it("says what people usually say, and that the long form is the regular one", () => {
    const prose = pageProse("grammar:causative-passive");
    assert.match(prose, /およがされる/, "the contraction is not on the page");
    assert.match(prose, /People usually say およがされる; the long form is the regular one\./);
  });

  it("still teaches the long form in its build table", () => {
    const entry = atlasEntryFromHistory(emptyHistory(), "grammar:causative-passive", NOW);
    const cells = (entry?.teach?.pages ?? [])
      .flatMap((p) => p.tables ?? [])
      .flatMap((t) => t.rows)
      .flat()
      .flatMap((cell) => (Array.isArray(cell) ? cell : [cell]))
      .map((run) => (typeof run === "string" ? run : (run?.text ?? "")));
    assert.ok(cells.some((c) => c.includes("せられる")), "the long form left the table");
    assert.ok(
      !cells.some((c) => c.includes("がされる")),
      "the contraction reached the build table, which teaches it",
    );
  });

  it("says す-verbs have no short form, so nobody invents one", () => {
    assert.match(pageProse("grammar:causative-passive"), /す-verbs have no short form/);
  });
});

describe("a ずる verb says it is the older spelling", () => {
  const noteFor = (glyph: string) =>
    (atlasEntryFromHistory(emptyHistory(), `word:${glyph}`, NOW)?.teach?.notes ?? []).join("\n");

  it("names its じる twin from the ずる side", () => {
    const note = noteFor("演ずる");
    assert.match(note, /演じる and 演ずる are the same verb/);
    assert.match(note, /演ずる is the older one/);
  });

  it("reads the same from the じる side", () => {
    assert.equal(noteFor("演じる"), noteFor("演ずる"));
  });

  it("quotes the じ forms the engine actually builds", () => {
    const note = noteFor("感ずる");
    for (const form of ["感じます", "感じられる", "感じれば"]) {
      assert.ok(note.includes(form), `${form} is missing from the note`);
    }

  });
});

// THE WORD'S OWN SENTENCE, AND WHERE THE WORD IS IN IT (SAK-443). The payload
// carried the sentence and dropped the span, so 今から仕事ですよ。printed with
// nothing marked and the learner had to find 仕事 in it. The span is the data's
// own (SAK-422 checked every one of them against its word), so all the payload
// has to do is carry it across.
describe("a word's example sentence says where the word is", () => {
  const exampleOf = (glyph: string) => atlasEntryFromHistory(emptyHistory(), `word:${glyph}`, NOW)?.teach?.example;

  it("carries the span beside the sentence", () => {
    const ex = exampleOf("仕事");
    assert.ok(ex, "仕事 has no example sentence");
    assert.ok(ex.span, "仕事's sentence came across without its span");
    assert.equal(ex.jp.slice(ex.span[0], ex.span[1]), "仕事");
  });

  it("points at the word as the sentence writes it, however that is inflected", () => {
    // 2,172 of the spans are the dictionary spelling and 817 are a form of it
    // (SAK-422), so the underline has to be allowed to be neither the whole
    // sentence nor exactly the headword
    const marked = ["仕事", "食べる", "行く", "ある", "包む", "新しい"]
      .map((glyph) => ({ glyph, ex: exampleOf(glyph) }))
      .filter(({ ex }) => ex?.span);
    assert.ok(marked.length > 0, "not one of the sample words came back with a span");
    for (const { glyph, ex } of marked) {
      const [a, b] = ex!.span!;
      assert.ok(a >= 0 && b > a && b <= ex!.jp.length, `${glyph}'s span falls outside its own sentence`);
      assert.notEqual(ex!.jp.slice(a, b), ex!.jp, `${glyph} underlines the whole sentence`);
    }
  });

  it("carries the sentence, its English and the span, and nothing else", () => {
    // a sentence whose word could not be found carries no span at all rather
    // than a guessed one, so the key is optional and the card prints such a
    // sentence plain
    const ex = exampleOf("仕事");
    assert.ok(ex);
    assert.deepEqual(Object.keys(ex).sort(), ["en", "jp", "span"]);
  });
});

// A READING NOTHING TEACHES YET (SAK-295, SAK-432). The readings table on a
// kanji's card has three columns: hear it, the reading, the words it is read
// that way in. Six rows in the whole set reach the third column with nothing
// to put in it, because every word that used to attest the reading was dropped
// when the vocabulary said it no longer takes it. The card dims such a row and
// writes "No word in Saku uses this reading." where the words would be
// (SAK-443, which is what that row says now), and the empty list is
// what it reads to decide: there is no separate flag to keep in step with it.
describe("a kanji reading with no word behind it", () => {
  const readingsOf = (glyph: string) => atlasEntryFromHistory(emptyHistory(), `kanji:${glyph}`, NOW)?.teach?.readings ?? [];
  const find = (glyph: string, reading: string) => readingsOf(glyph).find((r) => r.reading === reading);

  it("comes through the teaching with an empty word list, which is the mark", () => {
    // 面 is おもて in the dictionary and in no word this app teaches
    const omote = find("面", "おもて");
    assert.ok(omote, "面 has no おもて row");
    assert.deepEqual(omote.words, []);
  });

  it("is the rare one: the readings beside it carry their words", () => {
    const rows = readingsOf("面");
    assert.ok(rows.length > 1, "面 has only one reading");
    const taught = rows.filter((r) => r.words.length > 0);
    assert.ok(taught.length > 0, "not one of 面's readings has a word");
    for (const r of taught) assert.ok(r.words.every((w) => w.includes("面")), `${r.reading} is attested by a word without 面 in it`);
  });

  it("is how the other five read too", () => {
    // the whole set of them, so a change in the vocabulary that empties or
    // fills one of these rows is a test that fails rather than a card that
    // quietly says something new
    const empty: string[] = [];
    for (const [glyph, reading] of [["仏", "ふつ"], ["埋", "うず"], ["畳", "じょう"], ["背", "せい"], ["開", "ひら"], ["面", "おもて"]] as const) {
      if (find(glyph, reading)?.words.length === 0) empty.push(`${glyph}/${reading}`);
    }
    assert.deepEqual(empty, ["仏/ふつ", "埋/うず", "畳/じょう", "背/せい", "開/ひら", "面/おもて"]);
  });
});

// ===========================================================================
// SAK-455: a rule's table says what kind of word its rows hold.
//
// The 〜な rule put "Verb" over たかい and しずか. Every table the quiz reveal
// and the grammar pages draw goes through the same builder, so the headings
// are read off every page the app can teach, not off the one that was wrong.
// ===========================================================================

/** Every table on every page of every grammar lesson, with where it is. */
function everyGrammarTable(): { lesson: string; card: string; title: string; heads: readonly string[] }[] {
  const out: { lesson: string; card: string; title: string; heads: readonly string[] }[] = [];
  for (const lesson of CURRICULUM_LESSONS) {
    for (const page of lesson.pages) {
      if (page.kind !== "teach") continue;
      for (const table of pageFromIntro(page.card).tables ?? []) {
        out.push({ lesson: lesson.id, card: page.card.id, title: table.title ?? "", heads: table.heads ?? [] });
      }
    }
  }
  return out;
}

// SAK-464. The 〜は card said "marks the topic" as its meaning and then
// "〜は: Marks the topic." as the heading of the page under it. Sam: drop the
// repeat. The generated pattern page's heading is always the pattern and its
// meaning, which is the card's own glyph and its own meaning line, so it
// carries nothing; an authored page's heading is its own and stays.
describe("a pattern's page does not say again what the card says above it", () => {
  const teachOf = (id: string) => atlasEntryFromHistory(emptyHistory(), id as EntryId, NOW)?.teach;

  it("drops the generated heading and keeps the meaning line", () => {
    const teach = teachOf("grammar:wa");
    assert.deepEqual(teach?.meanings, ["marks the topic"]);
    assert.equal(teach?.pages?.[0]?.title, "", "the heading is gone");
    // and the page still teaches the build, which for 〜は is its table's
    // instruction rather than a paragraph
    assert.deepEqual(teach?.pages?.[0]?.tables?.map((t) => t.instruction), ["Take a noun, just as it is, and add は."]);
  });

  it("keeps a heading of its own", () => {
    const family = teachOf("grammar:wa")?.pages?.find((p) => p.eyebrow === "Family");
    assert.equal(family?.title, "Ways to say this");
  });

  it("leaves every other pattern's page with either a heading or something to say", () => {
    for (const id of ["grammar:ga", "grammar:te-iru", "grammar:tara"]) {
      const pages = teachOf(id)?.pages ?? [];
      assert.ok(pages.length > 0, `${id} has no pages`);
      for (const page of pages) {
        assert.ok(page.title || page.paragraphs.length || page.tables?.length, `${id} has an empty page`);
      }
    }
  });
});

describe("a rule's table heads its column of words with the kind of word it holds", () => {
  it("says Adjective over the 〜な rule's adjectives", () => {
    const [table, ...rest] = everyGrammarTable().filter((t) => t.card === "gl-prenominal-form");
    assert.ok(table, "the 〜な rule has no table");
    assert.equal(rest.length, 0, "the 〜な rule grew a second table");
    assert.deepEqual(table.heads, ["Type", "Adjective", "Result"]);
  });

  it("says Adjective on every other table of adjectives, and never Verb", () => {
    const adjectives = everyGrammarTable().filter((t) => /adjective/i.test(t.title));
    assert.ok(adjectives.length >= 6, `only ${adjectives.length} adjective tables were found`);
    for (const t of adjectives) {
      const where = `${t.lesson} · ${t.card} · ${t.title}`;
      assert.ok(t.heads.includes("Adjective"), `${where} does not name its adjectives`);
      assert.ok(!t.heads.includes("Verb"), `${where} calls its adjectives verbs`);
    }
  });

  it("still says Verb over verbs", () => {
    const verbs = everyGrammarTable().filter((t) => /verb/i.test(t.title) && !/adjective/i.test(t.title));
    assert.ok(verbs.length >= 6, `only ${verbs.length} verb tables were found`);
    for (const t of verbs) {
      assert.ok(t.heads.includes("Verb"), `${t.lesson} · ${t.card} · ${t.title} lost its Verb column`);
    }
  });

  it("says Noun over the rules that work on nouns", () => {
    const nouns = everyGrammarTable().filter((t) => /noun/i.test(t.title));
    assert.ok(nouns.length >= 6, `only ${nouns.length} noun tables were found`);
    for (const t of nouns) {
      const where = `${t.lesson} · ${t.card} · ${t.title}`;
      assert.ok(t.heads.includes("Noun"), `${where} does not name its nouns`);
      assert.ok(!t.heads.includes("Verb"), `${where} calls its nouns verbs`);
    }
  });
});

// ===========================================================================
// SAK-466: the Particle page is the whole list of them.
//
// The list is built from the recipes, so what is worth testing is not what it
// says but that it stays the recipes: a row per particle, in their own words,
// each row opening a page that exists and that was sent along with the term so
// the click has somewhere to go.
// ===========================================================================

describe("the Particle page lists every particle Saku teaches", () => {
  const PARTICLE = termEntry("particle");
  const entry = () => atlasEntryFromHistory(emptyHistory(), PARTICLE, NOW);
  const table = () => (entry()?.teach?.pages ?? []).flatMap((p) => p.tables ?? [])[0];
  const cell = (line: ReadonlyArray<{ text: string }>) => line.map((run) => run.text).join("");

  it("has a row per particle, once each, in the recipes' own words", () => {
    const t = table();
    assert.ok(t, "the Particle page has no table");
    assert.deepEqual(t.rows.map((row) => cell(row[0])), PARTICLE_ROWS.map((p) => p.particle));
    assert.deepEqual(t.rows.map((row) => cell(row[1])), PARTICLE_ROWS.map((p) => p.does));
  });

  it("opens a page that exists on every row", () => {
    const t = table();
    assert.ok(t?.opens, "no row opens anything");
    assert.equal(t.opens.length, t.rows.length, "some rows open nothing");
    for (const id of t.opens) assert.ok(id && libEntry(id as EntryId), `a row opens '${id}', which is not an entry`);
  });

  it("sends every page a row opens along with the term", () => {
    const sent = new Set((entry()?.items ?? []).map((x) => x.id));
    for (const id of table()?.opens ?? []) {
      assert.ok(sent.has(id!), `${id} did not travel with the Particle page, so its row would open nothing`);
    }
  });

  it("says how は and へ are read when they do the job", () => {
    const prose = pageProse(PARTICLE);
    assert.match(prose, /は is normally .ha., but when it marks the topic of a sentence it is read .wa./);
    assert.match(prose, /へ is normally .he., but when it points somewhere it is read .e./);
  });

  it("is reached from a particle's own page", () => {
    const wa = atlasEntryFromHistory(emptyHistory(), "grammar:wa", NOW);
    const read = (wa?.related ?? []).find((g) => g.title === "Read about it");
    assert.ok(read, "は's page has no way back to the Particle page");
    assert.ok(read.items.some((x) => x.id === PARTICLE), "は's page points somewhere else");
  });
});

// SAK-468. Sam asked for a sentence type's page to show only the examples a
// learner can read at that point in the order, so a page reached right after
// は and が is not three sentences of grammar they have never met. Every
// curated example says which patterns it turns on (`p` in
// src/lib/sentence-rule-walk.ts), and the page keeps the ones the learner has
// learned, claimed, or picked for tonight. It says nothing about the rest,
// which is SAK-464's rule for anything held back.
describe("a sentence type's page shows the examples the learner can read", () => {
  /** A learner who has claimed these patterns and nothing else. */
  const claiming = (...ids: readonly string[]): HistoryFile => {
    const history = emptyHistory();
    for (const id of ids) {
      const entry = libEntry(patternEntry(id));
      assert.ok(entry, `${id} is a pattern`);
      for (const f of knownFactsOf(entry)) history.claims = { ...history.claims, [f]: NOW };
    }
    return history;
  };
  /** Every example sentence on one type's page, in Japanese, once each. */
  const examplesOn = (tier: string, history: HistoryFile): string[] => {
    const teach = atlasEntryFromHistory(history, `writing-rule:sentence-rule-${tier}`, NOW)?.teach;
    const steps = (teach?.pages ?? []).filter((p) => p.eyebrow?.startsWith("Step"));
    assert.ok(steps.length > 0, `${tier} has no steps`);
    return [...new Set(steps.flatMap((p) => (p.examples ?? []).map((e) => e.japanese.map((r) => r.text).join(""))))];
  };

  it("holds back the one built from a pattern the learner has not met", () => {
    assert.deepEqual(examplesOn("desire", claiming("wa", "yasui", "nikui")), [
      "これは食べやすい。",
      "これは言いにくい。",
    ]);
  });

  it("brings it back the moment they have it", () => {
    assert.deepEqual(examplesOn("desire", claiming("wa", "wo", "yasui", "nikui", "tai")), [
      "私はこれを食べたい。",
      "これは食べやすい。",
      "これは言いにくい。",
    ]);
  });

  // Simple is the one type with no example readable from its own
  // requirements: every curated Simple sentence turns on を, which は and が
  // do not bring. A page of steps with nothing under them teaches nothing, so
  // it shows the closest examples instead of none.
  it("shows the closest examples when none is readable yet", () => {
    const justRead = examplesOn("simple", claiming("wa", "ga"));
    assert.deepEqual(justRead, ["私はそれを言う。", "私は何を言う？", "私はこれを食べる。"]);
    assert.deepEqual(examplesOn("simple", claiming("wa", "ga", "wo")), justRead, "the same three, readable outright once を is met");
  });

  it("shows every example when there is no learner to read it for", () => {
    // the rule is asked for, not assumed: a caller with no learner in hand
    // (the walk's own data, a page built from the tables alone) gets the lot
    assert.equal(readableTierExamples("desire").length, 3);
    assert.equal(readableTierExamples("desire", new Set(["wa", "yasui"])).length, 1);
  });
});

// A particle's page of prose (SAK-470). The app taught は by saying "take a
// noun, add は", which is the build and not the idea. Each particle in scope
// now has a page of prose between the build page and Family, and は and が name
// one page between them: Sam read the two pages in the app and found the second
// one talking about the first ("makes it sound like the reader definitely read
// the wa page before this. they might not have"). These pin the shape: that the
// page is there, where it is in the pager, that it names its source once, that
// both cards print the same words, and that every sentence on it carries its
// readings.
describe("a particle's page says what the particle means", () => {
  const pagesOf = (recipe: string) => atlasEntryFromHistory(emptyHistory(), `grammar:${recipe}` as EntryId, NOW)?.teach?.pages ?? [];
  const noteOf = (recipe: string): ParticleNote => {
    const note = PARTICLE_NOTES.find((n) => n.recipes.includes(recipe));
    assert.ok(note, `no note is written for ${recipe}`);
    return note;
  };
  const pageOf = (recipe: string) => pagesOf(recipe).find((p) => p.eyebrow === noteOf(recipe).eyebrow);
  const recipesInScope = PARTICLE_NOTES.flatMap((n) => n.recipes);

  it("gives every particle in scope its page, with a Read more link that names the article", () => {
    assert.ok(recipesInScope.length >= 2, "the notes went missing");
    for (const recipe of recipesInScope) {
      const note = noteOf(recipe);
      const page = pageOf(recipe);
      assert.ok(page, `${recipe} has no page of prose`);
      assert.equal(page.title, note.title);
      assert.equal(page.paragraphs.length, note.body.length, `${recipe}'s page lost paragraphs`);
      // the source is named, once, by its own title rather than by a bare URL.
      // A page with no link at all says why in the data, the way a cluster
      // without one does: って is the only one, because Tofugu has no page for it.
      if (!note.link) {
        assert.ok(note.noLinkReason, `${recipe} has no Read more link and no reason`);
        assert.equal(page.link, undefined, `${recipe}'s page links something its note does not name`);
        continue;
      }
      assert.ok(page.link, `${recipe}'s page names no source`);
      assert.match(page.link.href, /^https:\/\//);
      assert.match(page.link.label, /^Read more: .+\(Tofugu\)$/);
      assert.ok(page.link.label.length > "Read more: (Tofugu)".length + 10, `${recipe}'s link has no title in it`);
    }
  });

  // The whole Sentences row, once Sam said to build the rest (2026-09-20: "go
  // ahead and build all of them"). Pinned as a list so that a particle losing
  // its page is a test that fails rather than a card that quietly goes back to
  // saying "take a noun, add まで". から and と sit on the recipe their row on
  // the Particle page opens, which is the page that written pattern has.
  it("covers every particle the Particle page lists", () => {
    const covered = new Set(recipesInScope);
    const missing = PARTICLE_ROWS
      .map((row) => primaryPatternRecipe(row.recipeId)?.id ?? row.recipeId)
      .filter((id) => !covered.has(id));
    assert.deepEqual([...new Set(missing)], [], "a particle on the Particle page has no page of prose");
    assert.deepEqual(
      PARTICLE_NOTES.map((n) => [...n.recipes]),
      [
        ["wa", "ga"], ["wo"], ["ni", "de"], ["e"], ["made", "made-ni"],
        ["kara-reason"], ["to-conditional"], ["mo"], ["dake", "shika-nai"],
        ["ka"], ["ne", "yo"], ["tte"],
      ],
      "the pages, and which particles share one, changed",
    );
  });

  // から and と each hold two senses on one written pattern, and the page a
  // learner opens is the pattern's. Both senses have to be on it, or half the
  // card's own meaning line has no explanation behind it.
  it("covers both senses on the two pages that hold two", () => {
    const prose = (recipe: string) => (pageOf(recipe)?.paragraphs ?? []).map((p) => p.text).join("\n");
    const kara = prose("kara-reason");
    assert.match(kara, /where something starts/, "から's page does not cover the starting point");
    assert.match(kara, /gives the reason/, "から's page does not cover the reason");
    const to = prose("to-conditional");
    assert.match(to, /joined them/, "と's page does not cover joining two nouns");
    assert.match(to, /every time the first half does/, "と's page does not cover the conditional");
  });

  it("puts it after the build and before Family", () => {
    for (const recipe of recipesInScope) {
      const pages = pagesOf(recipe);
      const at = pages.findIndex((p) => p.eyebrow === noteOf(recipe).eyebrow);
      const family = pages.findIndex((p) => p.eyebrow === "Family");
      assert.ok(at > 0, `${recipe}'s page is not after the build page`);
      assert.ok(family < 0 || at < family, `${recipe}'s page is not before Family`);
    }
  });

  /** The particles a shared note is the page for, as they are written: 〜しか〜ない
   * is しか, which is what its sentences mark and what its prose calls it. */
  const writtenParticles = (note: ParticleNote) =>
    note.recipes.map((id) => (recipeById(id)?.pattern ?? "").split("〜").find(Boolean) ?? "");

  const shared = PARTICLE_NOTES.filter((n) => n.recipes.length > 1);

  it("prints one page word for word on both of the cards that share it", () => {
    assert.ok(shared.length >= 4, `only ${shared.length} pages are shared`);
    for (const note of shared) {
      const pages = note.recipes.map((id) => ({ id, page: pageOf(id) }));
      for (const { id, page } of pages) assert.ok(page, `${id} has no page`);
      const [first, ...rest] = pages;
      for (const { id, page } of rest) {
        assert.equal(noteOf(id), note, `${id} reads some other page`);
        assert.deepEqual(page, first.page, `${id} and ${first.id} print different pages`);
      }
    }
  });

  it("names every particle it is about in its first paragraph", () => {
    // a shared page starts from nothing: a reader can open either card first,
    // so both particles are named and told apart before anything compares them
    for (const note of shared) {
      const opening = pageOf(note.recipes[0])?.paragraphs[0]?.text ?? "";
      for (const particle of writtenParticles(note)) {
        assert.ok(opening.includes(particle), `${note.eyebrow} opens without naming ${particle}`);
      }
    }
    // and は and が say which is the topic and which the subject, in that first line
    const wa = pageOf("wa")?.paragraphs[0]?.text ?? "";
    assert.match(wa, /は marks the topic/);
    assert.match(wa, /が marks[\s\S]*the subject/);
  });

  it("names both particles in every paragraph that compares them", () => {
    // the words a paragraph weighing two particles uses, kept tight: "both" and
    // "the other" turn up in "the bread you are both looking at" and "every
    // other day", which compare nothing
    const compares = (text: string) => /\bswaps?\b|\binstead of\b|\beither one\b|\beither way\b|\beither particle\b/i.test(text);
    let found = 0;
    for (const note of shared) {
      const particles = writtenParticles(note);
      for (const para of pageOf(note.recipes[0])?.paragraphs ?? []) {
        if (!compares(para.text)) continue;
        found += 1;
        for (const particle of particles) {
          assert.ok(para.text.includes(particle), `"${para.text}" compares them without naming ${particle}`);
        }
      }
    }
    assert.ok(found >= 4, `only ${found} paragraphs across the shared pages compare their two particles`);
  });

  it("says how は is read, in the words the kana cards use", () => {
    const page = pageOf("wa");
    const said = page?.paragraphs.find((p) => p.text.includes('read "wa"'));
    assert.ok(said, "the page does not say は is read wa");
    // the kana card's own rule, so a learner reads it the same way twice
    assert.match(PARTICLE_RULE.body[0]?.text ?? "", /read .wa./);
    assert.ok(said.text.includes('read "ha"'), "it does not say what the character is read elsewhere");
    assert.ok(said.text.includes("watashi wa"), "it does not show the reading on a word");
    // and it is near the top, not buried under the mistakes
    assert.ok((page?.paragraphs.indexOf(said) ?? 99) <= 2, "the reading is not near the top of the page");
  });

  it("marks the particle in every sentence it shows, everywhere it appears", () => {
    for (const recipe of recipesInScope) {
      const note = noteOf(recipe);
      const shown = pageOf(recipe)?.paragraphs.flatMap((p) => p.examples ?? []) ?? [];
      assert.ok(shown.length >= note.body.length - 6, `${recipe}'s page shows almost no sentences`);
      for (const ex of shown) {
        const plain = ex.jp.map((r) => r.text).join("");
        const marked = ex.jp.filter((r) => r.accent);
        assert.ok(marked.length > 0, `${plain} has nothing marked in it`);
        for (const mark of new Set(marked.map((r) => r.text))) {
          assert.equal(marked.filter((r) => r.text === mark).length, plain.split(mark).length - 1, `${plain} marks ${mark} only once`);
        }
        assert.ok(ex.en.length > 0, `${plain} has no English`);
      }
    }
  });

  // Sam, 2026-09-24, on "Sentences with both": "these examples talk about how
  // the sentence has both but then the sentence highlights only one."
  it("picks out both particles in a sentence shown for the two of them", () => {
    const shown = pageOf("wa")?.paragraphs.flatMap((p) => p.examples ?? []) ?? [];
    const both = shown.find((ex) => ex.jp.map((r) => r.text).join("") === "妹は歌が上手です。");
    assert.ok(both, "妹は歌が上手です is not on the は page");
    assert.deepEqual(both.jp.filter((r) => r.accent).map((r) => r.text), ["は", "が"]);
  });

  // Sam: "we should have furigana in example sentences." The readings are
  // authored beside the sentence, so the guard is that none of them is missing:
  // every run of kanji on the page reaches the page with its kana on it.
  it("puts a reading over every run of kanji in the sentences it shows", () => {
    for (const note of PARTICLE_NOTES) {
      for (const para of note.body) {
        for (const ex of para.examples ?? []) {
          const runs = kanjiRuns(ex.jp);
          assert.equal(
            (ex.readings ?? []).length, runs.length,
            `${ex.jp} has ${(ex.readings ?? []).length} readings for ${runs.length} runs of kanji`,
          );
          for (const reading of ex.readings ?? []) assert.match(reading, /^[぀-ゟ]+$/, `"${reading}" is not kana`);
        }
      }
    }
  });

  it("carries the readings through to the page, over the kanji and nothing else", () => {
    const shown = pageOf("wa")?.paragraphs.flatMap((p) => p.examples ?? []) ?? [];
    const withRuby = shown.flatMap((ex) => ex.jp.filter((run) => run.ruby));
    assert.ok(withRuby.length >= 20, `only ${withRuby.length} runs of kanji reached the page with a reading`);
    for (const run of withRuby) {
      assert.match(run.text, /^[一-龯㐀-䶿]+$/, `"${run.text}" is not kanji and has a reading over it`);
      assert.ok(!run.accent, `"${run.text}" is both the particle and a run of kanji`);
    }
    // 今日 is one run read きょう, not two kanji read one at a time
    const kyou = withRuby.find((run) => run.text === "今日");
    assert.equal(kyou?.ruby, "きょう");
  });

  it("leaves the family page of a shared pair to link nothing, so the article is named once a page", () => {
    // Both clusters sat one turn after a page that now links the same article
    // and now states the rule the note used to say did not exist.
    for (const [id, recipe] of [["wa-ga", "wa"], ["ni-de", "ni"]] as const) {
      const family = cluster(id);
      assert.equal(family?.link, null, `${id}'s Family page links the article a second time`);
      assert.ok(family?.noLinkReason, `${id} has an empty link slot and no reason`);
      assert.ok(!/no rule for choosing/.test(family?.feel ?? ""), `${id}'s note still says there is no rule`);
      assert.ok((family?.feel ?? "").includes(noteOf(recipe).eyebrow), `${id}'s note does not name the page before it`);
    }
  });
});

// SAK-470, Sam: "the family tables in the patterns should be links similar to
// how they are on the particle terms page." A Family table's Pattern column is
// the row's link, the same `opens` the Particle page's rows use.
describe("a Family table opens the pattern a row names", () => {
  const familyOf = (recipe: string) =>
    (atlasEntryFromHistory(emptyHistory(), `grammar:${recipe}` as EntryId, NOW)?.teach?.pages ?? [])
      .find((p) => p.eyebrow === "Family")?.tables?.[0];

  it("opens a page that exists, on every row but the one the card is already on", () => {
    const table = familyOf("wa");
    assert.ok(table, "は has no Family table");
    assert.ok(table.opens, "no row of it opens anything");
    assert.equal(table.opens.length, table.rows.length, "some rows open nothing");
    const here = table.rows.findIndex((row) => row[0]?.some((run) => run.accent));
    assert.ok(here >= 0, "no row is the pattern the card is on");
    assert.equal(table.opens[here], undefined, "the card links to itself");
    for (const [i, id] of table.opens.entries()) {
      if (i === here) continue;
      assert.ok(id && libEntry(id as EntryId), `a row opens '${id}', which is not an entry`);
    }
    assert.equal(table.opens.filter(Boolean).length, table.rows.length - 1, "some other row opens nothing");
  });

  it("sends every page a row opens along with the pattern", () => {
    const sent = new Set((atlasEntryFromHistory(emptyHistory(), "grammar:wa", NOW)?.items ?? []).map((x) => x.id));
    for (const id of familyOf("wa")?.opens ?? []) {
      if (id) assert.ok(sent.has(id), `${id} did not travel with は, so its row would open nothing`);
    }
  });
});
