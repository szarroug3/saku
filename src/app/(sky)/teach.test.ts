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

import readingsJson from "@/data/generated/sentence-readings.json" with { type: "json" };
import { patternEntry } from "@/data/grammar";
import { GRAMMAR_CONCEPTS, grammarConceptEntry } from "@/data/grammar-concepts";
import { etymologyOf } from "@/data/kanji-etymology";
import { MARKS, markEntry } from "@/data/marks";
import { VERB_PAIRS } from "@/data/transitivity";
import { cluster } from "@/data/grammar/clusters";
import { CURRICULUM_LESSONS } from "@/data/grammar/lessons";
import { kanjiRuns, PARTICLE_NOTES, type ParticleNote } from "@/data/grammar/particle-notes";
import { PARTICLE_ROWS } from "@/data/grammar/particles";
import { autoPatternPage, sentenceExampleFor } from "@/data/grammar/auto-page";
import { primaryPatternRecipe, RECIPES, recipe as recipeById } from "@/data/grammar/recipes";
import { PARTICLE_RULE } from "@/data/phase-intros";
import { hasSentenceReadings, sentenceRuby, sentenceSlots } from "@/data/sentence-readings";
import { SENTENCE_ORDERING_GUIDES } from "@/data/sentence-ordering-guides";
import { TERMS, termEntry } from "@/data/terms";
import { emptyHistory } from "@/lib/history-ops";
import { knownFactsOf, libEntry } from "@/lib/library/entries";
import { readableTierExamples, TIER_EXAMPLES } from "@/lib/sentence-rule-walk";
import { CURRICULUM_KEBS_ORDERED } from "@/lib/word-rank";
import type { EntryId } from "@/types/facts";
import type { HistoryFile } from "@/types/store";

