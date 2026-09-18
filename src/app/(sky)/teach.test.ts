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

import { grammarConceptEntry } from "@/data/grammar-concepts";
import { CURRICULUM_LESSONS } from "@/data/grammar/lessons";
import { emptyHistory } from "@/lib/history-ops";
import { libEntry } from "@/lib/library/entries";
import type { EntryId } from "@/types/facts";

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
