# 14 — Retire file mode → default to logged-out + localStorage ⚪ queued (after 5 branches merge)

Remove the `STORAGE_BACKEND` env var and the whole "file mode" backend (server `history.json`/`settings.json`/`session.json` + the always-signed-in `LOCAL_USER`). Make "no Supabase session" always route to the signed-out **localStorage** path — the same path a signed-out prod user already uses. Result: locally you're logged out, saving to localStorage, with the sign-in/out UI available (fixes "no sign-out button" locally); prod signed-in still syncs to the server.

**Do AFTER** #05 (settings) and #11 (session) merge — both added file-mode branches this would remove; build on the final storage layer.

**Knock-ons:** touches the file-mode branch in history/settings/session storage; the e2e tests run in file mode (signed-in LOCAL_USER) and move to the signed-out-localStorage path — update the harness (arguably an improvement: tests the real signed-out flow). `isSupabaseStore()` likely becomes "Supabase keys present" rather than an explicit env flag.
