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
//
// WHICH PARTICLES SHARE A PAGE
// ============================
// Sam, 2026-09-20: "go ahead and build all of them." Two particles share a page
// where a learner confuses them with each other, which is the call は and が
// came out of: に and で, まで and までに, だけ and しか, ね and よ. へ has a
// short page of its own that names the に and で page, because に against へ is
// said there already and a second answer is one more thing to keep in step. は
// against も is on も's page and names は itself, for the reason the は and が
// page names both: a reader can open either card first.
//
// WHICH CARD A PAGE LANDS ON
// ==========================
// A note names recipe ids, and a recipe id is not always a card. 〜から is one
// page holding "because" and "from", and 〜と is one page holding "and" and
// "whenever", so those two notes name `kara-reason` and `to-conditional`, which
// are the entries the Particle page's rows open (`primaryPatternRecipe`). Each
// of the two covers both senses and says what tells them apart, because a
// learner who opens 〜から has both of them in front of them.
//
// A PAGE WITH NO READ MORE
// ========================
// `link` is optional, and a note without one carries `noLinkReason` instead,
// the way a cluster with no link does (clusters.ts). って is the one page here
// with none: Tofugu has no page for it. Saying so in the data beats an
// approximate link, which would teach a reader that our citations are
// decorative.

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
  /** The one Read more link, naming the page it drew on. Absent where Tofugu
   * has no page for the particle, and then `noLinkReason` says so. */
  readonly link?: { readonly url: string; readonly label: string };
  /** Required when there is no link. Not shown to a reader: it is the written
   * record of a citation nobody could make, the way a cluster's is. */
  readonly noLinkReason?: string;
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
          "が picks one out and leaves the others out. Saying that this one did " +
          "it says that the rest did not. は does not do that. A sentence with は " +
          "is about the word in front of it and leaves everything else alone.",
      },
      {
        text:
          "Swap は for が in one sentence and you can hear the difference. " +
          "猫は好きです is about cats and says nothing about dogs. 猫が好きです " +
          "picks cats out and leaves dogs out.",
        examples: [
          { jp: "猫は好きです。", mark: "は", en: "I like cats.", readings: ["ねこ", "す"] },
          { jp: "猫が好きです。", mark: "が", en: "Cats are the ones I like.", readings: ["ねこ", "す"] },
        ],
      },
      {
        text:
          "The same swap works on 私は学生です. With は it answers \"what about " +
          "you?\". Nobody else in the room comes into it. With が it answers " +
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
          "ほしい, わかる, できる. In Japanese, the thing you like or want " +
          "is what が marks. The person who likes or wants it often goes unsaid.",
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
          "Beginners look for a rule that makes は right and が wrong. Many " +
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
          "は does not go next to が or を. It takes the place of whichever one " +
          "the word would have had.",
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
  {
    recipes: ["wo"],
    eyebrow: "What を does",
    title: "を marks the thing the verb happens to",
    body: [
      {
        text: "Put を after a word and that word is what the verb happens to.",
        examples: [{ jp: "パンを食べます。", mark: "を", en: "I eat bread.", readings: ["た"] }],
      },
      {
        text:
          "を is only ever used as a particle, and it is always read \"o\". The " +
          "line above is said \"pan o tabemasu\".",
      },
      {
        text:
          "Not every verb takes one. 食べる and 飲む happen to something. 起きる " +
          "and 寝る do not, so neither of them has a を in front of it.",
        examples: [{ jp: "水を飲みます。", mark: "を", en: "I drink water.", readings: ["みず", "の"] }],
      },
      {
        text:
          "を also goes on a road or a path you move along. The word in front of " +
          "it is the route you took.",
        examples: [{ jp: "道を歩きます。", mark: "を", en: "I walk along the road.", readings: ["みち", "ある"] }],
      },
      {
        heading: "を on a place",
        text:
          "を and で both come after a place, and they say different things. を " +
          "is the ground you covered. で is where you were while you did it.",
        examples: [
          { jp: "公園を走ります。", mark: "を", en: "I run through the park.", readings: ["こうえん", "はし"] },
          { jp: "公園で走ります。", mark: "で", en: "I run in the park.", readings: ["こうえん", "はし"] },
        ],
      },
      {
        heading: "Where beginners go wrong",
        text:
          "English gives an object to verbs that Japanese does not. A bus is " +
          "something you get on in Japanese, so 乗る takes に.",
        examples: [{ jp: "バスに乗ります。", mark: "に", en: "I get on the bus.", readings: ["の"] }],
      },
      {
        text:
          "A verb that happens on its own never takes を. In ドアが開きます the " +
          "door opens by itself. Put を in the sentence and you need the other " +
          "verb, 開ける.",
        examples: [{ jp: "ドアを開けます。", mark: "を", en: "I open the door.", readings: ["あ"] }],
      },
    ],
    link: {
      url: "https://www.tofugu.com/japanese-grammar/particle-wo/",
      label: "Read more: Particle を: Direct Object Marker (Tofugu)",
    },
  },
  {
    recipes: ["ni", "de"],
    eyebrow: "に and で",
    title: "What に and で each do",
    body: [
      {
        text:
          "に and で both go after a place, so beginners mix them up. に marks " +
          "where something is or where it is going. で marks where something " +
          "happens.",
      },
      {
        heading: "What に does",
        text:
          "Put に after a word and you have named one point. With いる and ある, " +
          "that point is where the thing already is.",
        examples: [{ jp: "学校にいます。", mark: "に", en: "I am at school.", readings: ["がっこう"] }],
      },
      {
        text: "A verb of going puts に on the place you end up at.",
        examples: [{ jp: "東京に行きます。", mark: "に", en: "I am going to Tokyo.", readings: ["とうきょう", "い"] }],
      },
      {
        text:
          "に goes on a time as well, as long as you could point at it on a " +
          "clock or a calendar.",
        examples: [{ jp: "七時に起きます。", mark: "に", en: "I get up at seven.", readings: ["しちじ", "お"] }],
      },
      {
        heading: "What で does",
        text: "Put で after a place and that is where the action happens.",
        examples: [{ jp: "図書館で勉強します。", mark: "で", en: "I study at the library.", readings: ["としょかん", "べんきょう"] }],
      },
      {
        text: "で also marks what you used to do something.",
        examples: [{ jp: "ペンで書きます。", mark: "で", en: "I write with a pen.", readings: ["か"] }],
      },
      {
        text:
          "How you got somewhere counts as something you used, so a bus or a " +
          "train takes で.",
        examples: [{ jp: "バスで行きます。", mark: "で", en: "I go by bus.", readings: ["い"] }],
      },
      {
        heading: "The same room, two particles",
        text:
          "One room takes either one, and the verb decides. に goes with a verb " +
          "that says something is there. で needs a verb with something going on " +
          "in it.",
        examples: [
          { jp: "教室にいます。", mark: "に", en: "I am in the classroom.", readings: ["きょうしつ"] },
          { jp: "教室で話します。", mark: "で", en: "We talk in the classroom.", readings: ["きょうしつ", "はな"] },
        ],
      },
      {
        heading: "に and へ",
        text:
          "へ is a third particle for somewhere you are heading. に marks the " +
          "point you end up at, and へ marks the way there. After 行く, the two " +
          "sound much the same. As a particle, へ is read \"e\", so 学校へ is said " +
          "\"gakkou e\".",
        examples: [{ jp: "学校へ行きます。", mark: "へ", en: "I am going to school.", readings: ["がっこう", "い"] }],
      },
      {
        heading: "Where beginners go wrong",
        text:
          "歩く and 走る do not take you anywhere by themselves, so 学校に歩きます " +
          "is not something a Japanese speaker says. Put 行く on the end of it " +
          "and the sentence works.",
        examples: [{ jp: "学校に歩いて行きます。", mark: "に", en: "I walk to school.", readings: ["がっこう", "ある", "い"] }],
      },
      {
        text:
          "A thing that is somewhere takes に. An English ear likes 部屋でいます, " +
          "which is why beginners write it.",
        examples: [{ jp: "犬が部屋にいます。", mark: "に", en: "The dog is in the room.", readings: ["いぬ", "へや"] }],
      },
      {
        text: "今日 and 毎日 take no particle at all. They say when on their own.",
        examples: [{ jp: "今日、学校に行きます。", mark: "に", en: "I am going to school today.", readings: ["きょう", "がっこう", "い"] }],
      },
    ],
    link: {
      url: "https://www.tofugu.com/japanese/ni-vs-de/",
      label: "Read more: に vs で: Which Particle To Choose And Why (Tofugu)",
    },
  },
  {
    recipes: ["e"],
    eyebrow: "What へ does",
    title: "へ marks which way you are going",
    body: [
      {
        text: "Put へ after a place and you have said which way you are going.",
        examples: [{ jp: "日本へ行きます。", mark: "へ", en: "I am going to Japan.", readings: ["にほん", "い"] }],
      },
      {
        text:
          "へ is normally read \"he\". When it points somewhere, it is read \"e\", " +
          "so the line above is said \"nihon e ikimasu\".",
      },
      {
        text:
          "歩く says nothing about where you are going. Put a place with へ on it " +
          "in front of 歩く and the walking has a direction.",
        examples: [{ jp: "学校へ歩きます。", mark: "へ", en: "I walk to school.", readings: ["がっこう", "ある"] }],
      },
      {
        heading: "に and へ",
        text:
          "に marks the point you end up at. へ marks the way there, so 日本へ行き" +
          "ます has a little more of the going in it than 日本に行きます does. The " +
          "に and で page goes through に in full.",
      },
      {
        heading: "Where beginners go wrong",
        text:
          "へ marks somewhere you are heading. A place you are already at takes " +
          "に.",
        examples: [{ jp: "学校にいます。", mark: "に", en: "I am at school.", readings: ["がっこう"] }],
      },
    ],
    link: {
      url: "https://www.tofugu.com/japanese-grammar/particle-he/",
      label: "Read more: Particle へ: For Marking Direction (Tofugu)",
    },
  },
  {
    recipes: ["made", "made-ni"],
    eyebrow: "まで and までに",
    title: "What まで and までに each do",
    body: [
      {
        text:
          "まで marks the end of a stretch. までに marks a deadline. One kana " +
          "tells them apart, and beginners put the wrong one in.",
      },
      {
        heading: "What まで does",
        text:
          "Put まで after a time or a place and that is where the stretch ends. " +
          "から often marks where it started.",
        examples: [{ jp: "一時から二時まで勉強します。", mark: "まで", en: "I study from one until two.", readings: ["いちじ", "にじ", "べんきょう"] }],
      },
      {
        text: "から can be left out when you both know where the stretch began.",
        examples: [{ jp: "駅まで歩きます。", mark: "まで", en: "I walk as far as the station.", readings: ["えき", "ある"] }],
      },
      {
        text:
          "まで goes after a verb too, and there it means until that has " +
          "happened.",
        examples: [{ jp: "終わるまで待ちます。", mark: "まで", en: "I will wait until it is over.", readings: ["お", "ま"] }],
      },
      {
        heading: "What までに does",
        text:
          "Put までに after a time and you have set a deadline. Any moment " +
          "before that time counts.",
        examples: [{ jp: "金曜日までに本を返します。", mark: "までに", en: "I will return the book by Friday.", readings: ["きんようび", "ほん", "かえ"] }],
      },
      {
        heading: "Telling the two apart",
        text:
          "まで covers the whole stretch up to that time, and までに picks one " +
          "moment before it. 待つ goes on and on, so it takes まで. 帰る happens " +
          "once, so it takes までに.",
        examples: [
          { jp: "六時まで待ちます。", mark: "まで", en: "I will wait until six.", readings: ["ろくじ", "ま"] },
          { jp: "六時までに帰ります。", mark: "までに", en: "I will be home by six.", readings: ["ろくじ", "かえ"] },
        ],
      },
      {
        heading: "Where beginners go wrong",
        text:
          "A verb that goes on takes まで. 六時までに待ちます asks you to finish " +
          "the waiting before six, and nobody waits that way.",
        examples: [{ jp: "春まで待ちます。", mark: "まで", en: "I will wait until spring.", readings: ["はる", "ま"] }],
      },
    ],
    link: {
      url: "https://www.tofugu.com/japanese-grammar/particle-made/",
      label: "Read more: Particle まで: Endpoint Marker (Tofugu)",
    },
  },
  {
    recipes: ["kara-reason"],
    eyebrow: "What から does",
    title: "から marks where something comes from",
    body: [
      {
        text: "Put から after a word and that word is where something starts.",
        examples: [{ jp: "東京から来ました。", mark: "から", en: "I am from Tokyo.", readings: ["とうきょう", "き"] }],
      },
      {
        text: "まで often follows it and marks where the stretch ends.",
        examples: [{ jp: "家から学校まで歩きます。", mark: "から", en: "I walk from home to school.", readings: ["いえ", "がっこう", "ある"] }],
      },
      {
        text: "A time works the same way.",
        examples: [{ jp: "九時から始まります。", mark: "から", en: "It starts at nine and runs on from there.", readings: ["くじ", "はじ"] }],
      },
      {
        heading: "The same clock with に",
        text:
          "Both particles go on nine o'clock. に names the moment and stops " +
          "there. から names the moment something opens and keeps going.",
        examples: [
          { jp: "九時に始まります。", mark: "に", en: "It starts at nine.", readings: ["くじ", "はじ"] },
          { jp: "今日から勉強します。", mark: "から", en: "I start studying today.", readings: ["きょう", "べんきょう"] },
        ],
      },
      {
        heading: "から for a reason",
        text:
          "The same から comes after a whole sentence and gives the reason for " +
          "what follows it.",
        examples: [{ jp: "寒いから、家にいます。", mark: "から", en: "It is cold, so I am staying home.", readings: ["さむ", "いえ"] }],
      },
      {
        heading: "Telling the two apart",
        text:
          "Look at what comes before it. A single word makes から a starting " +
          "point. A whole sentence with its own verb makes it a reason.",
      },
      {
        heading: "Where beginners go wrong",
        text:
          "A noun needs だ in front of a reason から. 学生から on its own reads as " +
          "\"from a student\".",
        examples: [{ jp: "学生だから、お金がありません。", mark: "から", en: "I am a student, so I have no money.", readings: ["がくせい", "かね"] }],
      },
    ],
    link: {
      url: "https://www.tofugu.com/japanese-grammar/particle-kara/",
      label: "Read more: Particle から: Starting Point Marker (Tofugu)",
    },
  },
  {
    recipes: ["to-conditional"],
    eyebrow: "What と does",
    title: "と ties two things together",
    body: [
      {
        text:
          "Put と between two nouns and you have tied them together. English " +
          "would use \"and\" there.",
        examples: [{ jp: "パンとりんごを食べます。", mark: "と", en: "I eat bread and an apple.", readings: ["た"] }],
      },
      {
        text:
          "After a person, と is closer to \"with\". The person in front of it did " +
          "the thing alongside you.",
        examples: [{ jp: "友達と行きます。", mark: "と", en: "I am going with a friend.", readings: ["ともだち", "い"] }],
      },
      {
        heading: "The second と",
        text:
          "There is another と, and it comes after a whole sentence. It says " +
          "that the second half happens every time the first half does.",
        examples: [{ jp: "雨が降ると、寒くなります。", mark: "と", en: "When it rains, it gets cold.", readings: ["あめ", "ふ", "さむ"] }],
      },
      {
        text:
          "The result has to follow on its own. Nothing you decide to do can " +
          "come after this と, so a plan or a request takes たら.",
        examples: [{ jp: "春になると、暖かくなります。", mark: "と", en: "When spring comes, it gets warm.", readings: ["はる", "あたた"] }],
      },
      {
        heading: "Telling the two apart",
        text:
          "A noun in front of と ties it to the noun after it. When a whole " +
          "sentence comes first, と is the whenever one.",
      },
      {
        heading: "Where beginners go wrong",
        text:
          "と ties nouns together and nothing else. Two adjectives are joined " +
          "another way, so 安いとおいしいです is not Japanese.",
        examples: [{ jp: "私と妹は学生です。", mark: "と", en: "My sister and I are students.", readings: ["わたし", "いもうと", "がくせい"] }],
      },
    ],
    link: {
      url: "https://www.tofugu.com/japanese-grammar/particle-to/",
      label: "Read more: Particle と: For Connecting Words Together (Tofugu)",
    },
  },
  {
    recipes: ["mo"],
    eyebrow: "What も does",
    title: "も adds one more to what has been said",
    body: [
      {
        text:
          "Put も after a word and that word joins the ones already named. " +
          "English says \"too\" or \"also\".",
        examples: [{ jp: "田中さんも先生です。", mark: "も", en: "Tanaka is a teacher too.", readings: ["たなか", "せんせい"] }],
      },
      {
        text:
          "も takes the place of は, が and を. It does not stand next to them, so " +
          "私はも行きます is not Japanese.",
        examples: [{ jp: "私も行きます。", mark: "も", en: "I am going too.", readings: ["わたし", "い"] }],
      },
      {
        text: "The other particles stay where they are, and も follows them.",
        examples: [{ jp: "学校にも行きます。", mark: "も", en: "I go to school too.", readings: ["がっこう", "い"] }],
      },
      {
        heading: "は and も",
        text:
          "は picks one thing out of the things around it. も puts it back among " +
          "them. One sentence goes either way, and the particle is the whole " +
          "difference.",
        examples: [
          { jp: "妹は学生です。", mark: "は", en: "My sister is a student.", readings: ["いもうと", "がくせい"] },
          { jp: "妹も学生です。", mark: "も", en: "My sister is a student too.", readings: ["いもうと", "がくせい"] },
        ],
      },
      {
        text: "In a negative sentence, も comes out as \"either\".",
        examples: [{ jp: "私も行きません。", mark: "も", en: "I am not going either.", readings: ["わたし", "い"] }],
      },
      {
        text: "も on a number says the number is more than you would expect.",
        examples: [{ jp: "三時間も待ちました。", mark: "も", en: "I waited three whole hours.", readings: ["さんじかん", "ま"] }],
      },
      {
        text:
          "A question word with も on it covers everything at once. 何も with a " +
          "negative verb is \"nothing at all\".",
        examples: [{ jp: "何も食べませんでした。", mark: "も", en: "I ate nothing.", readings: ["なに", "た"] }],
      },
    ],
    link: {
      url: "https://www.tofugu.com/japanese-grammar/particle-mo/",
      label: "Read more: Particle も: Addition Marker (Tofugu)",
    },
  },
  {
    recipes: ["dake", "shika-nai"],
    eyebrow: "だけ and しか",
    title: "What だけ and しか each do",
    body: [
      {
        text:
          "だけ and しか both mean \"only\". だけ leaves the verb alone. しか needs " +
          "the verb in its negative form, and the English still comes out as " +
          "\"only\".",
      },
      {
        heading: "What だけ does",
        text: "Put だけ after a word and that word is all there is.",
        examples: [{ jp: "水だけ飲みます。", mark: "だけ", en: "I drink only water.", readings: ["みず", "の"] }],
      },
      {
        text:
          "だけ goes after a verb as well. There it limits what you are doing.",
        examples: [{ jp: "見るだけです。", mark: "だけ", en: "I am only looking.", readings: ["み"] }],
      },
      {
        heading: "What しか does",
        text:
          "Put しか after a word and put the verb into the negative. 飲みません " +
          "with しか in front of it still says you drink something.",
        examples: [{ jp: "水しか飲みません。", mark: "しか", en: "I drink only water.", readings: ["みず", "の"] }],
      },
      {
        heading: "Telling the two apart",
        text:
          "だけ states the amount and leaves it there. しか adds that the amount " +
          "is small, so it can sound like a complaint or like a boast about how " +
          "little it took.",
        examples: [
          { jp: "一時間だけ勉強しました。", mark: "だけ", en: "I studied for one hour.", readings: ["いちじかん", "べんきょう"] },
          { jp: "一時間しか勉強しませんでした。", mark: "しか", en: "I only studied for one hour.", readings: ["いちじかん", "べんきょう"] },
        ],
      },
      {
        heading: "Where beginners go wrong",
        text:
          "しか with a plain verb is the mistake to watch for. 水しか飲みます is " +
          "not Japanese, because しか needs 飲みません at the end.",
        examples: [{ jp: "五分しかかかりません。", mark: "しか", en: "It only takes five minutes.", readings: ["ごふん"] }],
      },
      {
        text:
          "Both of them go where が or を would have been, and that particle is " +
          "usually dropped. 水を飲みます becomes 水だけ飲みます.",
      },
    ],
    link: {
      url: "https://www.tofugu.com/japanese-grammar/dake/",
      label: "Read more: だけ for \"Only\" (Tofugu)",
    },
  },
];
