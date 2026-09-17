// A reading page: sections of prose under the sky, read once top to
// bottom. Tracked under Sky: Reading pages. Nothing here is interactive;
// the words are the page.

import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { Sound } from "@/sky/components/teach-page";
import { SkyPageBody } from "@/sky/components/sky-page-body";
import type { ReadingPage } from "@/sky/lib/reading";

export function SkyReading({ page, height }: { page: ReadingPage; height?: string }) {
  return (
    <SkyPageShell eyebrow={page.eyebrow} title={page.title} height={height}>
      <SkyPageBody>
        {/* Two columns from the lg breakpoint up (SAK-450). The lines stay short
            (SAK-361 capped them at 68 characters, because a paragraph the
            panel's whole width is 200 characters a line), but a full-width
            panel around half-width text left the right half of every section
            empty. So the sections flow down one column and then the next, each
            panel as wide as its column and never split across the two. The
            wrapper is a block of its own: multi-column does not lay out a flex
            container's children, and the body above is one. */}
        <div className="gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {page.sections.map((s) => (
          <SkyPanel key={s.id} title={s.title}>
            <div className="mt-2 flex max-w-[68ch] flex-col gap-3 text-[14px] leading-relaxed text-sky-ink/90 lg:max-w-none">
              {s.paragraphs?.map((p, i) => <p key={i}><Sound line={p} /></p>)}
              {s.bullets && (
                <ul className="flex flex-col gap-2.5">
                  {s.bullets.map((b) => (
                    <li key={b.label}><span className="font-semibold text-sky-accent">{b.label}.</span> <Sound line={b.body} /></li>
                  ))}
                </ul>
              )}
              {s.after?.map((p, i) => <p key={`after-${i}`}><Sound line={p} /></p>)}
              {s.links && (
                <ul className="flex flex-col gap-3">
                  {s.links.map((l) => (
                    <li key={l.href}>
                      {/* the arrow is the only sign the link leaves the app, so
                          it stays on screen, but it is not part of the link's
                          name: a screen reader says "JMdict" (SAK-361) */}
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-accent">{l.name} <span aria-hidden>↗</span></a>
                      {l.blurb && <p className="mt-0.5 text-[13.5px] text-sky-ink/90">{l.blurb}</p>}
                      {/* a credit line, not an eyebrow: who holds it and on
                          what terms, said quietly rather than in small caps */}
                      {l.note && <p className="mt-1 text-[12.5px] text-sky-muted">{l.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SkyPanel>
        ))}
        </div>
      </SkyPageBody>
    </SkyPageShell>
  );
}
