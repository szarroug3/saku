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
import { emptyHistory } from "@/lib/history-ops";
import { libEntry } from "@/lib/library/entries";
import type { EntryId } from "@/types";

import { atlasEntryFromHistory } from "./atlas";

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
