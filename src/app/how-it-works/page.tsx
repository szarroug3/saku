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
// A Server Component: it renders constants and has no state.

import { HOW_IT_WORKS_SECTIONS, type HowItWorksBullet } from "@/data/how-it-works";
import { Lbl, PageTitle } from "@/components/ui";

export const metadata = { title: "How Saku works" };

function Bullet({ item }: { item: HowItWorksBullet }) {
  return (
    <li className="text-[13px] leading-relaxed text-text">
      <span className="font-medium text-text">{item.label}.</span>{" "}
      <span className="text-text-muted">{item.body}</span>
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
          <Lbl>{section.title}</Lbl>
          {section.paragraphs.map((p, i) => (
            <p
              key={i}
              className="mb-3 text-[13px] leading-relaxed text-text last:mb-0"
            >
              {p}
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
            <p
              key={i}
              className="mt-3 text-[13px] leading-relaxed text-text-muted last:mb-0"
            >
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
