# 12 — Sync Part 3: exact-position resume ⚪ queued

"Continue session" should pick up exactly where Sam left off — mid-lesson-page, or round N question M — instead of restarting the walk. Once the full runtime is synced (#11), resume restores the cursor rather than rebuilding from scratch.

**Now also covers #07 (continue-session masking):** an open session must not pin the Learn card so "I already know these" looks dead — the resume releases when the learner claims/knows the resting items. Built together with exact-position resume, after #11 lands.
