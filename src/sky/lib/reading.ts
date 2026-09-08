// A reading page's model: sections of prose to read top to bottom once.
// How Saku works, and where the data comes from. Tracked under Sky:
// Reading pages. The words come from the app's own data files through the
// route; this only says what shape a page has.

import type { SoundLine } from "./lesson";

interface ReadingBullet {
  /** The lead word or phrase, in the accent. */
  label: string;
  body: SoundLine;
}

interface ReadingLink {
  name: string;
  href: string;
  /** What it is, in a line. */
  blurb?: string;
  /** A quieter line under it: who holds it, on what terms. */
  note?: string;
}

export interface ReadingSection {
  id: string;
  title: string;
  paragraphs?: readonly SoundLine[];
  bullets?: readonly ReadingBullet[];
  /** Paragraphs after the bullets. */
  after?: readonly SoundLine[];
  links?: readonly ReadingLink[];
}

export interface ReadingPage {
  eyebrow: string;
  title: string;
  sections: readonly ReadingSection[];
}

/** Text with a few terms in the accent: the terms are exact substrings. */
export function accented(text: string, terms: readonly string[] = []): SoundLine {
  const line: { text: string; accent?: boolean }[] = [];
  let rest = text;
  while (rest) {
    let first: { at: number; term: string } | null = null;
    for (const term of terms) {
      const at = rest.indexOf(term);
      if (at >= 0 && (!first || at < first.at)) first = { at, term };
    }
    if (!first) { line.push({ text: rest }); break; }
    if (first.at > 0) line.push({ text: rest.slice(0, first.at) });
    line.push({ text: first.term, accent: true });
    rest = rest.slice(first.at + first.term.length);
  }
  return line;
}
