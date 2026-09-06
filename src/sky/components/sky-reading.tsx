// A reading page: sections of prose under the sky, read once top to
// bottom. Tracked under Sky: Reading pages. Nothing here is interactive;
// the words are the page.

import { Eyebrow } from "@/sky/components/sky-card";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { Sound } from "@/sky/components/teach-page";
import type { ReadingPage } from "@/sky/lib/reading";

export function SkyReading({ page, height }: { page: ReadingPage; height?: string }) {
  return (
    <SkyPageShell eyebrow={page.eyebrow} title={page.title} lede={page.lede} height={height}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui">
        {page.sections.map((s) => (
          <SkyPanel key={s.id} title={s.title} className="max-w-3xl">
            <div className="mt-2 flex flex-col gap-3 text-[14px] leading-relaxed text-sky-ink/90">
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
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-accent">{l.name} ↗</a>
                      {l.blurb && <p className="mt-0.5 text-[13.5px] text-sky-ink/90">{l.blurb}</p>}
                      {l.note && <Eyebrow className="mt-1 mb-0 normal-case tracking-normal">{l.note}</Eyebrow>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SkyPanel>
        ))}
      </div>
    </SkyPageShell>
  );
}
