// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/substitution.test.ts
//
// Guided substitution grades a production fact through the EXISTING forgiving
// romaji check. These lock the two claims that keep it honest:
//   - the pattern + target verb fixes ONE correct form, and it grades true (in
//     kanji, in kana, and in a romaji spelling of the kana);
//   - the DEMO form shown in the prompt is never itself an accepted answer.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  gradeSubstitution,
  pickSubstitution,
  type SubstitutionItem,
} from "./substitution.ts";
import { VERB_VEHICLES } from "@/lib/grammar/vehicles";
import { wordMeaningFactId } from "@/data/vocab";
import { SETS } from "@/data/characters";
import { toKana } from "@/lib/romaji";
import type { HistoryFile } from "@/types";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A learner who has claimed exactly the verb-vehicle pool, so substitution has
 * two-or-more known verbs to build demo and target from. */
const KNOWN_SURFACES = new Set(VERB_VEHICLES.map((v) => v.surface));
const VERBS_KNOWN: HistoryFile = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(
    [...KNOWN_SURFACES].map((s) => [wordMeaningFactId(s), 1_700_000_000_000]),
  ),
};

const NOBODY: HistoryFile = { sessions: [], facts: {} };

/** hiragana → a round-tripping romaji spelling, off the same table lib/romaji
 * inverts, so a test spelling cannot drift from a typeable one. Copied from
 * grammar-vehicle-romaji.test.ts, whose approach this reuses. */
const ROMAJI: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const set of SETS) {
    if (set.id !== "hiragana") continue;
    for (const section of set.sections) {
      for (const ch of section.chars) {
        const r = ch.r.find((x) => toKana(x) === ch.c);
        if (r) out[ch.c] = r;
      }
    }
  }
  out["ん"] = "n";
  return out;
})();

function spellRomaji(kana: string): string | null {
  let out = "";
  const chars = [...kana];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const next = chars[i + 1];
    const pair = next && "ゃゅょ".includes(next) ? c + next : null;
    if (pair) {
      const r = ROMAJI[pair];
      if (!r) return null;
      out += r;
      i++;
      continue;
    }
    if (c === "っ") {
      const after = chars[i + 1] && ROMAJI[chars[i + 1]];
      if (!after) return null;
      out += after[0];
      continue;
    }
    const r = ROMAJI[c];
    if (!r) return null;
    out += r;
  }
  return out || null;
}

describe("substitution needs known verbs", () => {
  test("a learner who knows nothing gets no item", () => {
    assert.equal(pickSubstitution(NOBODY, seeded(1)), null);
  });

  test("every served verb is in the known set", () => {
    for (let s = 1; s <= 60; s++) {
      const item = pickSubstitution(VERBS_KNOWN, seeded(s));
      if (!item) continue;
      assert.ok(
        KNOWN_SURFACES.has(item.demo.surface),
        `demo ${item.demo.surface} not in known set`,
      );
      assert.ok(
        KNOWN_SURFACES.has(item.target.surface),
        `target ${item.target.surface} not in known set`,
      );
    }
  });
});

describe("one correct form, graded by the existing check", () => {
  test("the target form grades true; the prompt form never does", () => {
    let checked = 0;
    for (let s = 1; s <= 120; s++) {
      const item = pickSubstitution(VERBS_KNOWN, seeded(s)) as SubstitutionItem | null;
      if (!item) continue;
      checked++;
      // demo and target are different verbs with different built forms.
      assert.notEqual(item.demo.form, item.target.form, `seed ${s}: demo==target form`);

      // The one correct answer grades true — kanji form and kana form.
      assert.ok(gradeSubstitution(item, item.target.form), `seed ${s}: kanji form must pass`);
      assert.ok(
        gradeSubstitution(item, item.target.kanaForm),
        `seed ${s}: kana form must pass`,
      );
      // A romaji spelling of the kana form grades true — the task-02 forgiveness.
      const romaji = spellRomaji(item.target.kanaForm);
      if (romaji) {
        assert.ok(
          gradeSubstitution(item, romaji),
          `seed ${s}: romaji ${romaji} for ${item.target.kanaForm} must pass`,
        );
      }

      // THE PROMPT IS NEVER AN ACCEPTED ANSWER. The demo form (食べてから) is what
      // the card SHOWS; typing it back must be wrong.
      assert.equal(
        gradeSubstitution(item, item.demo.form),
        false,
        `seed ${s}: demo form ${item.demo.form} must not be accepted`,
      );
      // The bare target verb (行く) is not the answer either.
      assert.equal(
        gradeSubstitution(item, item.target.surface),
        false,
        `seed ${s}: bare target ${item.target.surface} must not be accepted`,
      );
    }
    assert.ok(checked > 10, `expected many substitution items, checked ${checked}`);
  });
});
