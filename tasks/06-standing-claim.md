# 06 — Standing / claim rework (the "solid" bug) 🟠 confirmed, not built

**Symptom:** Library shows 人 as "solid" right after Sam missed it a ton in the quiz.

**Two root causes (both confirmed with a probe on real data):**
1. **Recency, not accuracy.** "solid" is derived from the SRS model's "would you recall it right now," which spikes to ≈100% immediately after any drill — so a just-drilled fact reads solid no matter how badly it went. `radical:人/meaning` (no claim, seen 3 / missed 4 / correct 1) computes to "solid".
2. **Claim as a belief floor.** A claim asserts p≈1 and outranks evidence, even when newer misses should fold it down.

**What a claim SHOULD mean (Sam, verbatim intent):** "I don't want to go through the lesson — pretend I did it, but treat me as if I've never taken a quiz. It does NOT mean ignore everything I do with it forever." → a claim = *lesson skipped, untested* (neutral), and real quiz results are authoritative afterward. See memory `claim-means-skip-lesson-not-mastery`.

**The fix:** standing reflects actual accuracy (first-try rate), not recent exposure; a claim stops flooring belief and starts the item neutral. Applies to both claim modes (skip-lesson-and-quiz, skip-just-lesson).

**Files to touch:** `src/lib/library/standing.ts` (`standingOf`/`status`), `src/lib/claims.ts` (`claimedState`/`effectiveState`), and their tests.

**Priority:** highest of the unbuilt work — a tracker that misreports what you know undermines the whole app.
