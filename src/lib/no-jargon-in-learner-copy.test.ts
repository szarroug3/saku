// SAK-443: a learner's words, not a linguist's.
//
// Sam, reading いいえ's contrast note on the word page: "'gloss' is jargon.
// say 'mean' instead". The note said the two words "both gloss as no", which
// is how a dictionary editor says it and not how anyone else does. The word
// was in the copy because it is everywhere in the code around it: a vocabulary
// row has `glosses`, a mnemonic's example has a `gloss`, and the field name
// walked into a sentence a learner reads.
//
// So this gate separates the two. A `gloss` FIELD is fine and is not touched
// here: this reads only the strings, template literals and JSX text of the
// trees a learner reads, which is where the word is wrong. Comments are not
// in the syntax this walks, so an engineering note can go on using whatever
// word is exact.
//
// SCOPE. src/data/word-contrast-notes.ts, the hand-authored prose SAK-443 was
// filed against, plus src/sky and src/app/(sky), the two trees the redesign is
// written in, plus the authored prose files under src/data that a learner
// reads word for word (SAK-452). Their own test files are left out: an
// `it("...glosses...")` title is written to another engineer. src/data/grammar
// is covered file by file rather than whole, because recipes.ts and corpus.ts
// carry engineering notes in string fields, where "lemma" is the exact word.
//
// NOT A DICTIONARY. Every word banned here is one Sam named and one a sweep of
// the whole app now finds nowhere, so the list can only be added to
// deliberately. SAK-452 read the copy rather than grepping it, and the words
// that need reading ("sits", "carries", "leans") are deliberately NOT here: a
// cup sits steaming in a mnemonic, and a rule that cannot tell that from "the
// reading sits in the word" would be worse than no rule.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

/** The trees and files whose learner-facing strings are covered. */
const COVERED = [
  "src/sky",
  "src/app/(sky)",
  "src/data/word-contrast-notes.ts",
  // the authored prose a learner reads: the explainers, the term pages, the
  // track and phase intros, and the hand-written notes on the item pages
  "src/data/attribution.ts",
  "src/data/characters.ts",
  "src/data/counter-categories.ts",
  "src/data/counters.ts",
  "src/data/dakuten-rows.ts",
  "src/data/day-month-construction.ts",
  "src/data/grammar-concepts.ts",
  "src/data/grammar/clusters.ts",
  "src/data/grammar/form-intros.ts",
  "src/data/grammar/lessons.ts",
  "src/data/how-it-works.ts",
  "src/data/kana-context.ts",
  "src/data/keigo.ts",
  "src/data/marks.ts",
  "src/data/mnemonics.ts",
  "src/data/number-construction.ts",
  "src/data/phase-intros.ts",
  "src/data/radical-tips.ts",
  "src/data/resources.ts",
  "src/data/sentence-ordering-guides.ts",
  "src/data/terms.ts",
  "src/data/track-intros.ts",
  "src/data/transitivity.ts",
  "src/data/why.ts",
  "src/data/yoon-rows.ts",
];

/** A banned word, and what to write instead. Each one is quoted from the copy
 * it was found in, so the next reader can see it was a real sentence. */
const BANNED: ReadonlyArray<{ readonly word: RegExp; readonly say: string }> = [
  // "both gloss as no" (SAK-443), on いいえ's contrast note
  { word: /\bgloss(es|ed|ing)?\b/i, say: 'say "mean", "means" or "meaning"' },
  // a dictionary's word for a dictionary's headword
  { word: /\blemmas?\b/i, say: 'say "the word itself"' },
  // "some morae are said high, some low" (SAK-452), on the pitch intro
  { word: /\bmorae\b/i, say: 'say "beats"' },
  { word: /\bparadigms?\b/i, say: 'say "the set of forms"' },
  { word: /\bsurface forms?\b/i, say: 'say "how it is written"' },
  // "'land' is also jargon. maybe say 'be blunt or childish'" (Sam)
  { word: /\blands? as\b/i, say: 'say "is" or "sounds"' },
  // "Asked once you have met such a word." (SAK-452), in Practice
  { word: /\b(meet it|have met|you will meet)\b/i, say: 'say "see", "seen" or "learn"' },
  // "It comes in two registers" (SAK-452), on the keigo term page
  { word: /\bregisters?\b/i, say: 'say "levels", "kinds" or "forms"' },
  { word: /\bdistractors?\b/i, say: 'say "the other choices"' },
];

