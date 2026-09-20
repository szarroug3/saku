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
// The longest run in this prose is four words ("is doing the verb"), all of it
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
// THE SHARED SECTION
// ==================
// は and が cannot be explained apart, so `WA_GA` is one section of prose that
// BOTH pages end with, written once here. It also holds the Read more link, so
// the article is named once per page and the wa-ga cluster no longer links it a
// second time from the Family page right after (clusters.ts).
//
// HOW IT IS READ
// ==============
// は, へ and を are read one way as kana and another as particles. The words
// used for that here are the kana cards' own (PARTICLE_RULE in phase-intros.ts,
// NOTES in characters.ts), so a learner reads the same rule in the same words
// wherever it comes up.

/** A two-line example under a paragraph: the Japanese, the written particle to
 * pick out in it, and the English. */
export interface ParticleNoteExample {
  readonly jp: string;
  /** The particle as it is written, marked wherever it appears in `jp`. */
  readonly mark: string;
  readonly en: string;
}

/** One idea, and the sentence or two that show it. */
export interface ParticleNotePara {
  readonly heading?: string;
  readonly text: string;
  /** Usually one. Two where the idea IS the difference between them, as with
   * 猫は好きです beside 猫が好きです. */
  readonly examples?: readonly ParticleNoteExample[];
}

/** A run of prose two particles' pages both end with, because neither one can
 * be explained without the other. */
export interface ParticleNoteSection {
  readonly heading: string;
  readonly body: readonly ParticleNotePara[];
}

/** A particle's page of prose: what the pager calls it, its heading, the ideas
 * in the order they are taught, and the one place to read more. */
export interface ParticleNote {
  /** The recipe this is the page for (recipes.ts): "wa", "ga". */
  readonly recipe: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: readonly ParticleNotePara[];
  /** Printed after the body, under its own heading. */
  readonly shared?: ParticleNoteSection;
  /** The one Read more link, naming the page it drew on. */
  readonly link: { readonly url: string; readonly label: string };
}

/** The section both the は page and the が page end with. */
const WA_GA: ParticleNoteSection = {
  heading: "は or が?",
  body: [
    {
      text:
        "A topic is what a sentence is about. A subject is whoever or whatever " +
        "is doing or being. は marks the topic and が marks the subject.",
    },
    {
      text:
        "私は学生です answers \"what about you?\". You are telling someone what " +
        "you are. Nobody else in the room comes into it.",
      examples: [{ jp: "私は学生です。", mark: "は", en: "As for me, I am a student." }],
    },
    {
      text:
        "私が学生です answers \"which one of you is the student?\". It picks you " +
        "out of the group, so it sounds like an answer to a question. An " +
        "introduction would use は.",
      examples: [{ jp: "私が学生です。", mark: "が", en: "I am the student." }],
    },
    {
      text:
        "A question word never takes は. You cannot be talking about the very " +
        "thing you are asking for, so 誰, 何 and どれ take が.",
      examples: [{ jp: "誰が来ましたか。", mark: "が", en: "Who came?" }],
    },
    {
      text:
        "The answer keeps が. The question asked which one of them it was, and " +
        "picking one out is what が does.",
      examples: [{ jp: "田中さんが来ました。", mark: "が", en: "Tanaka came." }],
    },
    {
      text:
        "Plenty of sentences use both. は says what the whole sentence is " +
        "about. が then picks out the part of it that everything else describes.",
      examples: [{ jp: "妹は歌が上手です。", mark: "が", en: "My sister is good at singing." }],
    },
    {
      heading: "Three common mistakes",
      text:
        "Beginners often expect one particle to be right and the other to be a " +
        "mistake. Most sentences take either one. What changes is which part of " +
        "the sentence is being picked out.",
    },
    {
      text:
        "Answering 誰が来ましたか with 田中さんは来ました says something else. That " +
        "sentence is about Tanaka. Who came is still an open question.",
    },
    {
      text:
        "English needs \"I\" in nearly every sentence and Japanese does not. " +
        "Once it is clear who you are talking about, 私は can go.",
    },
  ],
};

/** The article both pages drew on, named by its own title. */
const WA_GA_LINK = {
  url: "https://www.tofugu.com/japanese/wa-and-ga/",
  label: "Read more: は and が: What's the Difference, Really? (Tofugu)",
} as const;

/** The particles that have a page of prose, in the order the Particle page
 * lists them. Each one's page is built in src/app/(sky)/teach.ts. */