import { atlasEntryFromHistory } from "./atlas";
import { chipReading } from "@/sky/lib/japanese";
import type { PartedSentence, SoundLine, TeachPage } from "@/sky/lib/lesson";
import { kanjiRunsIn, rubyFromReading } from "@/sky/lib/sound-line";

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

  it("carries the sentence, its English, the span and its readings, and nothing else", () => {
    // a sentence whose word could not be found carries no span at all rather
    // than a guessed one, so the key is optional and the card prints such a
    // sentence plain
    const ex = exampleOf("仕事");
    assert.ok(ex);
    assert.deepEqual(Object.keys(ex).sort(), ["en", "jp", "sound", "span"]);
  });

  // SAK-481: the readings were stored with the sentence (`kr`, SAK-95) and the
  // payload dropped them, so 今から仕事ですよ。 printed with no furigana.
  it("carries the furigana over the sentence's kanji", () => {
    const ex = exampleOf("仕事");
    assert.ok(ex?.sound, "仕事's sentence came across without its readings");
    assert.equal(ex.sound.map((r) => r.text).join(""), ex.jp, "the runs do not spell the sentence");
    assert.deepEqual(ex.sound.filter((r) => r.ruby).map((r) => [r.text, r.ruby]), [["今", "いま"], ["仕", "し"], ["事", "ごと"]]);
  });

  it("spells the sentence and puts kana over kanji only, on the first 300 words taught", () => {
    // a kanji the readings pass could not read has no slot to print and is
    // left bare; a sentence with none at all carries no `sound` and prints as
    // it did before
    let read = 0;
    for (const glyph of CURRICULUM_KEBS_ORDERED.slice(0, 300)) {
      const ex = exampleOf(glyph);
      if (!ex?.sound) continue;
      read++;
      assert.equal(ex.sound.map((r) => r.text).join(""), ex.jp, `${glyph}: the runs do not spell the sentence`);
      for (const r of ex.sound.filter((r) => r.ruby)) {
        assert.match(r.text, /^[一-鿿㐀-䶿々]+$/, `${glyph}: "${r.text}" is not kanji and has a reading over it`);
        assert.match(r.ruby!, /^[぀-ゟ]+$/, `${glyph}: "${r.ruby}" is not kana`);
      }
    }
    assert.ok(read > 200, `only ${read} of the first 300 words' sentences came with readings`);
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
    for (const r of taught) assert.ok(r.words.every((w) => w.word.includes("面")), `${r.reading} is attested by a word without 面 in it`);
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
// SAK-482: the kanji card's Readings fold.
//
// The fold printed its example words bare (期日 休日 近日 元日 beside じつ),
// and it sorted on from kun by looking for katakana in readings that arrive
// in hiragana, so all of 日's readings sat under kun'yomi. The kind comes from
// the kanji's own on and kun lists now, and each word carries its furigana.
// ===========================================================================
describe("a kanji card's Readings fold", () => {
  const readingsOf = (glyph: string) => atlasEntryFromHistory(emptyHistory(), `kanji:${glyph}`, NOW)?.teach?.readings ?? [];
  const find = (glyph: string, reading: string) => readingsOf(glyph).find((r) => r.reading === reading);

  it("puts 日's にち and じつ under on'yomi and ひ under kun'yomi", () => {
    assert.equal(find("日", "にち")?.kind, "on");
    assert.equal(find("日", "じつ")?.kind, "on");
    assert.equal(find("日", "ひ")?.kind, "kun");
  });

  it("gives each word its furigana, each kanji with its own reading in that word", () => {
    const kyuujitsu = find("日", "じつ")?.words.find((w) => w.word === "休日");
    assert.ok(kyuujitsu, "休日 is not one of じつ's words");
    assert.deepEqual(kyuujitsu.sound, [{ text: "休", ruby: "きゅう" }, { text: "日", ruby: "じつ" }]);
  });

  it("leaves the kana in a word plain and puts the reading over the kanji only", () => {
    // お誕生日おめでとうございます is one of び's words: its お and its
    // おめでとうございます print as they are, with nothing over them
    for (const r of readingsOf("日")) {
      for (const w of r.words) {
        assert.equal(w.sound.map((s) => s.text).join(""), w.word, `${w.word}'s runs do not spell it`);
        for (const s of w.sound) {
          if (s.ruby) assert.match(s.ruby, /^[぀-ゟ]+$/, `${w.word}: "${s.ruby}" is not kana`);
          else assert.doesNotMatch(s.text, /[一-鿿]/, `${w.word}: "${s.text}" is kanji with no reading over it`);
        }
      }
    }
  });

  it("gives every word a reading, on a spread of common kanji", () => {
    const bare: string[] = [];
    for (const glyph of new Set(["日", "人", "大", "生", "面", "今", "一", "時", "出", "行"])) {
      for (const r of readingsOf(glyph)) for (const w of r.words) if (!w.sound.some((s) => s.ruby)) bare.push(`${glyph}/${r.reading}/${w.word}`);
    }
    assert.deepEqual(bare, []);
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

  // SAK-481: 13 sentences with their kanji bare. The readings are the ones the
  // "In a sentence" block has for the same sentences.
  it("prints the furigana over every kanji in its sentences, and still picks out the particle", () => {
    const t = table();
    assert.ok(t);
    const KANJI = /[一-鿿㐀-䶿々]/;
    PARTICLE_ROWS.forEach((p, i) => {
      const line = t.rows[i][2];
      if (!p.example) return;
      assert.equal(cell(line), p.example.jp, `${p.particle}: the runs do not spell the sentence`);
      const bare = line.filter((r) => !r.ruby && KANJI.test(r.text)).map((r) => r.text);
      assert.deepEqual(bare, [], `${p.particle}: ${p.example.jp} has kanji with no reading over it`);
      // しか〜ない is two pieces with a word between them and is never marked
      if (p.example.jp.includes(p.particle)) assert.ok(line.some((r) => r.accent && r.text === p.particle), `${p.particle} is not picked out in ${p.example.jp}`);
    });
    const wa = t.rows[PARTICLE_ROWS.findIndex((p) => p.particle === "は")][2];
    assert.deepEqual(wa.filter((r) => r.ruby).map((r) => [r.text, r.ruby]), [["私", "わたし"], ["学", "がく"], ["生", "せい"]]);
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

// Sam, 2026-09-25: the "In a sentence" block printed 私は学生です with no
// furigana. The readings come from src/data/sentence-readings.ts, generated
// for every sentence the block can show.
describe("the In a sentence block prints furigana over its kanji", () => {
  it("reads 私は学生です over its kanji and keeps the pattern in the accent", () => {
    const wa = recipeById("wa");
    assert.ok(wa, "no recipe wa");
    const line = pageFromIntro(autoPatternPage(wa)).examples?.[0]?.japanese;
    assert.ok(line, "the は page has no sentence");
    assert.equal(line.map((r) => r.text).join(""), "私は学生です。");
    const pattern = line.find((r) => r.active);
    assert.equal(pattern?.text, "は");
    assert.equal(pattern?.sound, undefined, "the pattern is kana and takes no reading");
    const ruby = line.flatMap((r) => r.sound ?? []).filter((s) => s.ruby).map((s) => [s.text, s.ruby]);
    assert.deepEqual(ruby, [["私", "わたし"], ["学", "がく"], ["生", "せい"]]);
  });

  it("has a reading row for every sentence the block can show", () => {
    const shown = new Set<string>();
    for (const r of RECIPES) {
      const ex = sentenceExampleFor(r);
      if (ex) shown.add(ex.jp);
    }
    for (const g of Object.values(SENTENCE_ORDERING_GUIDES)) if (g.example) shown.add(g.example.jp);
    for (const list of Object.values(TIER_EXAMPLES)) for (const ex of list) shown.add(ex.jp);
    const missing = [...shown].filter((jp) => !hasSentenceReadings(jp));
    assert.deepEqual(missing, [], "rerun scripts/build-sentence-readings.ts and scripts/ingest/teach_sentence_readings.py");
  });

  // every Japanese line the block shows, from every page that has the block
  const shownLines = () => {
    const lines: Array<{ jp: string; line: PartedSentence }> = [];
    for (const r of RECIPES) {
      const line = pageFromIntro(autoPatternPage(r)).examples?.[0]?.japanese;
      if (line) lines.push({ jp: line.map((run) => run.text).join(""), line });
    }
    // every pattern claimed, so every type's page shows every example
    const history = emptyHistory();
    for (const r of RECIPES) {
      const entry = libEntry(patternEntry(r.id));
      if (entry) for (const f of knownFactsOf(entry)) history.claims = { ...history.claims, [f]: NOW };
    }
    for (const tier of Object.keys(SENTENCE_ORDERING_GUIDES)) {
      for (const page of atlasEntryFromHistory(history, `writing-rule:sentence-rule-${tier}`, NOW)?.teach?.pages ?? []) {
        for (const ex of page.examples ?? []) lines.push({ jp: ex.japanese.map((run) => run.text).join(""), line: ex.japanese });
      }
    }
    return lines;
  };
  const KANJI = /[一-鿿㐀-䶿々]/;

  it("puts kana over kanji and nothing else, and every part still spells its text", () => {
    for (const { jp, line } of shownLines()) {
      for (const run of line) {
        if (!run.sound) continue;
        assert.equal(run.sound.map((s) => s.text).join(""), run.text, `${jp}: a part's readings do not spell it`);
        for (const s of run.sound.filter((s) => s.ruby)) {
          assert.match(s.text, /^[一-鿿㐀-䶿々]+$/, `${jp}: "${s.text}" is not kanji and has a reading over it`);
          assert.match(s.ruby!, /^[぀-ゟ]+$/, `${jp}: "${s.ruby}" is not kana`);
        }
      }
    }
  });

  // Coordinator review, 2026-09-25: a kanji the readings pass could not read
  // used to print bare. None may now: a new sentence, or a regenerated file,
  // that leaves one without its reading fails here.
  it("leaves no kanji without a reading, in the file or on the page", () => {
    for (const { jp, line } of shownLines()) {
      const slots = sentenceSlots(jp);
      assert.ok(slots, `${jp} has no readings row`);
      assert.ok(slots.every((slot) => slot), `${jp} has a kanji the readings pass left without a reading`);
      for (const run of line) {
        const bare = (run.sound ?? [{ text: run.text }]).filter((s) => !s.ruby && KANJI.test(s.text));
        assert.deepEqual(bare.map((s) => s.text), [], `${jp}: kanji printed with no reading over it`);
      }
    }
  });

  it("prints a jukujikun as one reading over the whole word", () => {
    for (const [jp, word, ruby] of [["今日は暑いですね。", "今日", "きょう"], ["明日は休みだって。", "明日", "あした"], ["静かな部屋で休みたい。", "部屋", "へや"]] as const) {
      const runs = sentenceRuby(jp);
      assert.ok(runs?.some((s) => s.text === word && s.ruby === ruby), `${jp}: ${word} is not read ${ruby} as one word`);
    }
  });
});

// ===========================================================================
// SAK-483: a verb or adjective card's forms tables have furigana.
//
// Every cell under "Written" printed bare: 食べます, 食べさせられる,
// 大きくなかった. Each form is now built from the word's kana as well, and the
// kanji before the kana the form adds take their readings from the word's
// alignment.
// ===========================================================================
describe("a word card's forms tables", () => {
  const cellsOf = (glyph: string) => (atlasEntryFromHistory(emptyHistory(), `word:${glyph}`, NOW)?.teach?.tables ?? []).flatMap((t) => t.rows.map((r) => r[1]));
  const cellFor = (glyph: string, written: string) => cellsOf(glyph).find((c) => c.map((s) => s.text).join("") === written);

  it("puts た over 食 and leaves the kana the form adds plain", () => {
    assert.deepEqual(cellFor("食べる", "食べさせられる"), [{ text: "食", ruby: "た" }, { text: "べさせられる" }]);
    assert.deepEqual(cellFor("大きい", "大きくなかった"), [{ text: "大", ruby: "おお" }, { text: "きくなかった" }]);
  });

  it("gives every form of 食べる, 言う, 大きい and 汚れる its reading, over the kanji only", () => {
    for (const glyph of ["食べる", "言う", "大きい", "汚れる"]) {
      const cells = cellsOf(glyph);
      assert.ok(cells.length >= 10, `${glyph} has ${cells.length} forms`);
      for (const cell of cells) {
        const written = cell.map((s) => s.text).join("");
        assert.ok(cell.some((s) => s.ruby), `${glyph}: ${written} has no reading`);
        for (const s of cell) {
          if (s.ruby) assert.match(s.ruby, /^[぀-ゟ]+$/, `${written}: "${s.ruby}" is not kana`);
          else assert.doesNotMatch(s.text, /[一-鿿]/, `${written}: "${s.text}" is kanji with no reading over it`);
        }
      }
    }
  });

  it("reads a kanji between kana from the alignment, 申 and 込 in 申し込む", () => {
    assert.deepEqual(cellFor("申し込む", "申し込みます"), [{ text: "申", ruby: "もう" }, { text: "し" }, { text: "込", ruby: "こ" }, { text: "みます" }]);
  });

  it("gives 来 what it says in each form of 来る", () => {
    assert.deepEqual(cellFor("来る", "来ない"), [{ text: "来", ruby: "こ" }, { text: "ない" }]);
    assert.deepEqual(cellFor("来る", "来ます"), [{ text: "来", ruby: "き" }, { text: "ます" }]);
  });

  it("puts one reading over the whole stem of a word that does not split by kanji", () => {
    assert.deepEqual(cellFor("真似る", "真似ます"), [{ text: "真似", ruby: "まね" }, { text: "ます" }]);
  });
});

// ===========================================================================
// SAK-483: the word chips on a kanji or radical card carry their readings.
// ===========================================================================
describe("the word chips on a kanji card", () => {
  it("give every word written with 日 its reading", () => {
    const group = atlasEntryFromHistory(emptyHistory(), "kanji:日", NOW)?.related.find((g) => g.title === "Words written with it");
    assert.ok(group, "日 has no Words written with it group");
    const bare = group.items.filter((w) => !chipReading(w)).map((w) => w.glyph);
    assert.deepEqual(bare, []);
    const kyou = group.items.find((w) => w.glyph === "今日");
    if (kyou) assert.equal(chipReading(kyou), "きょう");
  });

  it("leave the kanji chips on a radical card as they are", () => {
    const group = atlasEntryFromHistory(emptyHistory(), "radical:日", NOW)?.related.find((g) => g.title === "Kanji written with it");
    assert.ok(group?.items.length, "the 日 radical has no Kanji written with it group");
    for (const k of group.items) assert.equal(chipReading(k), undefined, `${k.glyph} has a reading on its chip`);
  });
});

// SAK-484: six places whose Japanese had no readings anywhere in the data.
describe("furigana where the readings had to be written", () => {
  const KANJI = /[一-鿿㐀-䶿々]/;
  const entry = (id: string) => atlasEntryFromHistory(emptyHistory(), id, NOW)?.teach;
  const rubyOf = (line: SoundLine) => line.filter((r) => r.ruby).map((r) => [r.text, r.ruby]);
  /** The runs of kanji on a line with nothing over them. */
  const bareIn = (line: SoundLine, plainOnPurpose: ReadonlySet<string> = new Set()) =>
    line.filter((r) => !r.ruby && KANJI.test(r.text)).flatMap((r) => kanjiRunsIn(r.text)).filter((run) => !plainOnPurpose.has(run));
  /** Every line of prose and every table cell on a set of pages. */
  const linesOf = (pages: readonly TeachPage[]): SoundLine[] => pages.flatMap((p) => [
    ...[...p.paragraphs, ...(p.after ?? [])].map((para) => para.runs ?? [{ text: para.text }]),
    ...(p.tables ?? []).flatMap((t) => t.rows.flat()),
  ]);

  it("leaves no reading slot empty anywhere in the readings file", () => {
    const empty = Object.entries(readingsJson as Record<string, ReadonlyArray<unknown>>).filter(([, slots]) => slots.some((s) => !s)).map(([jp]) => jp);
    assert.deepEqual(empty, []);
  });

  describe("a particle's page, the Japanese inside its prose", () => {
    const pages = RECIPES.flatMap((r) => (PARTICLE_NOTES.some((n) => n.recipes.includes(r.id)) ? entry(patternEntry(r.id))?.pages ?? [] : []));
    const paras = pages.flatMap((p) => p.paragraphs);

    it("reads a word from the vocabulary and a sentence from the readings pass", () => {
      const said = new Set(paras.flatMap((p) => p.runs ?? []).filter((r) => r.ruby).map((r) => `${r.text}${r.ruby}`));
      for (const pair of ["食た", "飲の", "猫ねこ", "好す", "田た", "中なか", "来き", "学がっ", "校こう", "歩ある", "水みず", "安やす", "部屋へや", "誰だれ", "今日きょう"]) assert.ok(said.has(pair), `no ${pair} on a particle page`);
    });

    it("leaves no kanji in its prose without a reading, and keeps the prose word for word", () => {
      assert.ok(paras.length > 0);
      for (const para of paras) {
        assert.deepEqual(bareIn(para.runs ?? [{ text: para.text }]), [], para.text);
        if (para.runs) assert.equal(para.runs.map((r) => r.text).join(""), para.text);
      }
    });
  });

  describe("the Family table", () => {
    const cells = RECIPES.filter((r) => r.cluster)
      .flatMap((r) => entry(patternEntry(r.id))?.pages?.filter((p) => p.eyebrow === "Family") ?? [])
      .flatMap((p) => p.tables?.[0]?.rows.flat() ?? []);

    it("reads 行くから and 本は", () => {
      const find = (text: string) => cells.find((c) => c.map((r) => r.text).join("") === text);
      assert.deepEqual(rubyOf(find("行くから")!), [["行", "い"]]);
      assert.deepEqual(rubyOf(find("本は")!), [["本", "ほん"]]);
    });

    it("leaves no kanji in a pattern or a built form without a reading", () => {
      assert.ok(cells.length > 0);
      for (const cell of cells) assert.deepEqual(bareIn(cell), [], cell.map((r) => r.text).join(""));
    });
  });

  describe("a term's page", () => {
    const ids = [...TERMS.map((t) => termEntry(t.id)), ...MARKS.map((m) => markEntry(m.id)), ...GRAMMAR_CONCEPTS.map((c) => grammarConceptEntry(c.id))];
    const cards = [...TERMS.flatMap((t) => t.cards ?? []), ...MARKS.flatMap((m) => m.intros), ...GRAMMAR_CONCEPTS.flatMap((c) => c.cards)];
    const plainOnPurpose = new Set(cards.flatMap((c) => Object.entries(c.readings ?? {}).filter(([, r]) => r === null).map(([run]) => run)));
    const rubyOn = (id: string) => linesOf(entry(id)?.pages ?? []).flatMap(rubyOf);

    it("puts ときどき over 時々, ひとびと over 人々, and とき over each 時 of 時 + 時", () => {
      const ruby = rubyOn(markEntry("iteration-mark"));
      for (const [text, reading] of [["時々", "ときどき"], ["人々", "ひとびと"], ["時", "とき"]]) assert.ok(ruby.some(([t, r]) => t === text && r === reading), `${text} ${reading}`);
    });

    it("reads 生きる and 生まれる on Okurigana, 高い and 嫌い on Keiyōshi, 水 on Radical", () => {
      const has = (id: string, text: string, reading: string) => assert.ok(rubyOn(id).some(([t, r]) => t === text && r === reading), `${id}: ${text} ${reading}`);
      has(termEntry("okurigana"), "生", "い");
      has(termEntry("okurigana"), "生", "う");
      has(grammarConceptEntry("adjective-types"), "高", "たか");
      has(grammarConceptEntry("adjective-types"), "嫌", "きら");
      has(termEntry("radical"), "水", "みず");
    });

    it("reads a term's own definition: 人 counting people is にん", () => {
      const notes = entry(termEntry("counter"))?.notes ?? [];
      assert.deepEqual(notes.flatMap((n) => (typeof n === "string" ? [] : rubyOf(n))), [["本", "ほん"], ["人", "にん"]]);
    });

    it("leaves no kanji without a reading except the ones written plain on purpose", () => {
      for (const id of ids) {
        const t = entry(id);
        const lines = [...linesOf(t?.pages ?? []), ...(t?.notes ?? []).map((n) => (typeof n === "string" ? [{ text: n }] : n))];
        for (const line of lines) assert.deepEqual(bareIn(line, plainOnPurpose), [], `${id}: ${line.map((r) => r.text).join("")}`);
      }
    });

    it("writes each reading so it lines up with its run, and only for runs the card has", () => {
      for (const card of cards) {
        const text = [...card.body.map((p) => p.text), ...(card.examples ?? []).flatMap((e) => [e.from, e.to, e.gloss ?? ""])].join("\n");
        for (const [run, reading] of Object.entries(card.readings ?? {})) {
          assert.ok(kanjiRunsIn(text).includes(run), `${card.id}: ${run} is not in the card`);
          if (reading) assert.ok(rubyFromReading(run, reading), `${card.id}: ${reading} does not line up with ${run}`);
        }
      }
    });
  });

  describe("a verb pair's example sentences", () => {
    const active = (line: PartedSentence) => line.find((r) => r.active)!;

    it("reads お金 and the verb, the verb still the part picked out", () => {
      const forms = entry("transitivity:出る/出す")?.forms ?? [];
      assert.equal(forms.length, 2);
      const [happens, doIt] = forms.map((f) => f.example!);
      assert.deepEqual(happens.flatMap((r) => rubyOf(r.sound ?? [])), [["金", "かね"], ["出", "で"]]);
      assert.deepEqual(rubyOf(active(happens).sound!), [["出", "で"]]);
      assert.deepEqual(rubyOf(active(doIt).sound!), [["出", "だ"]]);
      assert.equal(active(doIt).text, "出した");
    });

    it("has every example sentence the pairs have in the readings file", () => {
      for (const pair of VERB_PAIRS) for (const side of [pair.happens, pair.doIt]) {
        if (side.example) assert.ok(sentenceSlots(side.example.jp)?.every(Boolean), side.example.jp);
      }
    });
  });

  describe("a kanji's origin, where it names a piece for its sound", () => {
    const origin = (glyph: string) => entry(`kanji:${glyph}`)?.etymology ?? [];

    it("puts the piece's on'yomi over it when no reading follows: 丁 on 可", () => {
      assert.deepEqual(rubyOf(origin("可")), [["丁", "ちょう"]]);
      assert.equal(origin("可").map((r) => r.text).join(""), etymologyOf("可")?.originText);
    });

    it("picks the on'yomi closest to the kanji's own: 主 on 住 is しゅう", () => {
      assert.deepEqual(rubyOf(origin("住")), [["主", "しゅう"]]);
    });

    it("leaves a piece alone when its reading is already written, and a piece named for its meaning", () => {
      assert.deepEqual(rubyOf(origin("仕")), []);
      assert.ok(!rubyOf(origin("住")).some(([t]) => t === "人"));
    });
  });
});
