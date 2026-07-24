# 09 — Pitch intro + homophone → show kanji 🟠 designed, not built

**Key finding:** pitch resolves only **13%** of homophones. Of 795 readings shared by 2+ words, only 107 have distinct pitch; 461 share reading AND pitch (安い/易い both やすい pitch 2; 意志/医師 both いし pitch 1), 227 lack pitch data. So pitch is NOT a general disambiguator.

**Design (decided with Sam):**
1. **Teach pitch before its first use** — a short explainer fires before the first card that shows a pitch mark (currently the overline appears on reveals with no introduction; there's only a glossary Terms entry).
2. **Show the pitch overline everywhere a reading is displayed** (reveal, Library, reading prompts) — for pronunciation; also resolves the 箸/橋 class.
3. **Homophone meaning cards always show the kanji** — for any word whose reading collides with another word the learner knows, the meaning question shows the written form (unambiguous, one right answer), never audio/kana-only. Reading can still be asked from the kanji. Non-colliding words unaffected. (Also closes the audit's homophone-listening-meaning ambiguity.)
4. **Grading unchanged** — each word keeps its own glosses; disambiguate by the prompt, not by loosening the answer.

Data: `src/data/pitch.ts` (`wordPitch`), `PitchReading` (`pitch-mark.tsx`).
