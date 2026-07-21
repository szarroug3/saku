// The confound audit: which corpus examples do NOT actually demonstrate the
// pattern they are filed under.
//
// WHY THIS EXISTS
// ===============
// scripts/ingest/grammar.py matches morphologically, not by regex, and its
// docstring is right that this is the only defensible way to tag 8,689
// sentences. But a UniDic token run is not a MEANING. Six signatures match a
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
  /** True when THIS example is the confound rather than the pattern. */
  readonly holds: (ex: Example, span: string, after: string) => boolean;
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
};

/** Recipes this audit has an opinion about. Everything else passes untouched. */
export const AUDITED: readonly string[] = Object.keys(CONFOUNDS).sort();

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
  return c.holds(ex, span, after) ? c.why : null;
}
