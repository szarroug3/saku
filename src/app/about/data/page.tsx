// The acknowledgement screen — the thing every screen showing dictionary data
// has to be able to reach. See src/data/attribution.ts for the obligation and
// src/components/library/attribution-link.tsx for the other half.
//
// A Server Component: it renders three constants and has no state, so there is
// nothing here that needs the client.

import { Hint, Lbl, PageTitle } from "@/components/ui";
import { LICENCE_HREF, LICENCE_NOTE, SOURCES } from "@/data/attribution";

export const metadata = { title: "Dictionary data" };

export default function AboutDataPage() {
  return (
    <div className="max-w-2xl">
      <PageTitle
        title="Where the data comes from"
        sub="Every kanji, reading, meaning and word in this app is somebody else's work."
      />

      <section className="mt-8 first:mt-0">
        <Lbl>Acknowledgement</Lbl>
        <p className="text-[13px] leading-relaxed">{LICENCE_NOTE}</p>
        <p className="mt-3">
          <Hint>
            <a href={LICENCE_HREF} target="_blank" rel="noopener" className="underline">
              The EDRDG licence in full ↗
            </a>
          </Hint>
        </p>
      </section>

      <section className="mt-8 border-t border-white/[0.08] pt-6">
        <Lbl>The files</Lbl>
        <div className="space-y-3">
          {SOURCES.map((s) => (
            <div key={s.name}>
              <p className="text-[13px] font-semibold">
                <a href={s.href} target="_blank" rel="noopener" className="text-accent no-underline">
                  {s.name} ↗
                </a>
              </p>
              <p className="mt-0.5 text-[13px] text-text-muted">{s.what}</p>
              <p className="mt-0.5">
                <Hint>
                  {s.holder} · {s.licence}
                </Hint>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 border-t border-white/[0.08] pt-6">
        <Lbl>Share-alike</Lbl>
        <p className="text-[13px] leading-relaxed text-text-muted">
          CC BY-SA is share-alike. The dictionary files this app reads are
          adaptations of EDRDG&rsquo;s, so they carry the same licence. The
          app&rsquo;s own code reads that data rather than deriving from it, and
          is MIT. Tatoeba&rsquo;s sentences are attribution-only, with no
          share-alike.
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-text-muted">
          KanjiVG&rsquo;s stroke data is CC BY-SA 3.0, a version behind the rest.
          That is compatible in the direction it needs to be: a 3.0
          share-alike work may be used in a 4.0 one, so the diagrams sit
          alongside the dictionary data without conflict.
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-text-muted">
          CEJC&rsquo;s raw conversation-frequency files are not included. The app
          ships only the reduced reading order used for its own vocabulary, and
          identifies that educational analysis separately rather than relicensing
          NINJAL&rsquo;s work as CC BY-SA.
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-text-muted">
          Frequency comparisons never cross JMdict meanings. When every reading
          has the same sense coverage and CEJC provides at least 50 observations,
          a reading at or below 5% of usage moves to the Library&rsquo;s Other
          dictionary readings section instead of the teaching table.
        </p>
      </section>
    </div>
  );
}
