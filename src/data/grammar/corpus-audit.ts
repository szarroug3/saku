// The confound audit: which corpus examples do NOT actually demonstrate the
// pattern they are filed under.
//
// WHY THIS EXISTS
// ===============
// scripts/ingest/grammar.py matches morphologically, not by regex, and its
// docstring is right that this is the only defensible way to tag 9,672
// sentences. But a UniDic token run is not a MEANING. Nine signatures match a
// token run that a different, real pattern also produces, and the tagger has no
// way to tell them apart from the tokens alone:
//
//   node        の(助詞) + だ(連用形) is ので — and ALSO んじゃ, のじゃ, んだっ.
//   ba          仮定形 + ば is a conditional — and ALSO the ば buried inside
//               なければならない, which is an OBLIGATION and has its own recipe.
//   made-ni     N + までに is a deadline — and ALSO 今までに, "ever/so far".
//   nikui       lemma 難い is にくい — and ALSO がたい/難し, a different suffix.
//   ta-tokoro   た + 所 is "just did" — and ALSO ところ meaning a PLACE.
//   kara-reason 終止形 + から is a reason — and sentence-initial だから is a
//               CONNECTIVE ("so"), not X-から-Y.
//   ni-tsuite   に + つく + て is IDENTICAL for the topic 〜について ("about") and
//               physical につく — 席につく (take a seat), 位置について (on your
//               marks), "repeat/read after me" (follow). The tokens do not
//               differ AT ALL: like passive vs potential, the ambiguity is in
//               Japanese, so the ONLY evidence is the linked human translation,
//               which this one confound reads instead of the token span.
//   to-omou     と + 思う is "I think that X" ONLY when the verb before it is
//               plain. Put a VOLITIONAL verb there — 行こうと思う — and the
//               sentence means "I intend to go", a different recipe
//               (you-to-omou) that grammar.py's own NO_SIGNATURE table says is
//               "folded into to-omou for this pass" rather than given its own
//               signature. That admission is the confound: 9 of 243 shipped
//               to-omou examples are the intention, not the opinion.
//   noni        の + に is concessive のに ("even though X") ONLY when read
//               that way. の (nominalizer) + に (purpose/use marker) produces
//               the IDENTICAL two tokens for a completely different sentence:
//               「これを使うのに便利だ」is "this is convenient FOR using", not
//               "even though [X]". Pedagogy documents this as attaching to a
//               closed set of predicates (役に立つ, 便利, 必要, 十分, かかる,
//               忙しい, 苦労する, 慣れる, 成功する, 飽きる) — 48 of 212 shipped
//               noni examples are this, not concessive. A further 3 are a
//               third sense entirely: の as the pronoun "the one" + に as the
//               choice-marking particle in 〜にする ("彼が食べてるのにします" —
//               "I'll have what he's having" — decide-on-X, not "even though").
//
// The damage is not cosmetic. A learner shown 「ログアウトするんじゃなかったよ」
// as an example of 〜ので has no other source for what ので means, and the
// sentence does not contain it. They reverse-engineer a meaning off a sentence
// that never had it.
//
// WHY A FILTER AND NOT A TAGGER FIX
// =================================
// This drops data the tagger already produced. It cannot invent a wrong example
// the way a re-tuned signature can, and grammar.py cannot be re-run here at all
// (it needs the Tatoeba dump plus fugashi/unidic-lite). So the audit is the
// reversible half: run it, measure what survives, and let the survivor counts —
// recorded in the meta file — decide whether the signatures themselves are worth
// touching. See tasks/04-p0-corpus-tagger.md.
//
// These predicates are DELIBERATELY BLUNT and err toward dropping. 「見たところ
// とても熱そうだ」 is arguably a real 〜たところ; it is dropped because the rule
// cannot see the difference and a false example costs more than a missing one.
//
// The audit runs at BUILD time (scripts/audit-corpus.ts rewrites the shipped
// JSON), so the file on disk is honest about what it contains and nothing pays
// for this at request time. A test re-runs it against the shipped corpus, so a
// re-cut of grammar.py that reintroduces a confound fails loudly instead of
// silently shipping.

import type { Example } from "./corpus.ts";

