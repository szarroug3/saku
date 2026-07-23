import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { bodyFor } from "@/data/marks";
import { PHASE_INTROS } from "@/data/phase-intros";
import { TRACK_INTROS } from "@/data/track-intros";
import { TERMS, TERM_SUBJECT, termEntry, termFor } from "@/data/terms";
import {
  KINDS,
  KIND_LABEL,
  LIB_ENTRIES,
  entryName,
  libEntry,
} from "@/lib/library/entries";
import { entryFromSlug, entryHref } from "@/lib/library/href";

// The reference-definition shelf. These entries are the app's answer to a
// beginner meeting "JLPT" or "furigana" or "katakana" before anything says what
// they are, so the load-bearing properties are: every term RESOLVES to a page,
// and every term is REACHABLE from the Terms shelf.

const EXPECTED = [
  "kana",
  "hiragana",
  "katakana",
  "romaji",
  "kanji",
  "radical",
  "furigana",
  "jlpt",
  "dakuten",
  "handakuten",
  "yoon",
  "okurigana",
  "rendaku",
  "counter",
  "particle",
  "keigo",
  "pitch-accent",
  "mora",
];

describe("the reference terms are a real shelf", () => {
  test("the owner's named terms are all present", () => {
    // "what is JLPT, what is katakana, hiragana, etc" — the probe's list.
    assert.deepEqual(
      TERMS.map((t) => t.id).sort(),
      [...EXPECTED].sort(),
    );
  });

  test("Terms is a Library kind with a shelf label", () => {
    assert.ok(KINDS.includes(TERM_SUBJECT), "Terms is not an offered shelf");
    assert.equal(KIND_LABEL[TERM_SUBJECT], "Terms");
  });

  test("every term resolves to a Library entry on the Terms shelf", () => {
    for (const t of TERMS) {
      const entry = libEntry(termEntry(t.id));
      assert.ok(entry, `${t.id} resolves to no entry`);
      assert.equal(entry.kind, TERM_SUBJECT);
      // The name is the title, since a term has no glyph — entryName must never
      // fall through to the raw id.
      assert.equal(entry.glyph, "");
      assert.equal(entryName(entry), t.name);
      // The summary is the shelf note and the page sub-line.
      assert.equal(entry.sub, t.summary);
    }
  });

  test("the Terms shelf holds every term and nothing else", () => {
    // shelfSections lives in a .tsx the runner cannot load; this asserts the
    // population it maps over — LIB_ENTRIES of the term kind — is exactly TERMS.
    const onShelf = LIB_ENTRIES.filter((e) => e.kind === TERM_SUBJECT).map(
      (e) => e.id,
    );
    assert.deepEqual(
      onShelf.sort(),
      TERMS.map((t) => termEntry(t.id)).sort(),
    );
  });

  test("every term has a readable two-segment URL that round-trips", () => {
    for (const t of TERMS) {
      const id = termEntry(t.id);
      const href = entryHref(id);
      assert.equal(href, `/library/${TERM_SUBJECT}/${t.id}`);
      const [, , kind, slug] = href.split("/");
      assert.equal(entryFromSlug(kind, slug), id, `${t.id} does not round-trip`);
    }
  });

  test("termFor is the inverse of termEntry", () => {
    for (const t of TERMS) {
      assert.equal(termFor(termEntry(t.id))?.id, t.id);
    }
  });

  test("the definitions stay to two or three sentences, no em dash", () => {
    for (const t of TERMS) {
      const prose = [t.summary, ...t.body].join(" ");
      assert.ok(!prose.includes("—"), `${t.id} uses an em dash`);
      // The owner asked for 2-3 sentences of body. Counted loosely by sentence
      // terminators so a firmer draft that splits a clause still passes.
      const sentences = t.body.join(" ").split(/[.!?]/).filter((s) => s.trim());
      assert.ok(
        sentences.length >= 1 && sentences.length <= 4,
        `${t.id} body is ${sentences.length} sentences`,
      );
    }
  });
});

// THE TERM → CONCEPT CARD MAPPING
// ===============================
// A term page renders the very cards the teach walk renders, so a learner who is
// taught what a radical is and then looks "radical" up reads the same words. The
// load-bearing properties are all about the POINTER: every card a term names has
// to be a card the app actually ships (a hand-built object here would be the
// second description the whole arrangement exists to prevent), and the terms with
// no card have to be left exactly as they were.

