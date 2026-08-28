# Audit 08: sync/multi-device audit

Read `how-to-run-an-audit.md` in this folder first — this file only covers what's specific to this audit.

**Subject**: does signing in and using Saku across more than one device or browser actually keep progress consistent?

**Role**: a QA engineer specifically probing the multi-device/sync code path. By default, progress lives entirely in one browser's `localStorage` — every other audit in this folder assumes that single-device model. But the app also offers sign-in specifically to "keep it across your devices," a real, separate code path (auth, sync/merge logic, conflict handling) nothing else here touches at all. Sync bugs are a classic, easy-to-miss category precisely because they only show up under multi-device use, which a single-session audit (or a single-session developer) never naturally exercises.

## What to check

- **Basic sync**: progress made signed-in on device/browser A actually appears on device/browser B after signing in there.
- **Conflict handling**: progress made on TWO devices while briefly offline or out of sync, then both coming back online — does it merge sensibly, or does one device's progress silently overwrite the other's?
- **Sign-in/sign-out transitions**: does switching from signed-out (local-only) to signed-in correctly adopt or merge the local progress that already existed, rather than discarding it?
- **Partial/interrupted sync**: a sync that fails partway through (network drop mid-write) — does it leave data in a broken or duplicated state?
- **What silent data loss would even look like**: since progress rarely gets externally audited, a real loss could go unnoticed for a long time — construct a scenario where loss would be OBSERVABLE (record exact counts/state before and after each step) rather than just "try it and see if it feels right."

## Execution note

Needs live browser tools and a running dev server, plus at least two independent browser sessions/contexts running the same account in parallel — naturally two agents (or one agent driving two tabs/contexts) coordinating on timing. Needs real sign-in, so check what auth setup this requires (see `SAKU_DISABLE_AUTH`, and how the e2e suite runs signed-out by design — this audit needs its own approach, not that pattern). **Use a disposable/test account, never Sam's real one** — see the ground rules in `how-to-run-an-audit.md`.

## Verify technique

An independent agent reproduces the same before/after state comparison from a fresh pair of sessions — sync bugs are often timing-dependent, so one clean run doesn't rule out a race condition. Include at least one deliberately-adversarial-timing attempt (both devices writing at nearly the same moment), not just a clean sequential test.
