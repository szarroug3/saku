# 11 — Sync Part 2: in-progress session teleport ⚪ queued

Make a half-answered quiz sync across devices so Sam can pick up on the phone what she started on the computer. Serialize the full session runtime (position, answers so far, requeue state, stats) and sync it to the server (debounced ~2s + on round/page boundaries). Another device reads and resumes.

Depends on Part 1 (#05) for the settings/sync plumbing. Last-writer-wins per session. `saku-session` currently lives only in localStorage by design — this changes that.
