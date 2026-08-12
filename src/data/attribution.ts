// Where the dictionary data comes from, and what saying so requires.
//
// THIS IS A LICENCE OBLIGATION, NOT A CREDITS PAGE
// ================================================
// Every kanji, reading, meaning and word in this app is derived from files
// belonging to the Electronic Dictionary Research and Development Group
// (EDRDG), used under CC BY-SA 4.0. The EDRDG licence is stricter than CC
// BY-SA alone about WHERE the acknowledgement has to appear, and it is strict
// in a way that lands on UI rather than on a LICENSE file:
//
//   - It is not enough to acknowledge in a README, an About box, or a startup
//     screen. The licence rules those out by name.
//   - For an application, the acknowledgement must either appear on each screen
//     that displays the data, OR be reachable from each such screen — a menu
//     item is the example the licence itself gives.
//
// So the obligation is satisfiable two ways, and `SHORT` / `ATTRIBUTION_HREF`
// below exist to satisfy the second, which is the cheaper one: a persistent
// link in the chrome of every screen that shows dictionary data, pointing at a
// dedicated screen that renders `SOURCES` and `LICENCE_NOTE` in full.
//
// This module is the data half of that. It carries no UI on purpose — the
// screen is a separate task — but it exists now, and it is exported now, so
// that the obligation is a thing someone has to consciously delete rather than
// a thing everyone forgets to add. Shipping the data and adding the notice
// later is shipping a licence violation and hoping.
//
// SHARE-ALIKE
// ===========
// CC BY-SA is share-alike: the generated files in src/data/generated/ are
// adaptations of EDRDG's, so they carry the same licence. That is settled and
// not optional — src/data/generated/LICENSE is where it is written down.
//
// It stops at that directory. This code reads those files; it is not derived
// from them, so the two are distributed as a collection rather than combined
// into an adaptation, and share-alike does not reach the code. The app code is
// MIT. /NOTICE is the boundary statement; do not blur it.
//
// Tatoeba is the exception in the other direction: CC BY 2.0 FR, attribution
// only, NO share-alike. grammar-corpus.json is Tatoeba-derived and nothing
// here adds a share-alike condition to it. See the carve-out in
// src/data/generated/LICENSE.

/** One upstream data source and what it gave us. */
export interface Source {
  readonly name: string;
  readonly what: string;
  readonly holder: string;
  readonly licence: string;
  readonly href: string;
}

