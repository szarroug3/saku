# 04 — Quiz clarity 🟢 ready to merge

**Branch:** `quiz-clarity` (worktree `../saku-quiz-clarity`). **Test:** http://localhost:3002

Four related fixes so a card always says what it's asking:
- **Audio (何→か bug):** listening cards spoke the written glyph, so the phone's TTS invented か for 何. Now they speak the reading (何→なに, 先生→せんせい unchanged). Fixed the kanji-reading audio branch too.
- **Instruction names the type:** "Type what the **kanji** means" vs "Type what the **word** means" (fixes 可 = can vs acceptable). Reading cards too: "Type how this **word/kanji** is said."
- **Retry chips** carry a type badge ("kanji · meaning" / "word · reading") so three 何s are distinguishable.
- **"radical," not "shape"** — the word the curriculum teaches it by (per Sam).

Also resolves the audit's #1 ambiguity (kanji-vs-word meaning) and the TTS-glyph issue.

**Verified:** ~1839 tests, tsc/lint/build clean.
**Residual (left):** two different-anchor readings of one kanji still render identically on the retry picker (the anchor word would be needed and the reading is the answer). Narrow.
