// Resources — the credits/attributions page. A courtesy list, not a licence
// obligation: the EDRDG acknowledgement the licence REQUIRES lives at
// /about/data (see src/data/attribution.ts) and is reachable from every screen
// that shows dictionary data. This page is where the rest of the debts are
// named — the guides the app learned kana from, the stroke-order glyphs, the
// example sentences, and the frequency lists that order the words — so they
// have a home in the chrome rather than only in code comments.
//
// A Server Component: it renders constants and has no state.

import { Card, Hint, Lbl, PageTitle } from "@/components/ui";

export const metadata = { title: "Resources · Kana quiz" };

/** An outbound credit link. target=_blank + rel=noopener noreferrer per task. */
function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent no-underline"
    >
      {children} ↗
    </a>
  );
}

export default function ResourcesPage() {
  return (
    <>
      <PageTitle
        title="Resources"
        sub="What this app was built on, and who to thank for it."
      />

      <Card>
        <Lbl>Where this started</Lbl>
        <p className="text-[13px] leading-relaxed">
          The app&rsquo;s author learned hiragana and katakana from{" "}
          <Ext href="https://www.tofugu.com/japanese/learn-hiragana/">
            Tofugu
          </Ext>
          . Its picture-mnemonic approach — a story for each shape, learned
          before you&rsquo;re tested — is the one this app teaches with.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed">
          Tofugu&rsquo;s own guides:{" "}
          <Ext href="https://www.tofugu.com/japanese/learn-hiragana/">
            Learn hiragana
          </Ext>{" "}
          ·{" "}
          <Ext href="https://www.tofugu.com/japanese/learn-katakana/">
            Learn katakana
          </Ext>
        </p>
      </Card>

      <Card>
        <Lbl>Stroke-order data</Lbl>
        <p className="text-[13px] leading-relaxed">
          Stroke order comes from{" "}
          <Ext href="https://kanjivg.tagaini.net/">KanjiVG</Ext>, &copy; Ulrich
          Apel and contributors, used under CC BY-SA 3.0.
        </p>
      </Card>

      <Card>
        <Lbl>Dictionary &amp; kanji data</Lbl>
        <p className="text-[13px] leading-relaxed">
          Readings, meanings and vocabulary come from JMdict and KANJIDIC2,
          &copy; the{" "}
          <Ext href="https://www.edrdg.org/">
            Electronic Dictionary Research and Development Group
          </Ext>{" "}
          (EDRDG), used under the EDRDG Licence (CC BY-SA 4.0).
        </p>
        <p className="mt-1.5">
          <Hint>
            This app&rsquo;s data is itself CC BY-SA 4.0. The full
            acknowledgement, as the licence requires it, is on the{" "}
            <a href="/about/data" className="text-accent no-underline">
              data page
            </a>
            .
          </Hint>
        </p>
      </Card>

      <Card>
        <Lbl>Example sentences</Lbl>
        <p className="text-[13px] leading-relaxed">
          Example sentences come from{" "}
          <Ext href="https://tatoeba.org/">Tatoeba</Ext> and its contributors,
          used under CC BY 2.0 FR.
        </p>
      </Card>

      <Card>
        <Lbl>Frequency &amp; level data</Lbl>
        <p className="text-[13px] leading-relaxed">
          The order words are introduced in blends a consensus of JLPT-level
          lists with subtitle and spoken-frequency data. No single source is
          authoritative here — the JLPT withdrew its official vocabulary list in
          2010, so any level shown is a best estimate, not a fact.
        </p>
      </Card>
    </>
  );
}
