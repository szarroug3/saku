# Kana Quiz — convert to Next.js (paste this into Claude Code from `~/git/personal/kana-quiz`)

Convert this kana quiz app from its current Python-stdlib + single-HTML implementation to a full Next.js + TypeScript + Tailwind project, in place in this repo. The current app IS the spec — read `app.html`, `kana_quiz.py`, `characters.py`, and `theme.py` carefully before writing anything. A sibling project, `~/git/personal/dota-data`, is the stack and aesthetic reference (Next.js app router + TS + Tailwind + shadcn/Radix): mirror its conventions and look, but do not copy its code wholesale or modify it.

## Setup

- Initialize git in this repo (first commit = the current Python app as-is, so history preserves the original).
- Move the Python app (`kana_quiz.py`, `app.html`, `characters.py`, `theme.py`, current `README.md`) into `legacy/` unmodified. Delete `__pycache__`. Add a proper `.gitignore` (node_modules, .next, __pycache__, etc.). Keep `history.json` at the repo root — it stays the persistence file.
- Scaffold Next.js + TypeScript + Tailwind (pnpm). shadcn/Radix optional — hand-rolled components matching the dota-data aesthetic are fine. No Jest/Playwright setup for now.

## Feature parity — everything below exists today and must survive the port

**Layout:** sidebar nav — Home, Recent sessions, Statistics, Kana chart, Settings. Light + dark mode (system-following); port `theme.py` palettes into CSS variables/Tailwind, including the four distinct grid-card state colors (`gcard`, `gcard-right`, `gcard-wrong`, `gcard-shake`).

**Home (quiz builder):** mode (Drill / Match pairs / Grid); direction toggles JP→EN and EN→JP with "at least one" enforced; per-direction answer styles (JP→EN typed romaji or multiple choice; EN→JP multiple choice or typed kana for a future IME); length (Endless / Limited → full coverage or question count); character selection in the Kana-Pro style: collapsible script cards (Hiragana/Katakana) → Basic/Extended groups → row cards where clicking the card toggles the whole row, each kana glyph inside is individually toggleable, partial rows get a dashed border, per-row accuracy circles (from history; hidden until data exists), All/None links at script and group levels; live subtitle (mode · scripts · N selected); Start button labeled exactly "Start Quiz". Settings rows that don't apply to the chosen mode gray out (grid mode: direction/styles/length/timer/script-label/kana-preview gray out; retries and show-answer DO apply to grid).

**Settings page:** retries (none / limited with −/+ stepper / unlimited); timer on/off with slider (3–30) AND typeable number input (1–600), kept in sync; show correct answer when out of retries; script label on card; live romaji→kana preview; random Japanese font per card (font pool from theme); submit on focus loss (grid mode: blurring a card checks it); speech voice picker rendered as pill buttons (Auto + every installed `ja` voice from `speechSynthesis`, click previews こんにちは; note: browsers only refresh the voice list on full restart, Siri voices never appear). All settings persist (localStorage).

**Drill:** header (← Setup with confirm → discards and returns to setup; progress text incl. re-queued count; timer chip; End quiz → results; gear toggling a mid-drill settings drawer whose changes apply INSTANTLY — turning the timer off kills the running countdown). Card shows the character in a random JP font per question; script label under it (toggleable); typed answers show visibly with live kana preview (greedy romaji→kana parser incl. っ for doubled consonants); MC shows 6 options with lookalike distractors first and number-key shortcuts; all romaji variants accepted (shi/si, tsu/tu, ji/zi/di…); timeout costs a retry; misses re-queue 3–7 questions ahead; per-question timing recorded (slow threshold 5s).

**Match pairs:** boards of 8 kana↔romaji pairs; mismatch shakes red briefly and records a miss + confusion pair; board completion advances; endless mode replenishes.

**Grid (Tofugu-style sheet):** every selected character as a card with its own input; Enter or form-submit checks; correct → green, locked, focus jumps to next open card; wrong → red shake animation settling to a muted wrong color; retries apply (exhausted → card locks, answer revealed if show-answer on); blur-submit setting checks on Tab-out without stealing focus; progress bar counts correct; auto-finishes when every card is resolved; Finish quiz → results anytime.

**Results:** forgiving/strict toggle recomputed from full per-char stats (forgiving = eventually correct counts; strict = first try only); metric cards (score %, correct count/total, slow-but-correct); missed characters list with miss counts before correct / "never got it", confusion annotations; slow-but-correct list; mix-up patterns list (pair ↔ pair × count); buttons: Redrill the misses (full-coverage run over just the missed chars), Same settings go again, Back to setup.

**Recent sessions:** all sessions listed; clicking a row reopens that session's results from its stored `detail` (older sessions without detail get a summary view with a note); a small 10px unfilled selection dot per row (fills + row highlights when selected) marks for deletion without opening; per-row × deletes one; "Delete selected (N)" (disabled at 0) and "Delete all", both with confirm; deletion rebuilds the per-character aggregates.

**Statistics:** sessions count, characters practiced, overall accuracy, weakest characters (top 30 by miss rate: char, romaji, script, misses/seen, accuracy, slow count).

**Kana chart:** links bar at top with EXACTLY these Tofugu URLs —
guides: https://www.tofugu.com/japanese/learn-hiragana/ and https://www.tofugu.com/japanese/learn-katakana/
charts: https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana/hiragana-chart-by-tofugu.jpg · https://files.tofugu.com/articles/japanese/2016-03-07-hiragana-mnemonics-chart/hiragana-mnemonic-chart-by-tofugu.jpg · https://files.tofugu.com/articles/japanese/2014-09-03-learn-katakana/tofugu-katakana-chart.jpg · https://files.tofugu.com/articles/japanese/2014-09-03-learn-katakana/tofugu-katakana-mnemonic-chart.jpg
Then a live search box (matches kana or any romaji variant, hides empty sections/scripts) and a grid of cells (kana + romaji + 🔊 hint); clicking a cell speaks it with the chosen voice; the mnemonic appears as a hover tooltip.

**Persistence:** keep `history.json` (same shape: `{sessions:[{ts,mode,redrill,total,forgivingPct,strictPct,chars,detail}], chars:{aggregates}}`) at repo root, read/written by Next API routes: GET `/api/history`, POST `/api/session` (append + fold aggregates, cap 200 sessions), POST `/api/delete` (`{ids}` or `{all:true}`, rebuild aggregates). All responses `Cache-Control: no-store`.

**Data:** port `characters.py` to a typed TS module preserving sets → sections → chars (romaji variant arrays, mnemonics for the 92 base kana, auto-derived mnemonics for combos/dakuten) and the LOOKALIKES groups. Design so future sets (kanji, Minna lesson vocab) are pure data additions.

## Architecture

Question types must be pluggable — the roadmap is: v2 = write-a-word / write-text modes (word sets as data) + listen mode (speechSynthesis); v3 = stroke order + draw (KanjiVG, Japanese-only). Leave clean extension points; don't implement them.

## Verify

`pnpm build` succeeds, `tsc --noEmit` clean, and smoke-test the dev server (pages render, one full drill round works, sessions save to and load from history.json). Update README.md with run instructions, project layout, how to add character sets, and the roadmap. Finish with a commit.
