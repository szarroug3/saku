# 22 — Kanji reading is asked IN A KNOWN WORD, never "on its own" 🟠 specced (queued behind #24, shared hint.ts)

Sam's decision. A kanji quiz may ask only:
1. **What the kanji MEANS.**
2. **How the kanji is pronounced IN THIS WORD** — with strict limits:
   - Only for a word the learner ALREADY KNOWS.
   - Only for a word that has MORE THAN JUST THAT KANJI (multi-kanji, or kanji+kana). A single-kanji word (人 = person) is NOT asked this — its reading is already covered by "how do you pronounce this word." So the isolated "on its own" kanji reading (the 可 case) is REMOVED entirely.
   - Include a HINT that gives the reading of the OTHER pieces of the word. 病院 → ask 病's reading, hint shows 院 = いん. A 3-kanji word shows each piece.
   - Present it as a FORMULA: `[病] + [院 with いん under it] = 病院`. (The asked piece is blank/plain; the others carry their reading.)

Open implementation question (Sam flagged): is this quiz attached to the WORD or the KANJI? The existing model already has anchored kanji-reading facts (`kanji:病/reading@病院`), so it's likely the kanji fact anchored to the known word — confirm.

Net: remove `kanji:X/reading@X` (anchor == glyph / "on its own") from being quizzed; keep only `kanji:X/reading@<known multi-part word>`; add the formula hint.
