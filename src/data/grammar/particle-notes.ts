// WHAT A PARTICLE MEANS, IN PROSE (SAK-470).
//
// WHY THIS FILE EXISTS
// ====================
// A particle's pattern page tells a learner how to build with it: take a noun,
// add は. That is the whole of what the app said about は, and it is not what
// anyone is confused about. Sam, reading Tofugu's は/が article: "the pages on
// tofugu explain these topics really really well. can we distill some of that
// knowledge into our pages?" So each particle in scope gets a page of ordinary
// teaching prose, one idea at a time with an example under it.
//
// WRITTEN HERE, NOT COPIED
// ========================
// Tofugu's pages are copyrighted. They were read for WHAT a page has to cover
// and in what order; every sentence below is Saku's own. The check is in the
// card: both texts to plain words, then the longest run of words they share.
// The longest run in this prose is four words ("is doing or being"), all of it
// ordinary English. The one longer match anywhere is the article's title in the
// Read more line, which is the citation. Example sentences are Saku's own
// authored rows (authored.ts: 私は学生です, 猫が好きです) or written fresh out of
// words a beginner already has.
//
// ONE PAGE, NOT A SECTION
// =======================
// Sam's call: the writing is its OWN page in the pattern's pager, after the
// build page and before Family, rather than more prose under the build table.
// A learner who wants the build gets the build; a learner who wants to know
// what は is turns one page.
//
// ONE PAGE FOR TWO PARTICLES
// ==========================
// A note names the recipes it is the page for, and は and が name one note
// between them (Sam, 2026-09-20, reading the two pages in the app): "i almost
// wonder if the 'what ga does' part should be 'wa vs ga' and then have all the
// page be the full set of information and have them both have the same page."
// There were two pages before this, and the second one opened by comparing が
// with a は page the reader may never have opened. So there is one page now,
// printed word for word on the 〜は card and on the 〜が card, and it starts
// from nothing: what は does, what が does, what changes when you swap them,
// the words that take が, questions and their answers, sentences with both, the
// second が, and the mistakes. Every paragraph that compares the two names both
// of them itself. に and で get the same treatment when their pages are
// written; を stands on its own.
//
// FURIGANA
// ========
// Sam: "we should have furigana in example sentences." The grammar corpus
// carries no per-kanji readings (only word-examples.json does, from
// scripts/ingest/sentence_readings.py), and these sentences are authored, so
// their readings are authored here too: `readings` is one kana reading per RUN
// of kanji in `jp`, left to right. 今日 is one run read きょう, not two kanji
// read separately, which is also how a reader wants to see it. A test in
// src/app/(sky)/teach.test.ts counts the runs against the readings, so a
// sentence added without them fails rather than printing bare kanji.
//
// HOW IT IS READ
// ==============
// は, へ and を are read one way as kana and another as particles. The words
// used for that here are the kana cards' own (PARTICLE_RULE in phase-intros.ts,
// NOTES in characters.ts), so a learner reads the same rule in the same words
// wherever it comes up.

/** A run of kanji: one or more kanji characters with nothing between them.
 * Every run takes one authored reading. */
const KANJI_RUN = /[一-龯㐀-䶿]+/g;

/** The runs of kanji in a sentence, left to right. Shared with the page
 * builder, so the readings are matched to the same runs the test counts. */
export function kanjiRuns(jp: string): readonly string[] {
  return jp.match(KANJI_RUN) ?? [];
}

/** A two-line example under a paragraph: the Japanese, the written particle to
 * pick out in it, and the English. */
export interface ParticleNoteExample {
  readonly jp: string;
  /** The particle as it is written, marked wherever it appears in `jp`. */
  readonly mark: string;
  readonly en: string;
  /** One reading per run of kanji in `jp`, left to right, for the furigana
   * over it. Absent only for a sentence written in kana. */
  readonly readings?: readonly string[];
}

/** One idea, and the sentence or two that show it. */
export interface ParticleNotePara {
  readonly heading?: string;
  readonly text: string;
  /** Usually one. Two where the idea IS the difference between them, as with
   * 猫は好きです beside 猫が好きです. */
  readonly examples?: readonly ParticleNoteExample[];
}

/** A particle's page of prose: which cards print it, what the pager calls it,
 * its heading, the ideas in the order they are taught, and the one place to
 * read more. */
export interface ParticleNote {
  /** The recipes whose cards print this page (recipes.ts): ["wa", "ga"] is the
   * one page both particles carry, word for word. */
  readonly recipes: readonly string[];
  readonly eyebrow: string;
  readonly title: string;
  readonly body: readonly ParticleNotePara[];
  /** The one Read more link, naming the page it drew on. */
  readonly link: { readonly url: string; readonly label: string };
}

/** The particles that have a page of prose, in the order the Particle page
 * lists them. Each one's page is built in src/app/(sky)/teach.ts. */
