// The acknowledgement screen — the thing every screen showing dictionary data
// has to be able to reach. See src/data/attribution.ts for the obligation and
// src/components/library/attribution-link.tsx for the other half.
//
// A Server Component: it renders three constants and has no state, so there is
// nothing here that needs the client.

import { Card, Hint, Lbl, PageTitle } from "@/components/ui";
import { LICENCE_HREF, LICENCE_NOTE, SOURCES } from "@/data/attribution";

export const metadata = { title: "Dictionary data · Kana quiz" };

export default function AboutDataPage() {
  return (
    <>
      <PageTitle
        title="Where the data comes from"
        sub="Every kanji, reading, meaning and word in this app is somebody else's work."
      />

      <Card>
        <Lbl>Acknowledgement</Lbl>
        <p className="text-[13px] leading-relaxed">{LICENCE_NOTE}</p>
        <p className="mt-3">
          <Hint>
            <a href={LICENCE_HREF} target="_blank" rel="noopener" className="underline">
              The EDRDG licence in full ↗
            </a>
          </Hint>
        </p>
      </Card>

      <Card>
        <Lbl>The files</Lbl>
        {SOURCES.map((s) => (
          <div key={s.name} className="border-t border-border py-3 first:border-t-0 first:pt-0">
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
      </Card>

      <Card>
        <Lbl>Share-alike</Lbl>
        <p className="text-[13px] leading-relaxed text-text-muted">
          CC BY-SA is share-alike. The dictionary files this app reads are
          adaptations of EDRDG&rsquo;s, so they carry the same licence. The
          app&rsquo;s own code reads that data rather than deriving from it, and
          is MIT. Tatoeba&rsquo;s sentences are attribution-only — no
          share-alike.
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-text-muted">
          KanjiVG&rsquo;s stroke data is CC BY-SA 3.0, a version behind the rest.
          That is compatible in the direction it needs to be: a 3.0
          share-alike work may be used in a 4.0 one, so the diagrams sit
          alongside the dictionary data without conflict.
        </p>
      </Card>
    </>
  );
}
