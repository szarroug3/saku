# Audit 07: code/architecture audit

Read `how-to-run-an-audit.md` in this folder first — this file only covers what's specific to this audit.

**Subject**: the codebase's data layer, component layer, and API layer — internal consistency, soundness, and scalability. Not learner-facing at all.

**Role**: a senior engineer doing an architecture review — the only audit in this folder not looking at what the code produces, but at the code itself.

## The hard-won lesson this audit already has, from real experience

A prior pass at exactly this kind of audit (SAK-105, data-model/component-reuse drift) first concluded most things were "fine" or "excusable work-in-progress," based on checking one plausible-looking call site per pattern and citing a file's own header comment as evidence of convergence. That was wrong: the actual question is ADOPTION COVERAGE — what fraction of consumers actually use the new pattern vs. still bypass it — and "additive, not yet consumed" is itself a finding to report with real weight, not a reason to wave a section off as low-risk.

## What to check

- Data-model consistency — parallel/duplicate representations of the same concept that should have converged onto one.
- Component reuse — is a shared component/pattern actually adopted everywhere it applies, or do some call sites still hand-roll their own version (and is anything NEW being built that bypasses it, creating more work to converge later)?
- API/data-fetching pattern consistency — consistent conventions for server actions, caching, error handling.
- Scalability — as the corpus/curriculum grows, do algorithms and data structures still hold up, or are there patterns starting to strain?
- Type-safety escape hatches — `any`/`unknown` misuse, non-null assertions clustering in ways that suggest fragile code, not principled ones.
- Test coverage gaps in core modules other audits' eventual fixes would need to rely on being solid.

## Execution note

Pure code-reading and static analysis, no browser needed at all. The `code-review` and `simplify` skills (invoke via the Skill tool) cover some of this ground already — lean on them as components rather than re-deriving the same checks from scratch. Splits naturally by layer (data, component, API) or by subsystem.

## Verify technique

Per the hard-won lesson above: enumerate and check EVERY consumer of a flagged pattern, never just confirm the finder's first example looks right. "Fully adopted, no issue" needs the same rigor as "not adopted" — both are claims about the WHOLE set of consumers, not one.
