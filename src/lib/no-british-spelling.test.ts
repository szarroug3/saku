// AMERICAN SPELLING, EVERYWHERE WE WRITE (SAK-433)
// ================================================
// Sam's rule, from the review of 2026-09-12: "american spelling always." One
// sweep converted 841 of them, in user-facing copy, comments, READMEs, docs,
// identifiers and data field names alike, and this is the gate that keeps them
// converted. It sits beside the em-dash test because it is the same kind of
// rule: a house style that a one-time sweep cannot hold on its own, since the
// next person to write "colour" will not know it was ever swept.
//
// It reads the files as text, the way the em-dash test's second half does. A
// comment, a doc block, an identifier and a line of README are all just
// characters, and a spelling is either there or it is not.
//
// THE TREES are the union of the two the em-dash test covers: src/data and the
// two a learner reads (src/app/(sky), src/sky), which is the ESLint rule's
// scope, plus e2e and the two READMEs, which is the text test's. src/lib's own
// comments are not in it for the same reason they are not in the em-dash one:
// they carry hundreds from before the rule, sweeping them is its own job, and
// a gate nobody can get to zero teaches people to skip it. What IS in src/lib
// is this file.
//
// NOT COVERED, on purpose: src/data/generated. JMdict's glosses, Wiktionary's
// etymologies and WordNet's synonym pool are other people's words, and
// "behaviour" in a dictionary definition is the dictionary's spelling, not
// ours. The two strings in there that ARE ours (a grammar-ingest reason in
// grammar-corpus-meta.json, a generator header in radical-enrichment.json) were
// converted by hand alongside the scripts that write them.
//
// NOT ON THE LIST, also on purpose:
//   analysis, analyses        the noun and its plural are spelled this way in
//                             American English; no verb form is in the tree.
//   catalogue, dialogue       Merriam-Webster gives both, and the first is a
//                             file name, an API route and a build script here.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

/**
 * British spelling to American, matched case-insensitively inside a word, so a
 * stem covers what grows off it: "colour" catches colours, coloured, colourful
 * and discolour. Longest first at use, so "centred" beats the "centre" inside
 * it and is not turned into "centerd".
 */
const SPELLINGS: readonly (readonly [string, string])[] = [
  // The three whose British verb shares a prefix with a real English noun
  // (emphasis, parenthesis, synthesis), so only the verb forms are listed.
  ["emphasise", "emphasize"], ["emphasised", "emphasized"], ["emphasises", "emphasizes"], ["emphasising", "emphasizing"],
  ["parenthesise", "parenthesize"], ["parenthesised", "parenthesized"], ["parenthesises", "parenthesizes"], ["parenthesising", "parenthesizing"],
  ["synthesise", "synthesize"], ["synthesised", "synthesized"], ["synthesiser", "synthesizer"], ["synthesising", "synthesizing"],

  // -our
  ["colour", "color"], ["behaviour", "behavior"], ["favour", "favor"],
  ["neighbour", "neighbor"], ["honour", "honor"], ["humour", "humor"],
  ["labour", "labor"], ["flavour", "flavor"], ["rumour", "rumor"],
  ["armour", "armor"], ["vapour", "vapor"], ["odour", "odor"],
  ["savour", "savor"], ["endeavour", "endeavor"], ["vigour", "vigor"],
  ["splendour", "splendor"], ["harbour", "harbor"], ["saviour", "savior"],

  // -re
  ["centred", "centered"], ["centring", "centering"], ["centre", "center"],
  ["metre", "meter"], ["litre", "liter"],

  // -ce where the American writes -se, and practise, which the American does
  // not distinguish from the noun at all.
  ["licence", "license"], ["defence", "defense"], ["offence", "offense"],
  ["pretence", "pretense"], ["practis", "practic"],

  // -ise, -isation, -iser
  ["normalis", "normaliz"], ["memoris", "memoriz"], ["memois", "memoiz"],
  ["recognis", "recogniz"], ["generalis", "generaliz"], ["rasteris", "rasteriz"],
  ["serialis", "serializ"], ["localis", "localiz"], ["summaris", "summariz"],
  ["finalis", "finaliz"], ["randomis", "randomiz"], ["capitalis", "capitaliz"],
  ["initialis", "initializ"], ["centralis", "centraliz"], ["mechanis", "mechaniz"],
  ["stabilis", "stabiliz"], ["standardis", "standardiz"], ["neutralis", "neutraliz"],
  ["singularis", "singulariz"], ["parameteris", "parameteriz"], ["organis", "organiz"],
  ["apologis", "apologiz"], ["tokenis", "tokeniz"], ["romanis", "romaniz"],
  ["optimis", "optimiz"], ["minimis", "minimiz"], ["maximis", "maximiz"],
  ["customis", "customiz"], ["categoris", "categoriz"], ["prioritis", "prioritiz"],
  ["visualis", "visualiz"], ["realis", "realiz"], ["specialis", "specializ"],
  ["characteris", "characteriz"], ["itemis", "itemiz"], ["sanitis", "sanitiz"],
  ["synchronis", "synchroniz"], ["modernis", "moderniz"], ["utilis", "utiliz"],

  // a doubled l before a suffix
  ["labelled", "labeled"], ["labelling", "labeling"],
  ["modelled", "modeled"], ["modelling", "modeling"],
  ["travelled", "traveled"], ["travelling", "traveling"],
  ["cancelled", "canceled"], ["cancelling", "canceling"],
  ["levelled", "leveled"], ["signalled", "signaled"], ["totalled", "totaled"],
  ["marvellous", "marvelous"], ["counsellor", "counselor"],

  // the rest
  ["judgement", "judgment"], ["acknowledgement", "acknowledgment"],
  ["sceptic", "skeptic"], ["storey", "story"], ["mould", "mold"],
  ["plough", "plow"], ["grey", "gray"], ["ageing", "aging"],
  ["whilst", "while"], ["amongst", "among"], ["orientated", "oriented"],
];

