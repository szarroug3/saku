# 26 — Discarding a session still advances the track 🟠 (bug)
Starting a session marks its facts seen (advancing the frontier) before the drill; discarding the session does not roll that back, so the track advances even though nothing was completed. Discard should NOT advance the track — only completing should.
