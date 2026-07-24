# 12 — Sync Part 3: exact-position resume ⚪ queued

"Continue session" should pick up exactly where Sam left off — mid-lesson-page, or round N question M — instead of restarting the walk. Once the full runtime is synced (#11), resume restores the cursor rather than rebuilding from scratch.

Subsumes the continue-session bugs in #07 (design them together).
