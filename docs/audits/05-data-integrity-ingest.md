# Audit 05: data-integrity/ingest audit

Read `how-to-run-an-audit.md` in this folder first — this file only covers what's specific to this audit.

**Subject**: the generated data pipeline itself — `vocab.json`, `pitch.json`, the grammar corpus, and the other `src/data/generated/*` outputs — for internal consistency and staleness against their sources.

**Role**: a data-pipeline reviewer, not a learner or content expert. Not checking whether specific taught content is correct — checking whether the PIPELINE producing that content is sound. A bug here doesn't show up as "this one word is wrong," it shows up as a whole category being subtly off, or a generated file silently drifting out of sync with the source data it claims to represent.

## What to check

- Duplicate entries that should have collapsed into one.
- Orphaned references — a fact ID, a pattern ID, a cross-reference that doesn't resolve to real content anywhere.
- Staleness — does regenerating a data file from its source (where a `build:*` script exists — see `package.json`) produce byte-identical output to what's committed? A mismatch means the committed file is stale.
- Schema violations — missing required fields, a field present for some rows of a type and absent for others with no principled reason.
- Cross-file consistency — does a fact referenced in one generated file actually correspond to a real entry in another?

## Execution note

Mostly code/data reading and scripting, no browser needed. Splits naturally by data domain (vocab, kanji, pitch, grammar corpus, counters) — one agent per domain, in parallel.

## Verify technique

Actually attempt to regenerate the data from source where a build script exists, and diff against committed output — never just eyeball the committed file and declare it plausible.
