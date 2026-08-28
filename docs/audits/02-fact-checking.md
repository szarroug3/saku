# Audit 02: fact-checking audit

Read `how-to-run-an-audit.md` in this folder first — this file only covers what's specific to this audit.

**Subject**: whether what the app teaches is actually correct, and whether the way it's taught is clear — independent of whether it was taught in the right order (a different audit's concern, not this one's).

**Role**: full real Japanese knowledge, deliberately — the point is to catch errors a naive learner has no way to notice, the way an expert reviewer would. No taught-ledger, no simulated ignorance. Cross-reference against real authoritative sources the app itself claims to follow (JMdict for readings/meanings/pos, Kanjium for pitch accent) — verify the app's *ingested* data actually matches them, not just that the app is internally self-consistent.

This is the general, systematic version of what the SAK-215/216/218 pronunciation bug hunt did by hand (2026-08-28) — a real, common word (八, "eight") was mispronounced in production and nobody had systematically checked before that.

## Scope and unit of work

One agent per track, or per content type (readings, pitch, grammar rules, example sentences) — whichever split fits the specific check better. No sequential-unlock concern — review Library pages, generated curriculum data, and worked examples directly, in any order, in parallel.

## What to check

- **Readings**: does every taught reading match the authoritative source? (SAK-215/218 together confirmed 34 distinct readings — 36 words, several sharing a reading — where synthesis diverged from the intended pronunciation; a related audit in this folder covers the 885 more that were flagged in that work but never resolved either way.)
- **Pitch accent**: does the app's pitch data match Kanjium, not just "is it internally consistent"? An ingest bug could mean the pitch data itself is wrong, which no amount of app-logic correctness would catch.
- **Meanings/glosses**: accurate, not misleading, appropriately scoped for a beginner (not a rare/archaic sense presented as primary).
- **Grammar explanations**: is the rule as stated actually correct Japanese grammar, not just internally consistent with how the app applies it elsewhere?
- **Example sentences**: natural, idiomatic Japanese, not awkward constructions a native speaker wouldn't actually say.
- **Pedagogical clarity**: even when factually correct, is the explanation well-sequenced and free of unexplained jargon? An expert can tell correct-but-confusing apart from correct-and-clear in a way a naive-persona check can't.
- **Internal consistency**: does the same fact get taught/explained the same way everywhere it appears (Library page, lesson card, quiz prompt, worked example)?

## Verify technique

Cross-check the specific claim against the authoritative source directly. Specifically guard against a failure mode already caught once: a naive "this looks wrong" signal that's actually a legitimate exception (こんにちは, correctly pronounced こんにちわ, is real, standard Japanese, not a bug — a blanket "hiragana disagrees with katakana" signal would have flagged it anyway; only a second, adversarial check against context told them apart). Any new "content is wrong" finding needs the same kind of independent, mechanical cross-check before it's trusted, not just one confident claim. A confirmed content bug is more urgent than a clarity complaint — the app is actively teaching something false, not just teaching it awkwardly.
