// Which words of a pattern page's English say what the marked Japanese says
// (SAK-498).
//
// A pattern page's "In a sentence" block marks the piece of the Japanese the
// pattern built (昼寝を on 〜を) and prints the sentence's English under it.
// The English is a free Tatoeba translation, so nothing can work out which of
// its words answer to the marked Japanese. Each shown sentence is read once,
// here, and the phrase written down: 昼寝を is "nap".
//
// Keyed by the corpus sentence's id and the recipe, because one sentence can
// be shown for two patterns and mark a different piece for each. 4978 marks
// してください on 〜てください, which is "Wash", and 着る前に on 〜前に, which
// is "before first wearing". An id below zero is one of the hand-written rows
// in authored.ts.
//
// THE RULES FOR A ROW
// ===================
// The phrase is the English for the whole marked span. For a particle that is
// the particle and the word it follows: 私は is "I", 日本へ is "to Japan".
// Where the English spreads the span's meaning over words with other words
// between them (亡くなってから, "since the horse died"), the phrase is the
// shortest stretch that holds all of it. Where the translation folds the
// span's verb into a word the span does not hold (勉強は…しなくてはいけない,
// where "study" is 勉強 and する at once), the phrase is the rest: "should".
//
// The phrase must appear exactly once in the sentence's English, as written,
// capitals and all. sentence-english-marks.test.ts checks that, and checks
// that every pattern page with a sentence has a row. A re-ingest that shows a
// different sentence then fails the test, and the new sentence gets read.
//
// null means the sentence was read and its English has no words for the
// marked Japanese. The comment beside each one says why.

/** `"<sentence id>:<recipe id>"` to the English phrase to mark, or null. */
export const SENTENCE_ENGLISH_MARKS: Readonly<Record<string, string | null>> = {
  "-28:prenominal-form": "quiet",
  "4978:te-request": "Wash",
  "77189:te-permission": "May I speak",
  "75373:te-prohibition": "must never",
  "5098:te-kara": "since the horse died",
  "5107:te-iru": "tired",
  "-7:wa": "I",
  "-8:ga": "cats",
  "-9:ni": "at seven o'clock",
  "-10:de": "at the library",
  "4727:wo": "nap",
  "4812:e": "to Japan",
  "5326:made": "before Saturday",
  "5326:made-ni": "before Saturday",
  "5041:dake": "just one defect",
  "-16:shika-nai": "nothing but water",
  // か makes これは何です a question. The English shows that with its word
  // order and its question mark, and has no word for it.
  "-6:ka": null,
  "-17:da": "is",
  "-18:desu": "is",
  "-19:mo": "also",
  "-20:ne": "isn't it",
  "-21:yo": "I'm telling you",
  "-22:tte": "I heard",
  "-23:ga-nai": "There's no",
  "75411:te-shimau": "hangs her head",
  "173444:te-miru": "think it over",
  "79947:te-oku": "Keep your eyes open",
  "74848:te-ageru": "I'll do it",
  "78843:te-kureru": "provide us with",
  "190902:te-morau": "see a doctor",
  "-25:nai-form": "don't eat",
  "6004:nai-request": "Please do not take",
  "4932:nai-de": "don't cry",
  "74978:nakute-mo-ii": "There's no need",
  "4787:nakereba-naranai": "have to take",
  "77626:nakereba-ikenai": "must look to",
  "78034:nakute-wa-naranai": "should mind",
  "83295:nakute-wa-ikenai": "should",
  "74798:nakucha": "should definitely ask him out",
  "75289:nakya": "if English speakers don't understand it",
  "77536:nai-to-ikenai": "have to",
  "-26:ta-form": "watched",
  "91720:ta-koto-ga-aru": "has been to",
  "-32:ta-ato-de": "After doing",
  "80975:ta-hou-ga-ii": "had better turn off",
  "77494:ta-bakari": "has just arrived",
  "76696:ta-tokoro": "just missed Ami as she went out",
  "79672:tari-tari": "raining on and off",
  "5004:nagara": "regretting",
  "5077:sugiru": "There are too many",
  "74072:yasui": "catch fire easily",
  "74574:nikui": "less likely",
  "76097:zurai": "harder to understand",
  "4838:kata": "phrased in another way",
  "4841:sou-appearance": "seems",
  "5064:tai": "I'd like",
  "-29:tagaru": "wants to play",
  "-30:hajimeru": "starts walking",
  "-31:tsuzukeru": "keeps falling",
  "-27:masu-form": "study",
  "4702:mashou": "Let's try",
  "5262:koto-ga-dekiru": "could see",
  "4978:mae-ni": "before first wearing",
  "4775:tsumori": "intend to be",
  "4877:to-omou": "do you think",
  "4827:hazu": "has got to be useful",
  // The Japanese proverb is put into an English one. "Give him an inch" is
  // the whole first half, and nothing in it is the "if" that やれば says.
  "5187:ba": null,
  // 何と言ったらいいか is "what should I say". The English turns it into "I
  // don't know what to say" and has no "if" or "when" for the たら.
  "4713:tara": null,
  "-24:to-and": "and I",
  "74210:nara": "If",
  "4772:kara-reason": "because",
  "5055:kara-source": "from here",
  // The translation is free. Its subject is the daughter's slowness, and it
  // has no "so" or "because" for ので.
  "74096:node": null,
  "4812:noni": "I wish",
  "76794:sou-hearsay": "I hear",
  "74772:you-da": "looks like",
  "118196:rashii": "affected",
  "74941:kamoshirenai": "mightn't",
  "4729:deshou": "won't",
  "-1:wake-da": "No wonder his English is so good",
  "77398:ni-chigainai": "must be",
  "95184:hazu-ga-nai": "cannot have",
  "74283:tame-ni": "to keep",
  // "Thanks to computers, people become stupid", put as "Computers make
  // people stupid". The English has no words for おかげで.
  "5138:okage-de": null,
  "5082:sei-de": "Thanks to",
  "98132:you-ni-naru": "fall in love",
  "366809:you-ni-suru": "Exercise",
  "74576:ni-tsuite": "Concerning the characteristics",
  "74097:to-shite": "as a side effect",
  "5128:beki-da": "should have listened",
  "82060:wake-ni-wa-ikanai": "cannot silently overlook",
};
