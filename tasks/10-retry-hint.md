# 10 — Answer-revealing retry hint/reveal 🔍 investigating

**Symptom:** on a retry, a gray line reveals the full answer — "口 is mouth" on a meaning card, "人 is ひと here" on a reading card. Sam: "this hint gives the answer."

**Where:** `src/lib/engine/hint.ts` (`hintFor`) is the hint system, and its own header says **"THE ANSWER IS NEVER IN THE HINT"** — so either these lines violate that contract, or they're a *different* mechanism (a post-miss reveal shown on retry, not `hintFor`). Needs confirmation: is the "X is Y [here]" line coming from `hintFor`, from the reveal, or from the anchor-context disambiguation for multi-reading kanji (人 → ひと/じん/にん)?

**Open decision for Sam:** what should appear on a retry — nothing, a partial nudge (e.g. first mora), or the meaning-but-not-the-reading? For a reading card the reading IS the answer, so any reading hint reveals it; the honest nudge is the anchor/usage ("in this word"), not the reading.

**Next step:** finish tracing the exact source, then propose options.