export const SOURCES: readonly Source[] = [
  {
    name: "KANJIDIC2",
    what: "Kanji meanings, on/kun readings, stroke counts, school grades, and newspaper frequency ranks.",
    holder: "Electronic Dictionary Research and Development Group",
    licence: "CC BY-SA 4.0",
    href: "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project",
  },
  {
    name: "JMdict",
    what: "Everyday vocabulary: written forms, readings, English glosses, and part-of-speech tags.",
    holder: "Electronic Dictionary Research and Development Group",
    licence: "CC BY-SA 4.0",
    href: "https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project",
  },
  {
    name: "KRADFILE",
    what: "The radical decomposition each kanji is built from, which drives parts-first ordering.",
    holder: "Electronic Dictionary Research and Development Group",
    licence: "CC BY-SA 4.0",
    href: "https://www.edrdg.org/krad/kradinf.html",
  },
  {
    // NOT an EDRDG file, and the first source here that isn't. Two things
    // follow and neither is optional:
    //
    //  - LICENCE, and why it's compatible. Tatoeba is CC BY 2.0 FR —
    //    attribution, no share-alike. A BY work can be incorporated into a
    //    BY-SA one (the combination is BY-SA; that is the direction share-alike
    //    permits), so the mix is fine. It would NOT be fine in reverse, and it
    //    would not be fine for an NC source — which is one of the reasons Tae
    //    Kim's CC BY-NC-SA guide is linked and never bundled. See clusters.ts.
    //
    //  - PROVENANCE. Every example sentence carries its Tatoeba id (Example.id
    //    in corpus.ts) so any sentence on screen can be traced to the human who
    //    wrote it. That is what makes the attribution real rather than a line
    //    in a footer, and it is also how a user reports a bad sentence — which
    //    they will, because unlike the EDRDG files this source is a community
    //    wiki and is not level-vetted. corpus.ts is blunt about that.
    name: "Tatoeba",
    what: "Example sentences and their human English translations, used to show each grammar pattern in a real sentence.",
    holder: "The Tatoeba Project and its contributors",
    licence: "CC BY 2.0 FR",
    href: "https://tatoeba.org/eng/downloads",
  },
  {
    // The second non-EDRDG source, and the second licence in the mix. KanjiVG is
    // CC BY-SA 3.0, one version behind everything else here, and that is fine in
    // the direction it needs to be: CC BY-SA 3.0 is upgrade-compatible with
    // 4.0 — a 3.0 work may be used in a 4.0 BY-SA adaptation — so the stroke data
    // sits inside a CC BY-SA 4.0 collection without a conflict. It does NOT work
    // in reverse, so nothing 4.0 here may be redistributed as 3.0.
    //
    // ATTRIBUTION IS SATISFIED BY THIS PAGE. CC BY-SA 3.0 asks for credit "in
    // any reasonable manner"; a credits screen reachable from every screen that
    // draws a stroke diagram is that. The inline credit that used to sit under
    // each diagram is gone BECAUSE this entry exists — delete this entry and the
    // stroke data is uncredited, which is a licence violation, not a tidy-up.
    // The guard test in attribution.test.ts is there to make that hard to do by
    // accident.
    name: "KanjiVG",
    what: "The stroke-order data behind every “how it’s written” diagram: each stroke as a path, in the order it is drawn.",
    holder: "© Ulrich Apel and contributors",
    licence: "CC BY-SA 3.0",
    href: "https://kanjivg.tagaini.net/",
  },
  {
    // The third non-EDRDG source. English Wiktionary's Translingual glyph-origin
    // markup ({{Han compound}}) is where kanji-etymology.json's component
    // FUNCTION (semantic / phonetic / form), applicable SENSE, and the plain
    // glyph-origin explanation come from. CC BY-SA — the same ShareAlike family
    // as the EDRDG files, so it sits in the generated collection without
    // conflict. Like every other borrowed thing, it earns a line here so the
    // credit is a thing someone has to consciously delete, not forget to add.
    name: "English Wiktionary",
    what: "Each kanji's glyph origin: what each component contributes (meaning, sound, or shape), the sense that applies, and the plain-language explanation of how the parts make the whole. This covers both the crawled set (kanji-etymology.json) and a hand-authored layer (kanji-etymology-manual.json) that re-maps the same Wiktionary glyph-origin prose onto the visible modern glyph where the automated join could not — e.g. 時's phonetic, historically 之, now written 寺. A third file, kanji-phonetic-gloss.json, glosses the rare untaught phonetic components (冓, 莫, 韋 …) with an on-reading and short meaning, sourced per entry from Wiktionary and/or KANJIDIC2 (EDRDG, below). Every hand-authored entry cites its source and stays CC BY-SA 4.0.",
    holder: "Wiktionary contributors",
    licence: "CC BY-SA 4.0",
    href: "https://en.wiktionary.org/",
  },
  {
    // The fourth non-EDRDG source. Kanji Alive's japanese-radicals.csv supplies
    // each Kangxi radical's Japanese bushu name (禾 → のぎへん) and the positional
    // variant forms it is written with (水 → 氵, 氺). CC BY 4.0 — attribution, and
    // like Tatoeba it carries NO share-alike, so it sits inside the generated
    // CC BY-SA 4.0 collection without conflict (BY into BY-SA is the permitted
    // direction). The variant glyphs are normalised to their CJK unified form
    // via Unicode's own equivalence table; the names and positions are Kanji
    // Alive's. radicals.mjs deferred this data for want of "a verified curated
    // source"; this is it, and the line earns its place so the credit is a thing
    // someone deletes on purpose, not forgets to add.
    name: "Kanji Alive (japanese-radicals.csv)",
    what: "Each Kangxi radical's Japanese bushu name (kana and romaji) and its positional variant forms.",
    holder: "Kanji Alive project",
    licence: "CC BY 4.0",
    href: "https://github.com/kanjialive/kanji-data-media",
  },
  // Secondary ordering sources for words CEJC does not observe. CEJC owns the
  // curriculum head and its category decisions below.
  {
    name: "JLPT vocabulary lists (tanos.co.uk)",
    what: "One of two proficiency lists used only in the fallback ordering for words absent from CEJC.",
    holder: "Jonathan Waller (tanos.co.uk)",
    licence: "CC BY",
    href: "http://www.tanos.co.uk/jlpt/",
  },
  {
    name: "open-anki-jlpt-decks",
    what: "The second proficiency list used in the CEJC-unobserved fallback ordering.",
    holder: "jamsinclair and contributors",
    licence: "MIT",
    href: "https://github.com/jamsinclair/open-anki-jlpt-decks",
  },
  {
    name: "FrequencyWords (OpenSubtitles 2018, Japanese)",
    what: "A secondary frequency source used to order Library words that CEJC does not observe.",
    holder: "Hermit Dave (hermitdave/FrequencyWords)",
    licence: "CC BY-SA 4.0",
    href: "https://github.com/hermitdave/FrequencyWords",
  },
  {
    name: "Corpus of Everyday Japanese Conversation (CEJC)",
    what: "Observed lexical and pronunciation frequencies from 200 hours of everyday conversation. CEJC part of speech separates core vocabulary, conversational essentials, grammar and fillers; its counts order the word curriculum and interchangeable readings within each dictionary meaning.",
    holder: "National Institute for Japanese Language and Linguistics",
    licence: "Free for research and education; raw redistribution prohibited",
    href: "https://www2.ninjal.ac.jp/conversation/cejc/cejc-wc.html",
  },
];