/** One signature's confound: what it wrongly swallows, and how to spot it. */
interface Confound {
  /** What the tagger actually matched. Ends up in the dropped-sentence record. */
  readonly why: string;
  /**
   * True when THIS example is the confound rather than the pattern.
   *
   * `before` is appended rather than inserted, so every existing predicate
   * above — written against (ex, span, after) — keeps meaning what it always
   * meant; only a confound that needs the text ahead of the span reads it.
   */
  readonly holds: (ex: Example, span: string, after: string, before: string) => boolean;
}

const CONFOUNDS: Readonly<Record<string, Confound>> = {
  // ので, spelled out. んじゃ / のじゃ / んだっ / のだっ are の + だ in a
  // different cForm; んで is a real colloquial contraction of ので but SHOWS the
  // learner no ので, which is the whole job of the example.
  node: {
    why: "の + だ, but not ので (んじゃ / のじゃ / んだっ / んで)",
    holds: (_ex, span) => !span.includes("ので"),
  },

  // なければ/なけりゃ is ない's 仮定形 + ば. Structurally a ば conditional;
  // pedagogically it is 〜なければならない, which the corpus tags separately.
  // Teaching "if" off it teaches the wrong pattern.
  ba: {
    why: "the ば inside なければ/なけりゃ — an obligation, not a conditional",
    holds: (_ex, span) => span.includes("なければ") || span.includes("なけりゃ"),
  },

  // 今までに / これまでに is "up to now, ever". Not a deadline.
  "made-ni": {
    why: "今までに / これまでに — 'ever', not a deadline",
    holds: (_ex, span) => span.includes("今までに") || span.includes("これまでに"),
  },

  // UniDic gives にくい and がたい the same lemma 難い. がたい is a different
  // suffix with a different register, so require the kana on the page.
  nikui: {
    why: "lemma 難い written がたい / 難い — that is 〜がたい, not 〜にくい",
    holds: (_ex, span) => !span.includes("にく"),
  },

  // 〜たところ ("just did") is predicative: ところだ / ところです / ところ。
  // ところ followed by a case particle is the NOUN — 曲がったところに本屋がある.
  "ta-tokoro": {
    why: "ところ as a place noun (a case particle follows), not 〜たところ",
    holds: (_ex, _span, after) => /^[にがはへをのと]/.test(after),
  },

  // だから at the head of a sentence is a connective — "so, ...". The pattern
  // is X-から-Y, with the reason INSIDE the sentence.
  "kara-reason": {
    why: "sentence-initial だから — a connective, not X から Y",
    holds: (ex) => ex.jp.startsWith("だから"),
  },

  // 〜について ("about X") vs physical につく. The signature's not_after already
  // drops the 来る/行く/居る follow cases, but 席につく (take a seat), 位置について
  // (on your marks), テーブルについて (sit at the table) and "repeat/read after me"
  // (follow) tokenise IDENTICALLY to the topic sense — see the header. The human
  // translation is the only signal, so this confound reads ex.en (and a couple of
  // fixed JP position idioms). Blunt and erring toward dropping, per this file.
  "ni-tsuite": {
    why: "physical につく — take a seat/position or follow/repeat-after — not the topic 〜について",
    holds: (ex) =>
      /\b(after (me|him|her|us|them|you)|repeat after|follow me|come with me|sit down|sit at|take your (mark|position|seat)|on your marks?|tag along)\b/i.test(
        ex.en,
      ) || /(位置につい|席につい|テーブルについ|の後につい)/.test(ex.jp),
  },

  // 〜(よ)うと思う ("I intend to X") vs plain 〜と思う ("I think that X"). Both
  // are host verb + と + 思う; the ONLY difference is the verb's form, and
  // grammar.py's own NO_SIGNATURE entry for you-to-omou says as much: "folded
  // into to-omou for this pass". だろう/でしょう is excluded even though it
  // ends the same way — 彼は来るだろうと思う is genuinely "I think he'll
  // probably come" (conjecture, not the speaker's own intention), because the
  // volitional there belongs to the copula だ, not to a verb the speaker is
  // resolving to do.
  "to-omou": {
    why: "volitional verb + と思う is 'I intend to X' (a different recipe, you-to-omou), not 'I think that X'",
    holds: (_ex, _span, _after, before) =>
      !/だろう$|でしょう$/.test(before) && /[おこそとのぼもろご]う$|よう$/.test(before),
  },

  // のに's two OTHER jobs, both built from the exact same two tokens as
  // concessive のに ("even though X"):
  //   purpose  の (nominalizer) + に (purpose/use). 「これを使うのに便利だ」is
  //            "convenient FOR using this", not "even though". Documented in
  //            Japanese pedagogy as attaching to a closed set of predicates —
  //            useful-for, needed-for, takes-time-to, busy-with, difficulty-
  //            in, accustomed-to, succeeded-in, tired-of.
  //   choice   の as the pronoun "the one" + に as the particle in 〜にする
  //            ("decide on X"). 「彼が食べてるのにします」is "I'll have what
  //            he's having", not "even though".
  // Neither is detectable from the span itself — の+に is identical in all
  // three jobs — so this reads what immediately follows it, same as ta-tokoro
  // reads what follows ところ.
  noni: {
    why: "の+に is purpose ('for/to do X') or the pronoun-の + choice-に of 〜にする, not concessive のに ('even though')",
    holds: (_ex, _span, after) =>
      /(役立|役に立|便利|使わ|使う|使われ|必要|十分|かか|掛か|忙し|苦労|四苦八苦|慣れ|成功|飽き)/.test(after) ||
      /^(します|する)/.test(after),
  },
};

