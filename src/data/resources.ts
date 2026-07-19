// The outside world — where to go for the Japanese this app doesn't teach.
//
// NOT A CREDITS PAGE. The attributions the licences REQUIRE live at /about/data
// (see src/data/attribution.ts), and they are a legal obligation, not a reading
// list. Nothing here duplicates that page: EDRDG, KanjiVG and Tatoeba are debts,
// and this file is recommendations. Keep them apart — a licence notice buried in
// a list of study links is a licence notice nobody reads.
//
// LINKS ARE A BET, same as the grammar clusters: every one is a wager on
// someone else's site staying up and staying free. So `lastVerified` is data and
// is REQUIRED (see the Link type in src/data/grammar/clusters.ts for the same
// rule). A date can be re-checked by a script; an undated link rots silently.
// Every URL below was fetched and confirmed to be the thing it claims to be on
// its stamped date. If you add one, fetch it first — a plausible dead link is
// worse than an omission.
//
// LINK ONLY. Tofugu, Tae Kim, Bunpro and the rest are other people's work.
// Linking carries no licence surface; copying, quoting or paraphrasing their
// content into this app would. We link.

/** One outbound recommendation. `blurb` is one clause, not a paragraph. */
export interface Resource {
  readonly name: string;
  readonly url: string;
  /** What it's for and who it's for, in the app's voice. One line. */
  readonly blurb: string;
  /** ISO date this URL was last fetched and confirmed. */
  readonly lastVerified: string;
}

export interface ResourceSection {
  readonly id: string;
  readonly title: string;
  readonly items: readonly Resource[];
}

const VERIFIED = "2026-07-18";

export const RESOURCE_SECTIONS: readonly ResourceSection[] = [
  {
    id: "kana",
    title: "Kana",
    items: [
      {
        name: "Tofugu: Learn hiragana",
        url: "https://www.tofugu.com/japanese/learn-hiragana/",
        blurb: "A mnemonic for every shape, free, start to finish in a weekend.",
        lastVerified: VERIFIED,
      },
      {
        name: "Tofugu: Learn katakana",
        url: "https://www.tofugu.com/japanese/learn-katakana/",
        blurb: "The same guide for the other set. Do it after hiragana.",
        lastVerified: VERIFIED,
      },
    ],
  },
  {
    id: "kanji-vocab",
    title: "Kanji & vocab",
    items: [
      {
        name: "WaniKani",
        url: "https://www.wanikani.com/",
        blurb: "Radicals up to 2,000 kanji on a schedule. Free for the first levels.",
        lastVerified: VERIFIED,
      },
      {
        name: "Anki",
        url: "https://apps.ankiweb.net/",
        blurb: "Flashcards you build yourself. Free, offline, and yours to keep.",
        lastVerified: VERIFIED,
      },
    ],
  },
  {
    id: "grammar",
    title: "Grammar",
    items: [
      {
        name: "Bunpro",
        url: "https://bunpro.jp/",
        blurb: "Grammar points drilled on a review schedule, ordered by JLPT level.",
        lastVerified: VERIFIED,
      },
      {
        name: "Tae Kim's Guide to Japanese",
        url: "https://guidetojapanese.org/learn/",
        blurb: "Free, complete, and explains why the grammar works, not just what to say.",
        lastVerified: VERIFIED,
      },
    ],
  },
  {
    id: "dictionaries",
    title: "Dictionaries",
    items: [
      {
        name: "Jisho",
        url: "https://jisho.org/",
        blurb: "Look up a word, a kanji, or a stroke you can only draw.",
        lastVerified: VERIFIED,
      },
    ],
  },
  {
    id: "reading",
    title: "Reading practice",
    items: [
      {
        name: "NHK News Web Easy",
        url: "https://news.web.nhk/news/easy/",
        blurb: "Real news, simplified, with furigana. Free, and new every day.",
        lastVerified: VERIFIED,
      },
      {
        name: "Satori Reader",
        url: "https://www.satorireader.com/",
        blurb: "Graded stories with grammar notes in line. Best once kana is solid.",
        lastVerified: VERIFIED,
      },
    ],
  },
  {
    id: "textbooks",
    title: "Textbooks",
    items: [
      {
        name: "Minna no Nihongo",
        url: "https://www.3anet.co.jp/np/list.html?series_id=1",
        blurb: "The classroom standard. Buy the translation booklet with it; the textbook itself is all Japanese.",
        lastVerified: VERIFIED,
      },
    ],
  },
];