export const PARTICLE_NOTES: readonly ParticleNote[] = [
  {
    recipe: "wa",
    eyebrow: "What は does",
    title: "は says what the sentence is about",
    body: [
      {
        text:
          "Put は after a word and you have said what the sentence is about. " +
          "Everything after it is the news about that thing. English has no " +
          "small word that does only this, so a word-for-word translation " +
          "usually starts with \"as for\".",
        examples: [{ jp: "私は学生です。", mark: "は", en: "As for me, I am a student." }],
      },
      {
        text:
          "は is read \"ha\" everywhere else in Japanese. When it marks the topic " +
          "of a sentence it is read \"wa\", so the line above is said \"watashi " +
          "wa gakusei desu\".",
      },
      {
        text:
          "は tells you nothing about what the word in front of it does. That " +
          "word can be the one acting, the thing acted on, or a day of the week.",
        examples: [{ jp: "日曜日は家にいます。", mark: "は", en: "On Sunday I am at home." }],
      },
      {
        text:
          "Choosing one thing to talk about sets it apart from everything you " +
          "did not choose. The sentence below is about dogs. A listener also " +
          "hears what it does not say about cats.",
        examples: [{ jp: "犬は好きです。", mark: "は", en: "I like dogs." }],
      },
      {
        text:
          "Two は in one sentence almost always means a comparison. One thing " +
          "goes with each は, and the sentence is about how the two differ.",
        examples: [{ jp: "夏は暑いですが、冬は寒いです。", mark: "は", en: "Summer is hot, but winter is cold." }],
      },
      {
        text:
          "What a sentence is about is usually something both people already " +
          "know. So は goes on whatever has already come up, like the bread you " +
          "are both looking at.",
        examples: [{ jp: "このパンはおいしいですね。", mark: "は", en: "This bread is good." }],
      },
      {
        heading: "Where beginners go wrong",
        text:
          "Putting は on a time word changes more than you mean it to. 今日は " +
          "sets today against every other day, so a compliment built on it can " +
          "sound like the other days were worse.",
        examples: [{ jp: "今日はきれいですね。", mark: "は", en: "You look nice today." }],
      },
      {
        text:
          "は does not go next to が, を or も. It replaces whichever one the " +
          "word would have had.",
        examples: [{ jp: "本は読みます。", mark: "は", en: "I do read books." }],
      },
    ],
    shared: WA_GA,
    link: WA_GA_LINK,
  },
  {
    recipe: "ga",
    eyebrow: "What が does",
    title: "が marks the one doing or being",
    body: [
      {
        text:
          "Put が after a word and that word is the one doing something, or the " +
          "one that something is true of. What comes after が can be a verb, an " +
          "adjective, or a noun with です.",
        examples: [{ jp: "雨が降っています。", mark: "が", en: "It is raining." }],
      },
      {
        text:
          "が also leaves the others out. Saying that this one did it says that " +
          "the rest did not. Most of the trouble beginners have with は and が " +
          "starts here.",
      },
      {
        text:
          "Swap the two particles in one sentence and you can hear the " +
          "difference. The first sentence below is about cats and says nothing " +
          "about dogs. The second one puts cats forward and leaves dogs out.",
        examples: [{ jp: "猫は好きです。", mark: "は", en: "I like cats." }],
      },
      {
        text: "",
        examples: [{ jp: "猫が好きです。", mark: "が", en: "Cats are the ones I like." }],
      },
      {
        text:
          "が also goes on the new part of what you are saying. Your listener " +
          "does not know yet that anyone turned up, so 誰か takes が.",
        examples: [{ jp: "誰かが来ました。", mark: "が", en: "Someone came." }],
      },
      {
        text:
          "A few words take が where English would use an object: 好き, きらい, " +
          "ほしい, わかる, できる. In Japanese the thing you like is what が marks. " +
          "The person doing the liking often goes unsaid.",
        examples: [{ jp: "水がほしいです。", mark: "が", en: "I want some water." }],
      },
      {
        heading: "A second が",
        text:
          "There is a second が that joins two halves of a sentence with the " +
          "sense of \"but\". This one follows a whole clause. The が you have been " +
          "reading about follows a single word, so what comes in front of it " +
          "tells you which one you have.",
        examples: [{ jp: "寒いですが、行きます。", mark: "が", en: "It is cold, but I am going." }],
      },
    ],
    shared: WA_GA,
    link: WA_GA_LINK,
  },
];