/**
 * A stem ending in "is" only counts in front of a suffix that makes it the
 * British verb or the noun off it. Without this the same stem eats a word that
 * is right as it stands: realistic, specialist, optimism, mechanism, organism,
 * modernist, capitalist, finalist.
 */
const IS_SUFFIX = "(?=e|ed|es|ing|er|ers|ation|ations|abl)";

const ORDERED = [...SPELLINGS].sort((a, b) => b[0].length - a[0].length);
const FINDER = new RegExp(
  ORDERED.map(([from]) => (from.endsWith("is") ? from + IS_SUFFIX : from)).join("|"),
  "gi",
);
const AMERICAN = new Map(ORDERED.map(([from, to]) => [from.toLowerCase(), to]));

/**
 * Where a British spelling is the right thing to write, which is only ever
 * because the word is someone else's and not ours: a URL owned by the people
 * who wrote it, a search term a learner might type, or a line quoting a
 * spelling this sweep removed. `text` must appear in the line, and every entry
 * has to still match something, so an allowance cannot outlive its line.
 */
const ALLOWED: readonly { file: string; text: string; why: string }[] = [
  {
    file: "src/data/attribution.ts",
    text: "edrdg.org/edrdg/licence.html",
    why: "EDRDG's own URL. Their path, not our spelling, and rewriting it 404s the one link the license obliges us to show.",
  },
  {
    file: "src/data/terms.ts",
    text: '"romanisation"',
    why: "a search alias: a learner typing the British spelling should still find the Romaji page.",
  },
  {
    file: "src/data/terms.ts",
    text: "romanization\", \"romanisation\"",
    why: "the same alias, in the list beside the American spelling it is an alias for.",
  },
  {
    file: "src/app/(sky)/reading.ts",
    text: 'rewrite "licence" to "license"',
    why: "a comment quoting the spelling the sweep removed, to say what the file no longer does.",
  },
];

const TEXT_FILE = /\.(ts|tsx|mjs|js|md)$/;

/** The trees covered, as the header explains. */
const COVERED = ["src/data", "src/app/(sky)", "src/sky", "e2e", "README.md", "src/sky/README.md"];

function filesUnder(rel: string): string[] {
  const full = path.join(REPO_ROOT, rel);
  if (statSync(full).isFile()) return [rel];
  return readdirSync(full, { withFileTypes: true }).flatMap((e) => {
    const child = path.join(rel, e.name);
    // Other people's words: see the header.
    if (e.isDirectory()) return e.name === "generated" ? [] : filesUnder(child);
    return TEXT_FILE.test(e.name) ? [child] : [];
  });
}

describe("American spelling in the trees we write (SAK-433)", () => {
  const used = new Set<string>();
  const hits: string[] = [];

  for (const file of [...new Set(COVERED.flatMap(filesUnder))]) {
    const lines = readFileSync(path.join(REPO_ROOT, file), "utf8").split("\n");
    lines.forEach((line, i) => {
      const allowed = ALLOWED.filter((a) => a.file === file && line.includes(a.text));
      for (const a of allowed) used.add(`${a.file}|${a.text}`);
      if (allowed.length > 0) return;
      for (const m of line.matchAll(FINDER)) {
        hits.push(`${file}:${i + 1}: "${m[0]}" should be "${AMERICAN.get(m[0].toLowerCase())}" — ${line.trim().slice(0, 100)}`);
      }
    });
  }

  test("nothing in them is spelled the British way", () => {
    assert.deepEqual(
      hits,
      [],
      `British spelling found (house style, Sam 2026-09-12: "american spelling always"; SAK-433):\n${hits.join("\n")}\n\n` +
        "Write the American form. If the word is genuinely someone else's (a URL they own, a search " +
        "term a learner types, a line quoting the old spelling), add it to ALLOWED in this file with " +
        "the reason. Do not widen the trees to get past it.",
    );
  });

  test("every allowance still has a line to allow", () => {
    const stale = ALLOWED.filter((a) => !used.has(`${a.file}|${a.text}`)).map((a) => `${a.file}: ${a.text}`);
    assert.deepEqual(stale, [], `An allowance in ALLOWED matches nothing any more and should go:\n${stale.join("\n")}`);
  });

  test("the map only ever points at an American spelling", () => {
    // A guard on the list itself: an entry whose replacement still contains the
    // British form it replaces would pass every file and fix nothing.
    const wrong = SPELLINGS.filter(([from, to]) => to.toLowerCase().includes(from.toLowerCase()) || from === to);
    assert.deepEqual(wrong, [], "an entry maps a spelling to itself or to something containing it");
  });
});
