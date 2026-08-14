// The keigo subject constant, split out of data/keigo.ts because that module
// imports `vocabRow` from data/vocab.ts at the top level — so importing anything
// from keigo.ts, even this one string, pulls the ~8.6MB dictionary into the
// bundle. Same barrel-avoidance split as vocab-ids.ts.

export const KEIGO_SUBJECT = "keigo";
