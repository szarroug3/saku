# P2 · Remove the `draft` flag

**Status: done** — merged `db993e0`

## Open questions

- **The approved/draft record did not leave the repo.** Ten row headers in `mnemonics.ts` still encode the split (`// ---- T row (DRAFT) ----`). Keep or remove them? **I recommend keep**: the objection to `draft: true` was that it looked like a gate and was not one, and a comment makes no such claim.

Sam: *"what was the intention of this? was this to mark the mnemonics as in
progress? if so, remove it. the app is only local for now."*

## What it is

`src/data/mnemonics.ts` entries can carry `draft: true`. It was evidently meant to
mark an entry as unfinished.

**Nothing in the codebase reads it.** Grepped every consumer: no gate, no filter,
no conditional render. A draft entry ships to the learner identically to a
finished one. The file's own comment admits it: *"the card renders draft and
approved rows identically"*.

So the flag has never protected anything, and its presence is actively misleading:
it reads as a safety net that does not exist.

## What to do

Remove the field and every use of it. Do **not** build the gate instead — Sam's
call, and it is the right one while the app is local and the mnemonics are being
actively authored. Nobody is protected from work-in-progress on their own machine,
and a half-hidden set of entries would make review harder rather than easier.

Track authoring progress in `STATUS.md` or the mnemonics review queue, where it is
visible, rather than in a field that silently does nothing.

## Done when

- `draft` is gone from the type and every entry.
- No dead references remain.

---

## Resolved 2026-07-20, merged `db993e0`

Field and all **31** entries removed (た through ん; the earlier figure of 33 was
my miscount, from a grep that matched two prose lines). The test asserting the
flag was deleted rather than rewritten: every assertion in it read `.draft`, so
there was no residual invariant to preserve, and a rewrite could only have
produced a test that ran and proved nothing. 1035 unit tests became 1034.

Verified: no mnemonic content changed, no reference to the field remains, and the
four unrelated uses of the word "draft" elsewhere are untouched.

### Open question this raised

**The approved/draft record did not leave the repo**, contrary to what I told Sam
when dispatching. `mnemonics.ts` carries ten row headers that encode the same
split verbatim:

```
// ---- S row — さ し す せ そ (APPROVED) ----
// ---- T row — た ち つ て と (DRAFT) ----
```

plus an "APPROVED vs DRAFT" section header. The agent left them because the brief
enumerated three specific comment sites and these were not among them, which was
the right call rather than a miss.

**Decision for Sam:** keep or remove. My recommendation is **keep**. The objection
to `draft: true` was that it looked like a gate and was not one; a comment header
makes no such claim. These are also more useful than the boolean was, since they
group by row and one of them carries a real pronunciation note (the R row).