export const PARTICLE_NOTES: readonly ParticleNote[] = [
  {
    recipes: ["wa", "ga"],
    eyebrow: "は and が",
    title: "What は and が each do",
    body: [
      {
        text:
          "は and が are the two particles beginners mix up most. は marks the " +
          "topic of a sentence, which is what the sentence is about. が marks " +
          "the subject, which is whoever or whatever is doing or being.",
      },
      {
        heading: "What は does",
        text:
          "Put は after a word and you have said what the sentence is about. " +
          "Everything after it is the news about that thing. English has no " +
          "small word that does only this, so a word-for-word translation " +
          "usually starts with \"as for\".",
        examples: [{ jp: "私は学生です。", mark: "は", en: "As for me, I am a student.", readings: ["わたし", "がくせい"] }],
      },
      {
        text:
          "は is read \"ha\" everywhere else in Japanese. When it marks the topic " +
          "of a sentence, it is read \"wa\", so the line above is said \"watashi " +
          "wa gakusei desu\".",
      },
      {
        text:
          "は tells you nothing about what the word in front of it does. That " +
          "word can be the one acting, the thing acted on, or a day of the week.",
        examples: [{ jp: "日曜日は家にいます。", mark: "は", en: "On Sunday, I am at home.", readings: ["にちようび", "いえ"] }],
      },
      {
        text:
          "What a sentence is about is usually something both people already " +
          "know. So は goes on whatever has already come up, like the bread you " +
          "are both looking at.",
        examples: [{ jp: "このパンはおいしいですね。", mark: "は", en: "This bread is good." }],
      },
      {
        text:
          "Two は in one sentence almost always means a comparison. One thing " +
          "goes with each は, and the sentence is about how the two differ.",
        examples: [{ jp: "夏は暑いですが、冬は寒いです。", mark: "は", en: "Summer is hot, but winter is cold.", readings: ["なつ", "あつ", "ふゆ", "さむ"] }],
      },
      {
        heading: "What が does",
        text:
          "Put が after a word and that word is the one doing something, or the " +
          "one that something is true of. What comes after が can be a verb, an " +
          "adjective, or a noun with です.",
        examples: [{ jp: "雨が降っています。", mark: "が", en: "It is raining.", readings: ["あめ", "ふ"] }],
      },
      {
        heading: "が picks one out",
        text:
          "が also leaves the others out. Saying that this one did it says that " +
          "the rest did not. は does not do that. A sentence with は is about " +
          "the word in front of it and leaves everything else alone.",
      },
      {
        text:
          "Swap は for が in one sentence and you can hear the difference. " +
          "猫は好きです is about cats and says nothing about dogs. 猫が好きです " +
          "picks cats out and leaves dogs out.",
        examples: [{ jp: "猫は好きです。", mark: "は", en: "I like cats.", readings: ["ねこ", "す"] }],
      },
      {
        text: "",
        examples: [{ jp: "猫が好きです。", mark: "が", en: "Cats are the ones I like.", readings: ["ねこ", "す"] }],
      },
      {
        text:
          "The same swap works on 私は学生です. With は it answers \"what about " +
          "you?\", and nobody else in the room comes into it. With が it answers " +
          "\"which one of you is the student?\". It picks you out of the group, " +
          "so it sounds like an answer to a question. An introduction would use " +
          "は.",
        examples: [{ jp: "私が学生です。", mark: "が", en: "I am the student.", readings: ["わたし", "がくせい"] }],
      },
      {
        heading: "New information",
        text:
          "が goes on the part your listener does not have yet. は goes on " +
          "something you have both already talked about. Your listener does not " +
          "know yet that anyone turned up, so 誰か takes が.",
        examples: [{ jp: "誰かが来ました。", mark: "が", en: "Someone came.", readings: ["だれ", "き"] }],
      },
      {
        heading: "The words that take が",
        text:
          "A few words take が where English would use an object: 好き, きらい, " +
          "ほしい, わかる, できる. In Japanese, the thing you like is what が " +
          "marks. The person doing the liking often goes unsaid.",
        examples: [{ jp: "水がほしいです。", mark: "が", en: "I want some water.", readings: ["みず"] }],
      },
      {
        heading: "Questions and their answers",
        text:
          "A question word never takes は. You cannot be talking about the very " +
          "thing you are asking for, so 誰, 何 and どれ take が.",
        examples: [{ jp: "誰が来ましたか。", mark: "が", en: "Who came?", readings: ["だれ", "き"] }],
      },
      {
        text:
          "The answer keeps が. The question asked which one of them it was, and " +
          "picking one out is what が does. 田中さんは来ました would be about " +
          "Tanaka instead, and who came would still be an open question.",
        examples: [{ jp: "田中さんが来ました。", mark: "が", en: "Tanaka came.", readings: ["たなか", "き"] }],
      },
      {
        heading: "Sentences with both",
        text:
          "Plenty of sentences use both. は says what the whole sentence is " +
          "about. が then picks out the part of it that everything else " +
          "describes.",
        examples: [{ jp: "妹は歌が上手です。", mark: "が", en: "My sister is good at singing.", readings: ["いもうと", "うた", "じょうず"] }],
      },
      {
        heading: "A second が",
        text:
          "There is a second が that joins two halves of a sentence with the " +
          "sense of \"but\". This one follows a whole clause. The が you have been " +
          "reading about follows a single word, so what comes in front of it " +
          "tells you which one you have.",
        examples: [{ jp: "寒いですが、行きます。", mark: "が", en: "It is cold, but I am going.", readings: ["さむ", "い"] }],
      },
      {
        heading: "Where beginners go wrong",
        text:
          "Beginners look for a rule that makes は right and が wrong. Most " +
          "sentences take either one. What changes is which part of the " +
          "sentence is being picked out.",
      },
      {
        text:
          "Putting は on a time word changes more than you mean it to. 今日は " +
          "sets today against every other day, so a compliment built on it can " +
          "sound like the other days were worse.",
        examples: [{ jp: "今日はきれいですね。", mark: "は", en: "You look nice today.", readings: ["きょう"] }],
      },
      {
        text:
          "は does not go next to が, を or も. It replaces whichever one the " +
          "word would have had.",
        examples: [{ jp: "本は読みます。", mark: "は", en: "I do read books.", readings: ["ほん", "よ"] }],
      },
      {
        text:
          "English needs \"I\" in nearly every sentence and Japanese does not. " +
          "Once it is clear who you are talking about, 私は can go.",
      },
    ],
    link: {
      url: "https://www.tofugu.com/japanese/wa-and-ga/",
      label: "Read more: は and が: What's the Difference, Really? (Tofugu)",
    },
  },
];