/** `file:text` for the few places a banned word is right. Nothing here is
 * prose: they are an id, and the search keywords that let someone who met the
 * word elsewhere find the page that explains it. */
const ALLOWED = new Set([
  // the Terms page FOR mora, which is where the word is taught
  "src/data/terms.ts:morae",
  // the keigo concept's id, and the keyword that finds it
  "src/data/grammar-concepts.ts:keigo-registers",
  "src/data/grammar-concepts.ts:registers",
  "src/app/(sky)/atlas.ts:keigo-registers",
]);

const SOURCE = /\.tsx?$/;
const TEST = /\.test\.tsx?$/;

function filesUnder(rel: string): string[] {
  const full = path.join(REPO_ROOT, rel);
  if (statSync(full).isFile()) return [rel];
  return readdirSync(full, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? filesUnder(path.join(rel, e.name))
      : SOURCE.test(e.name) && !TEST.test(e.name)
        ? [path.join(rel, e.name)]
        : [],
  );
}

/** Every piece of text a file would put on a screen: string literals, the
 * written parts of template literals, and JSX text. */
function copyIn(file: string): ReadonlyArray<{ readonly line: number; readonly text: string }> {
  const source = ts.createSourceFile(file, readFileSync(path.join(REPO_ROOT, file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Array<{ line: number; text: string }> = [];
  const visit = (node: ts.Node) => {
    const text = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)
      ? node.text
      : null;
    if (text !== null) found.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("no linguist's jargon in what a learner reads (SAK-443, SAK-452)", () => {
  test("nothing a learner reads uses a word out of a linguistics paper", () => {
    const files = [...new Set(COVERED.flatMap(filesUnder))];
    // a walk that found nothing would pass this test without reading a word,
    // and the parentheses in src/app/(sky) are exactly the kind of thing that
    // quietly breaks one
    assert.ok(files.length > 100, `only ${files.length} files swept, so the walk is broken`);
    assert.ok(files.some((f) => f.startsWith("src/app/(sky)")), "the (sky) routes were not swept");
    assert.ok(files.includes("src/data/how-it-works.ts"), "the explainers were not swept");

    const hits = files.flatMap((file) =>
      copyIn(file).flatMap(({ line, text }) =>
        ALLOWED.has(`${file}:${text.trim()}`)
          ? []
          : BANNED.filter(({ word }) => word.test(text)).map(({ say }) => `${file}:${line}: ${text.trim()}\n  -> ${say}`),
      ),
    );

    assert.deepEqual(
      hits,
      [],
      `a linguist's word found in copy a learner reads (SAK-443, SAK-452):\n${hits.join("\n")}\n\n` +
        "A field may keep its name; the sentence may not.",
    );
  });

  test("it can tell a sentence from a field name, so the gate is worth having", () => {
    // the shape of the thing being guarded against, and the shape that is fine
    const sample = 'const x = { gloss: row.gloss };\nconst note = "both gloss as no";\n';
    const file = ts.createSourceFile("sample.ts", sample, ts.ScriptTarget.Latest, true);
    const strings: string[] = [];
    const visit = (node: ts.Node) => { if (ts.isStringLiteral(node)) strings.push(node.text); ts.forEachChild(node, visit); };
    visit(file);
    assert.deepEqual(strings, ["both gloss as no"]);
    assert.ok(strings.every((s) => BANNED.some(({ word }) => word.test(s))));
  });

  test("every banned word is one the copy no longer uses, and the allowlist is spent on real places", () => {
    // a rule nobody can state is a rule nobody can follow: each one says what
    // to write instead, so the failure above is a fix rather than a puzzle
    for (const { word, say } of BANNED) assert.match(say, /^say /, `${word} has no replacement to offer`);
    // and an allowlist entry that matches nothing is a stale exception quietly
    // widening the gate
    const seen = new Set(
      [...new Set(COVERED.flatMap(filesUnder))].flatMap((file) => copyIn(file).map(({ text }) => `${file}:${text.trim()}`)),
    );
    const stale = [...ALLOWED].filter((entry) => !seen.has(entry));
    assert.deepEqual(stale, [], `allowlisted text that is no longer in the copy:\n${stale.join("\n")}`);
  });
});
