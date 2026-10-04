// A recipe's gloss is written for a verb: "may do X", "did X", "I heard that X".
// When X is an adjective or a noun, some of those frames stop reading as
// English: "may do expensive", "I heard that expensive". This turns the gloss
// into one an adjective or noun fits, with the X slot still in it, so each
// caller fills X its own way. The lesson table (appliedGloss in auto-page.ts)
// fills it with the English word, and the quiz instruction fills it with the
// Japanese one. Both read this one function, so the two cannot drift
// (SAK-191, SAK-500).
//
// A row whose pattern means something different on a noun (のために is "for
// the sake of", not "in order to") does not come through here. It carries its
// own `meaning` on the recipe attachment, read through `attachmentMeaning`.
export function nonVerbGloss(gloss: string): string {
  return (
    gloss
      // A verb-only first half (〜すぎる "do X too much / too X", 〜そう "looks
      // like it will X / looks X") does not apply to an adjective. Drop it and
      // keep the half that does.
      .replace(/^.*? \/ (?=(?:too|looks?) X\b)/, "")
      // "do X" is a verb. At the start of a clause, an adjective takes "is"
      // ("is expensive, and then"). After a modal it takes "be" ("may be
      // expensive"). "did X" becomes "was X".
      .replace(/^do X\b/, "is X")
      .replace(/\bdo X\b/g, "be X")
      .replace(/\bdid X\b/g, "was X")
      // What someone heard or says is a clause, and a clause needs a subject
      // and a verb: "I heard it's expensive", "they say it's a book" (SAK-500).
      .replace(/\b(heard|hear|say) (?:that )?X\b/g, "$1 it's X")
  );
}