/**
 * The acknowledgement itself, in the form that must be reachable from every
 * screen showing dictionary data.
 */
export const LICENCE_NOTE =
  "This application uses dictionary files from the Electronic Dictionary " +
  "Research and Development Group (KANJIDIC2, JMdict and KRADFILE), used in " +
  "conformance with the Group's licence. The files are made available under " +
  "the Creative Commons Attribution-ShareAlike 4.0 International licence, and " +
  "the data shown here is derived from them. Example sentences come from the " +
  "Tatoeba Project (tatoeba.org) and are used under the Creative Commons " +
  "Attribution 2.0 France licence; they were written by Tatoeba's contributors, " +
  "not by this application. The stroke-order diagrams are drawn from KanjiVG " +
  "(© Ulrich Apel and contributors), used under the Creative Commons " +
  "Attribution-ShareAlike 3.0 licence. Word-track categories, teaching priority, " +
  "reading preference and within-definition reading order are derived from the " +
  "Corpus of Everyday Japanese Conversation " +
  "(CEJC) short-unit vocabulary tables, version 2022.09, created by the National " +
  "Institute for Japanese Language and Linguistics. Raw CEJC data is not " +
  "redistributed. The JLPT vocabulary lists at tanos.co.uk (Jonathan Waller, " +
  "CC BY), open-anki-jlpt-decks (MIT), and the OpenSubtitles 2018 frequency list " +
  "from hermitdave/FrequencyWords (CC BY-SA 4.0) provide fallback ordering only " +
  "for words CEJC does not observe. The glyph-origin notes — what each component of a " +
  "kanji contributes and how the parts make the whole — are derived from English " +
  "Wiktionary (en.wiktionary.org), used under the Creative Commons Attribution-" +
  "ShareAlike 4.0 International licence and written by Wiktionary's contributors. " +
  "The Japanese names of the classical radicals and their positional variant " +
  "forms are derived from Kanji Alive (github.com/kanjialive), used under the " +
  "Creative Commons Attribution 4.0 International licence.";

/** The EDRDG licence in full — the authority for everything above. */
export const LICENCE_HREF = "https://www.edrdg.org/edrdg/licence.html";

/** Where the in-app acknowledgement screen lives. The link that has to be
 * present in the chrome of every screen that renders dictionary data. */
export const ATTRIBUTION_HREF = "/about/data";

/** The persistent link's label. Short enough for a footer, explicit enough to
 * be the "easily accessible" route the licence asks for.
 *
 * IT NAMES WHAT IT COVERS. This used to read "Dictionary data: EDRDG (CC BY-SA
 * 4.0)", which was accurate when the dictionaries were the only borrowed thing
 * on screen and became a lie by omission once stroke diagrams and example
 * sentences arrived behind the same link — a reader looking for the stroke
 * credit had no reason to think this was it. The kinds of data are named rather
 * than every holder, so the label stays footer-sized and still tells you what is
 * on the other end. EDRDG stays named outright: its licence is the strict one. */
// A short, generic link label. The licence is satisfied by the acknowledgement
// being REACHABLE (a menu item is the example it gives), and /about/data carries
// the full notice — naming every holder inline here is not required, so the label
// stays a plain "Data sources" pointing at that page (owner's call).
export const SHORT = "Data sources";
