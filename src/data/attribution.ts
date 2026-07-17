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
  "not by this application.";

/** The EDRDG licence in full — the authority for everything above. */
export const LICENCE_HREF = "https://www.edrdg.org/edrdg/licence.html";

/** Where the in-app acknowledgement screen lives. The link that has to be
 * present in the chrome of every screen that renders dictionary data. */
export const ATTRIBUTION_HREF = "/about/data";

/** The persistent link's label. Short enough for a footer, explicit enough to
 * be the "easily accessible" route the licence asks for. */
export const SHORT = "Dictionary data: EDRDG (CC BY-SA 4.0)";
