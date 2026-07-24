# 08 — Fact-type labels on the remaining surfaces 🟠 confirmed, not built

The same glyph shows up multiple times with no way to tell which fact it is. A type badge ("kanji · meaning" / "word · reading") is wanted everywhere a fact is displayed. `factTypeLabel` already exists on the `quiz-clarity` branch (`src/lib/fact-label.ts`).

**Done (on #04):** drill instruction, retry-pick chips.
**Still needed:**
- **Results / needs-work grid** (session-complete "NEEDS WORK · SOLID · Redrill selected") — shows 人 ×4, ×3, ×2 with no type/how.
- **Confusions display** ("人 ↔ 人 · Mixed up once") — doesn't say which 人 facts were confused.

Sam also wants "how it was asked" (type-word-from-sound, meaning-from-sound) where feasible — the grid is per-fact, so the fact-type label is the achievable primary; mode/direction is a stretch since a fact can be asked multiple ways.

**Depends on** #04 landing (so `factTypeLabel` is on main) or cherry-picking it.