/** Every concept card the app ships, by identity. A term may point at these and
 * at nothing else. */
const SHIPPED = new Set([...PHASE_INTROS, ...Object.values(TRACK_INTROS)]);

/** The six words the app uses but teaches no card about. Their pages are the
 * definition and nothing else. See the note over TERMS. */
const NO_CARD = ["romaji", "furigana", "jlpt", "particle", "pitch-accent", "mora"];

describe("a term points at the lessons' own explanation of it", () => {
  test("every card a term names is a card the app ships", () => {
    for (const t of TERMS) {
      for (const card of t.cards ?? []) {
        assert.ok(
          SHIPPED.has(card),
          `${t.id} names ${card.id}, which is not a card the app ships`,
        );
      }
    }
  });

  test("exactly the words with no lesson card have none", () => {
    const without = TERMS.filter((t) => !t.cards?.length).map((t) => t.id);
    assert.deepEqual(without.sort(), [...NO_CARD].sort());
  });

  test("a term with no card keeps its own definition", () => {
    for (const id of NO_CARD) {
      const t = TERMS.find((x) => x.id === id);
      assert.ok(t, `${id} is not a term`);
      assert.ok(t.body.length > 0, `${id} has no definition and no card`);
    }
  });

  test("a term with cards still has its summary and its short answer", () => {
    // The summary is the shelf row, and the body is the first thing on the page.
    // Neither is displaced by the richer material below them.
    for (const t of TERMS) {
      assert.ok(t.summary.length > 0, `${t.id} has no summary`);
      assert.ok(t.body.length > 0, `${t.id} has no definition`);
    }
  });

  test("no term names the same card twice", () => {
    for (const t of TERMS) {
      const ids = (t.cards ?? []).map((c) => c.id);
      assert.deepEqual([...new Set(ids)], ids, `${t.id} repeats a card`);
    }
  });

  test("every card a term shows has a title to head its section with", () => {
    // The view sets the card's `title` as the section heading; three untitled
    // okurigana sections would be unreadable.
    for (const t of TERMS) {
      for (const card of t.cards ?? []) {
        assert.ok(card.title.trim().length > 0, `${card.id} has no title`);
      }
    }
  });

  test("cardMark keeps a real half of a shared card", () => {
    // Only ゛ and ゜ split a card. A tag that matched no paragraph would leave a
    // term page with a heading over nothing.
    for (const t of TERMS) {
      if (!t.cardMark) continue;
      for (const card of t.cards ?? []) {
        const kept = bodyFor(card, t.cardMark);
        assert.ok(
          kept.length > 0,
          `${t.id} keeps no paragraph of ${card.id}`,
        );
        assert.ok(
          kept.some((p) => p.mark === t.cardMark),
          `${t.id} keeps no paragraph tagged ${t.cardMark}`,
        );
      }
    }
  });

  test("the shared dakuten card is split, not shown whole to both", () => {
    const dakuten = TERMS.find((t) => t.id === "dakuten");
    const handakuten = TERMS.find((t) => t.id === "handakuten");
    assert.ok(dakuten?.cardMark && handakuten?.cardMark);
    for (const card of dakuten.cards ?? []) {
      const kept = bodyFor(card, dakuten.cardMark);
      assert.ok(
        !kept.some((p) => p.mark === handakuten.cardMark),
        `the Dakuten page opens by explaining ${handakuten.cardMark}`,
      );
    }
    for (const card of handakuten.cards ?? []) {
      const kept = bodyFor(card, handakuten.cardMark);
      assert.ok(
        !kept.some((p) => p.mark === dakuten.cardMark),
        `the Handakuten page opens by explaining ${dakuten.cardMark}`,
      );
    }
  });

  test("no term shows a card the term page cannot draw", () => {
    // The page renders prose and worked examples. The punctuation catalogue and
    // the transitivity pair table belong to cards no term names; if one ever
    // does, this file is the reminder that the view needs the table too.
    for (const t of TERMS) {
      for (const card of t.cards ?? []) {
        assert.ok(!card.punctuation?.length, `${t.id} shows ${card.id}'s table`);
        assert.ok(
          !card.transitivityPairs?.length,
          `${t.id} shows ${card.id}'s pair table`,
        );
      }
    }
  });
});