/** Recipes this audit has an opinion about. Everything else passes untouched. */
export const AUDITED: readonly string[] = Object.keys(CONFOUNDS).sort();

/**
 * Examples that correctly demonstrate their pattern — unlike everything above,
 * this is NOT a confound — but pair it with a SECOND construction the
 * curriculum has no lesson for, so the rest of the sentence is unreadable for
 * a reason no amount of studying `pattern` would fix.
 *
 * SAK-283 (L1): 8576121 自分らしくあれ。 ("Be yourself.") is a genuine らしい
 * example — らしく is the adverbial attach form, correctly tagged — but あれ
 * here is 有れ, the classical imperative of ある ("be"), not the pronoun of the
 * same spelling a learner meets at N5. `Example.v` never lists it (ある's
 * auxiliary uses are deliberately excluded from content lemmas, see corpus.ts),
 * so the >=95% readability gate in readable.ts cannot catch it either: nothing
 * in this app teaches らしく+あれ as a way to give a command, and
 * recipes.ts's rashii row only documents the two attach forms that host a
 * meaning fact (verb dictionary form, bare noun) — the adverbial form is not
 * one of them. Keyed the same shape as CONFOUNDS so a future case can reuse
 * this table without inventing a new one, but kept separate from it: the
 * "no shipped example lacks its own pattern" invariant in corpus-audit.test.ts
 * is specifically NOT what is being claimed here.
 */
const UNTAUGHT_PREREQUISITE: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  rashii: {
    8576121:
      "らしく + あれ, the classical imperative of ある ('be that way') — no lesson teaches this construction",
  },
};

/** Recipe ids UNTAUGHT_PREREQUISITE has an opinion about. */
export const AUDITED_PREREQ: readonly string[] = Object.keys(UNTAUGHT_PREREQUISITE).sort();

/** Why `ex` cannot be used to teach/quiz `pattern` despite genuinely containing
 * it, or null if there is no such objection. See UNTAUGHT_PREREQUISITE. */
export function prerequisiteGapFor(ex: Example, pattern: string): string | null {
  return UNTAUGHT_PREREQUISITE[pattern]?.[ex.id] ?? null;
}

/**
 * Why this example does NOT demonstrate `pattern`, or null if it does.
 *
 * The evidence is the example's own blank SPAN — the slice grammar.py recorded
 * as the pattern — not a scan of the whole sentence. A sentence may legitimately
 * contain ので somewhere else; what is on trial is the run the tagger pointed at.
 */
export function confoundFor(ex: Example, pattern: string): string | null {
  const c = CONFOUNDS[pattern];
  if (!c) return null;
  const sp = ex.sp[pattern];
  if (!sp) return null;
  const span = ex.jp.slice(sp[0], sp[1]);
  const after = ex.jp.slice(sp[1]);
  const before = ex.jp.slice(0, sp[0]);
  return c.holds(ex, span, after, before) ? c.why : null;
}
