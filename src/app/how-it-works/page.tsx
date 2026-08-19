// How Saku works — the reference page. SAK-27.
//
// Content lives in src/data/how-it-works.ts (same split as /resources: data
// separate from the render, so the section order and the copy can be pinned by
// a plain-object test without rendering React). This file is just the render.
//
// DE-BOXED, like Settings and Resources: no Card chrome, an Lbl per section, a
// reading-width column. A reference page is read top to bottom once and then
// searched with browser-find, not scanned as cards.
//
// PRESENTATION, ROUND TWO (second review pass, same ticket): "unmute the
// headers and main text. accent the things that need to stand out." Section
// headers now use Lbl's tone="accent" (the same lift the Practice page's
// group headers use over their own sub-labels) instead of the default muted
// eyebrow, so they lead the page rather than blend into it. A handful of
// terms/numbers per section are wrapped in text-accent via accentTerms() and
// HOW_IT_WORKS_SECTIONS' paragraphAccents/bodyAccents (src/data/how-it-works.ts)
// — the real landmarks, not a rewrite. And the bullet body / afterBullets text,
// which was text-text-muted, is promoted to full text-text: it's the actual
// content of each definition, not a footnote to something bolder above it.
//
// A Server Component: it renders constants and has no state.

import { HOW_IT_WORKS_SECTIONS, type HowItWorksBullet } from "@/data/how-it-works";
import { accentTerms, Lbl, PageTitle } from "@/components/ui";

export const metadata = { title: "How Saku works" };

function Bullet({ item }: { item: HowItWorksBullet }) {
  return (
    <li className="text-[13px] leading-relaxed text-text">
      <span className="font-medium text-accent">{item.label}.</span>{" "}
      <span className="text-text">{accentTerms(item.body, item.bodyAccents ?? [])}</span>
    </li>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="max-w-2xl">
      <PageTitle
        title="How Saku works"
        sub="A reference for the SRS, the round structure, and what your progress words mean."
      />

      {HOW_IT_WORKS_SECTIONS.map((section) => (
        <section key={section.id} className="mt-8 first:mt-0">
          <Lbl tone="accent">{section.title}</Lbl>
          {section.paragraphs.map((p, i) => (
            <p
              key={i}
              className="mb-3 text-[13px] leading-relaxed text-text last:mb-0"
            >
              {accentTerms(p, section.paragraphAccents?.[i] ?? [])}
            </p>
          ))}
          {section.bullets ? (
            <ul className="list-none space-y-3">
              {section.bullets.map((b) => (
                <Bullet key={b.label} item={b} />
              ))}
            </ul>
          ) : null}
          {section.afterBullets?.map((p, i) => (
            <p key={i} className="mt-3 text-[13px] leading-relaxed text-text last:mb-0">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
