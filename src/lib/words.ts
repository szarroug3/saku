// The app's word for its own numbers.
//
// Lives here rather than in a component because more than one screen says this
// phrase and it was never a card. Used to sit in home/deck-card.tsx, whose
// DeckCard and Shelf died with the char-keyed selection — results and stats
// were importing a Home component for a string function, which was fine while
// Home had shelves and is nonsense now.

/** "1 character" / "12 characters". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
