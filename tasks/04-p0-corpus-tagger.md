# P0 · The corpus tagger matches text instead of understanding it

**Status: filtered on `fix/corpus`; the tagger question is still open and is Sam's**

## Open questions — answered by the filtering pass

- **Filter only, or also fix the tagger?** Filtered only, on the reasoning in
  the card: it is the reversible half, and a re-tuned signature can invent new
  wrong examples that we would then have to find. The rules are
  `src/data/grammar/corpus-audit.ts`; the pass is `scripts/audit-corpus.ts`.
- **Did enough survive?** Yes, everywhere. Measured, before → after:

  | pattern | before | dropped | after |
  |---|---|---|---|
  | `ba` | 559 | 302 (54%) | **257** |
  | `node` | 214 | 125 (58%) | **89** |
  | `ta-tokoro` | 160 | 21 (13%) | **139** |
  | `made-ni` | 112 | 27 (24%) | **85** |
  | `nikui` | 81 | 18 (22%) | **63** |
  | `kara-reason` | 226 | 13 (6%) | **213** |

  Nothing fell near the 20-example scarcity floor. The corpus went 8,689 →
  8,547 sentences (142 had no surviving claim); `SCARCE` is unchanged
  (`ta-ato-de` 0, `zurai` 9). The knock-on cost is 14 vocabulary words that
  lost their only Library example sentence: 2,692 → 2,678.

  The measurement reproduces this card's table exactly except `nikui`, where
  the audit finds 18 and the card says 17 — the rule is "the blank span does
  not contain にく", and 難 spelled in kanji is read がたい here.

## Still open, and Sam's to decide

`node` losing 58% of its supply is the argument for fix 2 (the negative
lookarounds in `grammar.py`). 89 examples is enough to teach from, so it is not
urgent — but the signature is still wrong, and re-cutting the corpus recovers
~125 real ので sentences only if it is fixed. The invariant is now asserted, so
a re-cut that skips the audit fails loudly rather than shipping the confounds.

Sam asked: what is the corpus tagger?

## What it is, in plain terms

The app ships ~8,700 real Japanese sentences from Tatoeba, a public sentence
database. To show you a sentence that demonstrates 〜ので ("because"), something
had to go through all 8,700 sentences and label which grammar pattern each one
demonstrates. That labelling step is the tagger, and its output is
`src/data/generated/grammar-corpus.json`.

**The bug: it labels by looking for the characters, not by understanding the
sentence.** Anything containing the letters ので gets filed under "because", even
when those characters are part of a completely different word.

## The damage, measured across the whole file

| pattern | mislabelled | what it actually matched |
|---|---|---|
| `node` 〜ので "because" | **125 of 214 (58%)** | んじゃ / のだ |
| `ba` 〜ば "if" | **302 of 559 (54%)** | the ば inside なければならない, an obligation |
| `made-ni` | 27 of 112 (24%) | 今までに "ever" |
| `nikui` | 17 of 81 (21%) | 〜がたい |
| `ta-tokoro` | 21 of 160 (13%) | ところ meaning "place" |
| `kara-reason` | 13 of 226 (6%) | sentence-initial だから |

Live right now, `/api/grammar-example?recipe=node` serves:

> 「ログアウトするんじゃなかったよ。」 = "I shouldn't have logged off."

as an example of **because**. There is no ので in it and no causal meaning
anywhere. Worst observed: 「ここを動くんじゃないぞ」("Don't move") offered as an
example of "because".

Roughly 20 other patterns were checked and were correct in every instance, so this
is concentrated, not universal.

## Why it matters more than a wrong sentence

The learner has no other source. They reverse-engineer what 〜ので means from the
sentence they are shown. Show them a sentence that does not contain it and they
learn a meaning that is not connected to the pattern at all.

## Fix, in order of increasing cost

1. **Filter the existing data.** Cheapest and immediate: for each pattern, drop
   any example whose sentence does not actually contain the pattern's surface
   form. This is roughly the check that produced the table above, so it is already
   written. It will shrink `node` and `ba` a lot; measure what survives and whether
   the remainder is still enough to teach from.
2. **Fix the tagger's matching rules** where a cheap negative lookaround does the
   job: exclude んじゃ/んだ/のだ when matching ので, exclude なければ/なけりゃ when
   matching ば, exclude 今までに when matching までに.
3. **Parse rather than match.** Correct, and much more work; only worth it if 1
   and 2 leave coverage too thin.

Start with 1, measure, then decide whether 2 is needed.

## Done when

- No served example lacks its own pattern.
- The per-pattern counts after filtering are recorded, so we know coverage.
- A test asserts the invariant, so a re-cut of the corpus cannot reintroduce it.
