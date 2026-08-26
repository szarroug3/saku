// SAK-193: strip "do"/"does"/"doing" SCAFFOLDING from a recipe's gloss, at
// DISPLAY time only.
//
// A recipe's `gloss` writes its X slot the way a dictionary entry would —
// "may do X", "after doing X", "must not do X" — because appliedGloss
// (auto-page.ts) needs those exact words as SIGNALS: they tell it which
// English inflection (base, gerund, past, 3rd person) belongs in the teach
// page's Meaning column when X is filled with a real verb. That is a real
// consumer of the raw string and it must not be touched (SAK-191 already
// fixed it once).
//
// But everywhere ELSE the gloss is shown to a learner — the pattern page's own
// header, and the production quiz's instruction — "do"/"does"/"doing" is not
// English she is being taught, it is English SCAFFOLDING the app added so a
// bare "X" would parse as a sentence. Shown unfilled, "Must not do X." reads
// like a typo; shown filled with real Japanese, "must not do 食べる" reads
// worse: two languages fighting to both be the verb. Dropped, both read right:
// "Must not X." and "must not 食べる".
//
// "did"/"done" are NEVER touched here, unconditionally. Across every recipe in
// recipes.ts, they occur in exactly four glosses (ta-form, ta-koto-ga-aru,
// ta-bakari, ta-tokoro) and in every one of those the past tense IS the
// meaning being taught, not scaffolding around it — dropping it would delete
// the lesson. Nothing else in the table uses "did"/"done" at all, so a blanket
// "never touch them" is exact, not a special case.
export function dropDoScaffold(gloss: string): string {
  return (
    gloss
      // Everywhere the scaffold word sits directly in front of the X slot it
      // is standing in for — "may do X", "after doing X" — dropping just the
      // scaffold word leaves the X in place.
      .replace(/\b(?:do|does|doing) (?=X\b)/g, "")
      // tari-tari's "do things like X and Y" is the one gloss where the
      // scaffold word opens the WHOLE clause rather than sitting right before
      // X ("do things", not "do X") — a leading "do "/"does "/"doing " is
      // dropped unconditionally, whatever follows it.
      .replace(/^(?:do|does|doing) /, "")
  );
}
