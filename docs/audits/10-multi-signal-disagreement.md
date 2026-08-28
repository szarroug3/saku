# Audit 10: multi-signal disagreement resolution audit

Read `how-to-run-an-audit.md` in this folder first — this file only covers what's specific to this audit.

**Subject**: two related jobs, both surfaced by the SAK-215/216/218 pronunciation work.

**Role**: an investigator specifically tasked with resolving ambiguity other checks left unresolved — not finding new content, re-examining what's already been flagged and never actually settled.

**Sequencing note**: part of this audit's second job depends on the state of a seed/cache-generation script — if one is actively running when this audit starts, its coverage-completeness result is only a stable answer once that run finishes (see `how-to-run-an-audit.md`'s guidance on sequencing dependency-blocked audits, and whatever situational context came with this run's kickoff).

## Job 1: resolve every multi-signal disagreement, not just the clean-cut ones

The SAK-215/218 pronunciation sweeps compared three signals per word reading: the bare hiragana reading (what the app actually sends), the bare katakana reading (bypasses lexical ambiguity), and the kanji-spelling-in-context reading (disambiguated by a real sentence). A word was only confirmed as a bug when a strict rule held: bare disagrees, AND katakana exactly matches context. That rule is precise and avoids false positives — but out of 893 raw three-way disagreements the broader sweep found, only 8 satisfied it. The other **885 were never investigated at all** — bucketed as "noise" by pattern-matching what they looked like, not by actually resolving each one. Sam: "we can't ignore the 885. that is 885 potentially incorrect things." She's right — "didn't fit the clean rule" is not the same as "verified fine."

**Report structure — bucket every disagreement into three sections, handled differently:**
1. **Full agreement** (all signals match): no action needed, but report the count — "how much was even checked" is real information.
2. **2-vs-1 split**: the majority is *likely* correct, but "likely" is not "verified" — a 2-1 split could still be two-wrong-one-right if the two that agree happen to share a DIFFERENT quirk the third one avoids (the original SAK-215/218 rule never checked for this, since it only ever treated katakana+context-agree as the trusted pair — it never considered a split where, say, bare+katakana agree and context is the outlier). Actively try to refute the majority rather than trusting the vote count.
3. **All three disagree**: the hard case. Actively attempt to determine which signal (if any) is correct — additional context templates, checking whether the word has multiple legitimate readings, whatever "gather one more piece of evidence" means for the specific domain. If genuine effort still can't resolve it, the explicit, reportable outcome is **"unresolved — don't know which is correct,"** not silent exclusion. A named "I don't know" is a real, actionable finding — it tells Sam exactly which words need her own judgment or a genuinely independent source, instead of vanishing into an unexamined pile.

This isn't just a pronunciation-specific fix — the pattern generalizes to any check that produces more than one independent signal about the same fact and needs a principled way to reconcile them.

## Job 2: verify a seed/cache script actually covers everything it claims to

**Direct precedent (SAK-216):** `pitchItems()` (the pitch-seed's enumeration function) only ever generated each word's CORRECT downstep. The live pitch quiz's "wrong"-mode DISTRACTOR clip is a real, structurally different request shape that the seed's enumeration simply never accounted for — not a disagreement between signals, a coverage gap: a real thing the live app could ask for that the seed never knew to generate, invisible until Sam asked directly whether it was actually seeded.

**What to check:**
- For every live code path that can trigger on-demand audio generation (every caller of `synthesizeWordWav`/`synthesizeSentenceWav`, the `/api/pitch-tts` and `/api/tts` routes), enumerate the FULL parameter space each one can actually request.
- Cross-check that space against what the seed script's enumeration function(s) actually produce (`pitchItems()` for pitch; find and check the equivalent enumerator for the general voice/sentence sets too — this hasn't been checked outside pitch yet).
- Anything the live app can request that the seed's enumeration doesn't cover is a coverage gap, full stop.
- Needs re-checking whenever the live request-generating code changes, not just once — treat it as a standing regression guard, not a one-time sweep.

## Verify technique

For job 1's disagreement buckets: per the report structure above. For job 2's coverage claim: re-derive "everything the live app can request" from the actual call sites, from scratch, rather than trusting the first pass's enumeration — a coverage claim is only as good as the completeness of what it was checked against.

## Cost

More expensive PER-ITEM than the original sweep — resolving hundreds of individual disagreements needs real per-item investigation, not one mechanical rule applied in bulk. A full run resolves every disagreement; a lighter pass could sample the 2-vs-1 and all-3-disagree buckets instead of exhaustively working through all of them, as long as the report is honest about what fraction was resolved versus sampled versus left pending.
