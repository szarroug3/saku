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
// written in. Their own test files are left out: an `it("...glosses...")`
// title is written to another engineer.
//
// ONE WORD, NOT A DICTIONARY OF THEM. "gloss" is the one Sam named and the one
// with a field of the same name pulling it into copy. Add another when one
// actually lands in a sentence, with the sentence in the comment.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

/** The trees whose learner-facing strings are covered. */
const COVERED = ["src/data/word-contrast-notes.ts", "src/sky", "src/app/(sky)"];

/** gloss, glosses, glossed, glossing, however it is capitalized. */
const JARGON = /\bgloss(es|ed|ing)?\b/i;

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

describe("no linguist's jargon in what a learner reads (SAK-443)", () => {
  test("nothing a learner reads calls a meaning a gloss", () => {
    const files = [...new Set(COVERED.flatMap(filesUnder))];
    // a walk that found nothing would pass this test without reading a word,
    // and the parentheses in src/app/(sky) are exactly the kind of thing that
    // quietly breaks one
    assert.ok(files.length > 80, `only ${files.length} files swept, so the walk is broken`);
    assert.ok(files.some((f) => f.startsWith("src/app/(sky)")), "the (sky) routes were not swept");

    const hits = files
      .flatMap((file) => copyIn(file).filter(({ text }) => JARGON.test(text)).map(({ line, text }) => `${file}:${line}: ${text.trim()}`));

    assert.deepEqual(
      hits,
      [],
      `"gloss" found in copy a learner reads (SAK-443):\n${hits.join("\n")}\n\n` +
        'Say "mean", "means" or "meaning". The field may keep its name; the sentence may not.',
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
    assert.ok(strings.every((s) => JARGON.test(s)));
  });
});
