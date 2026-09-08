// The reading pages' words, from the app's own data files, in the Sky's
// shape. How Saku works from src/data/how-it-works.ts; where the data
// comes from and the resources list from src/data/attribution.ts and
// src/data/resources.ts. The copy lives once, there. Spelled the American
// way here (Sam, 2026-09-06), since the app's data still says "licence".

import { LICENCE_HREF, LICENCE_NOTE, SOURCES } from "@/data/attribution";
import { HOW_IT_WORKS_SECTIONS } from "@/data/how-it-works";
import { RESOURCE_SECTIONS } from "@/data/resources";
import { accented, type ReadingPage, type ReadingSection } from "@/sky/lib/reading";

const american = (text: string) => text.replace(/licence/g, "license").replace(/Licence/g, "License");

export function howItWorksPage(): ReadingPage {
  return {
    eyebrow: "How Saku works",
    title: "How does Saku work?",
    sections: HOW_IT_WORKS_SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      paragraphs: s.paragraphs.map((p, i) => accented(p, s.paragraphAccents?.[i] ?? [])),
      ...(s.bullets ? { bullets: s.bullets.map((b) => ({ label: b.label, body: accented(b.body, b.bodyAccents ?? []) })) } : {}),
      ...(s.afterBullets ? { after: s.afterBullets.map((p) => accented(p)) } : {}),
    })),
  };
}

const SHARE_ALIKE = [
  "CC BY-SA is share-alike. The dictionary files this app reads are adaptations of EDRDG's, so they carry the same license. The app's own code reads that data rather than deriving from it, and is MIT. Tatoeba's sentences are attribution-only, with no share-alike.",
  "KanjiVG's stroke data is CC BY-SA 3.0, a version behind the rest. That is compatible in the direction it needs to be: a 3.0 share-alike work may be used in a 4.0 one, so the diagrams sit alongside the dictionary data without conflict.",
  "CEJC's raw conversation-frequency files are not included. The app ships only the reduced reading order used for its own vocabulary, and identifies that educational analysis separately rather than relicensing NINJAL's work as CC BY-SA.",
  "Frequency comparisons never cross JMdict meanings. When every reading has the same sense coverage and CEJC provides at least 50 observations, a reading at or below 5% of usage moves to the Atlas's other dictionary readings rather than the teaching table.",
];

export function aboutPage(): ReadingPage {
  const resources: ReadingSection[] = RESOURCE_SECTIONS.map((s) => ({
    id: `resources-${s.id}`,
    title: s.title,
    links: s.items.map((r) => ({ name: r.name, href: r.url, blurb: r.blurb })),
  }));
  return {
    eyebrow: "About",
    title: "Where does the data come from?",
    sections: [
      { id: "acknowledgement", title: "Acknowledgement", paragraphs: [accented(american(LICENCE_NOTE))], links: [{ name: "The EDRDG license in full", href: LICENCE_HREF }] },
      { id: "files", title: "The files", links: SOURCES.map((s) => ({ name: s.name, href: s.href, blurb: s.what, note: `${s.holder} · ${american(s.licence)}` })) },
      { id: "share-alike", title: "Share-alike", paragraphs: SHARE_ALIKE.map((p) => accented(p)) },
      // The page changes subject here, from what Saku is built on to where
      // else to go, and used to do it with no warning (SAK-361).
      { id: "other-places", title: "Other places to learn", paragraphs: [accented("Saku does not teach everything. These are other people's sites and books, worth going to for what it leaves out.")] },
      ...resources,
    ],
  };
}
