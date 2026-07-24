# 07 — Continue-session masking 🟠 confirmed, not built

**Symptom:** clicking "I already know these" on the Learn page appears to do nothing.

**Cause (confirmed):** while a session is open for a track, `resumeLesson` (`src/lib/lesson-resume.ts`) pins the Learn card to the lesson that session is resting in. So the claim IS applied, but the card doesn't visibly advance — it looks dead. Proven: in a clean browser (no open session) the same click advances 口/可 → 何/あなた correctly.

**Immediate workaround for Sam:** Current sessions → Discard the parked session, then the card advances.

**The fix:** an open session should not mask the frontier when the learner has since claimed/known its items — the resume should release, or "I already know these" should discard/supersede the resting session. This is "continue-session bug B" flagged earlier.

**Related:** overlaps with #12 (exact-position resume) — worth designing together.
