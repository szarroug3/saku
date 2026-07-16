"use client";

// Kana chart — Tofugu reference links, a live kana/romaji search, and a
// speakable grid of every character (mnemonic as a hover tooltip).

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Card, Hint, Lbl, PageTitle } from "@/components/ui";
import { mnemonicFor, SETS } from "@/data/characters";
import { useQuizConfig } from "@/lib/quiz-config";
import { speak } from "@/lib/speech";

function TofuguLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="ml-2.5 whitespace-nowrap text-xs text-accent no-underline"
    >
      {children}
    </a>
  );
}

/** True once the search field has pinned itself to the top of the viewport.
 *
 * An IntersectionObserver on a zero-height sentinel sitting immediately above
 * the field: while the sentinel is on screen the field is in the flow, and the
 * frame it leaves through the top is the frame the field pins. That is the
 * boring route, and it is the one that works — the elegant route is
 * `container-type: scroll-state` + `@container scroll-state(stuck: top)`,
 * which is Chrome 133+ and, on anything older, silently resolves to "never
 * stuck". A stuck-detection that fails closed doesn't degrade the fix, it
 * deletes it, and leaves nothing on screen to say so. IntersectionObserver is
 * everywhere this app already runs.
 */
function useStuck(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: [0] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [sentinel, stuck];
}

export default function ChartPage() {
  const { cfg } = useQuizConfig();
  const [query, setQuery] = useState("");
  const [sentinel, stuck] = useStuck();

  const qRaw = query.trim();
  const q = qRaw.toLowerCase();

  const scripts = SETS.map((set) => ({
    set,
    sections: set.sections
      .map((section) => ({
        section,
        chars: section.chars.filter(
          (ch) =>
            !q || ch.c.includes(qRaw) || ch.r.some((r) => r.includes(q)),
        ),
      }))
      .filter((s) => s.chars.length > 0),
  })).filter((s) => s.sections.length > 0);

  return (
    <>
      <PageTitle title="Kana chart" sub="Click a character to hear it." />
      <Card>
        <p className="mb-1.5 text-[13px]">
          <span className="text-text-muted">Tofugu guides:</span>
          <TofuguLink href="https://www.tofugu.com/japanese/learn-hiragana/">
            Hiragana ↗
          </TofuguLink>{" "}
          ·
          <TofuguLink href="https://www.tofugu.com/japanese/learn-katakana/">
            Katakana ↗
          </TofuguLink>
        </p>
        <p className="text-[13px]">
          <span className="text-text-muted">Charts:</span>
          <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana/hiragana-chart-by-tofugu.jpg">
            Hiragana chart ↗
          </TofuguLink>{" "}
          ·
          <TofuguLink href="https://files.tofugu.com/articles/japanese/2016-03-07-hiragana-mnemonics-chart/hiragana-mnemonic-chart-by-tofugu.jpg">
            Hiragana mnemonics ↗
          </TofuguLink>{" "}
          ·
          <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-09-03-learn-katakana/tofugu-katakana-chart.jpg">
            Katakana chart ↗
          </TofuguLink>{" "}
          ·
          <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-09-03-learn-katakana/tofugu-katakana-mnemonic-chart.jpg">
            Katakana mnemonics ↗
          </TofuguLink>
        </p>
      </Card>
      {/* The search field PINS — you filter 214 characters with it, and it used
          to scroll away at the first section, so refining a search meant
          scrolling back up to reach the box that drives the page.
          `sticky top-0` is the app's idiom for this (grid/pairs/drill HUDs).
          z-10 is not decoration: the Cards below are LATER siblings, so at
          `z-index: auto` they paint straight over a pinned field.

          `kq-surface` instead of `bg-card`, and that swap is the whole fix.
          What has to happen here is OCCLUSION — kana must vanish under this
          field, not show through it — and the obvious tool is a no-op:

            a backdrop-filter inside an element that already has one does
            nothing in Chromium (the outer one becomes a backdrop root).

          In kiri, `rounded-lg` + `bg-card` IS the input recipe that hands this
          field `backdrop-filter: blur(18px)` (see globals.css), so any blur we
          added here would be inside our own backdrop root and silently do
          nothing — leaving kiri's --card (5.5% white) to hold back the chart
          on its own, which it cannot. That is the bug that has been "fixed"
          three times: sticky quiz header, trend tooltip, grid scrim. The trap
          in reaching for an opaque fill instead is that a colour that merely
          approximates the field reads as a grey slab sitting on the page.

          kq-surface is the existing answer to exactly this and needs no new
          CSS: --bg, then the mesh at `background-attachment: fixed` (the same
          anchoring body::before uses, so the gradients land on identical
          pixels), then --card over both. Not a colour LIKE the field's — the
          field's own recipe, rebuilt opaque. So it stays the same field, still
          drifting through kiri's violet and teal as the page does, and the
          chart simply ends at its edge. It resolves to plain --card in aizome,
          graphite and momentum, whose --card is already opaque, so those three
          are pixel-identical to before and aizome stays unfrosted.

          Dropping `bg-card` is what makes that true rather than a fight: two
          rules setting background-color is a source-order argument, and it
          also drops kiri's now-pointless blur (a full-width backdrop snapshot
          every scroll frame). `shadow-btn` re-states the elevation the
          bg-card recipe was giving it, so the field looks untouched.

          MEASURED CORRECTION to the paragraph above. "The field's own recipe,
          rebuilt opaque" was two ingredients out of three: a real kiri card
          frosts with `blur(18px) saturate(150%)`, and this rebuild carried the
          fill and the mesh but not the saturate. Measured against a genuine
          card over the same mesh, kiri dark was 3.98 dE — a visibly duller
          rectangle, and the "search box has different opacity" in the report.
          The saturate now happens in globals.css, on .kq-surface's pseudo. */}
      {/* Zero-height, and it must stay directly above the field: it is what
          `useStuck` watches. */}
      <div ref={sentinel} aria-hidden="true" />
      {/* THE FIELD IS A FIELD UNSTUCK AND A BAND STUCK, and the wrapper is what
          lets it be both.
          `kq-surface` lives HERE and not on the input, for two reasons that
          arrived together. The surface has to be SATURATED to match a real
          card (see globals.css), which means `filter`, which means a
          pseudo-element — and an <input> is replaced content and renders no
          ::before at all. The wrapper renders one.

          THE SHAPING. Rounded is right for a field sitting in a layout and
          wrong for a lid over scrolling content: pinned, the chart slid up
          through the quarter-circle gaps at the bar's shoulders, which is the
          "doesn't look right while it's floating". So stuck squares the top
          corners and drops the shelf shadow, and the bottom border becomes the
          boundary rule. The bottom corners stay rounded: nothing scrolls UP
          from below, so there is no gap to close there, and keeping them is
          what stops the band from reading as a different component than the
          field it just was.

          No `bg-card`, deliberately. The `[class~="rounded-lg"][class~="bg-card"]`
          recipe in globals.css would hand this a `backdrop-filter` that is a
          no-op inside its own backdrop root — the bug this whole surface
          exists to route around — and `rounded-lg` on its own matches nothing,
          so squaring the corners cannot arm or disarm a recipe either way. */}
      <div
        className={`kq-surface sticky top-0 z-10 mb-3 w-full ${
          stuck ? "rounded-b-lg" : "rounded-lg shadow-btn"
        }`}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search kana or romaji — し, shi, kyo…"
          className={`w-full border border-border bg-transparent px-2.5 py-2 text-[15px] text-text ${
            stuck ? "rounded-b-lg rounded-t-none" : "rounded-lg"
          }`}
        />
      </div>
      {/* Wrapper, and it is load-bearing. graphite paints its signature lit
          hairline on `[class~="sticky"] + [class~="rounded-xl"][class~="bg-card"]`
          — the card following the drill HUD. The field above is now `sticky`
          and the first script Card was its next sibling, so graphite was about
          to decorate the Hiragana card with the active-quiz detail. A plain
          div between them matches nothing and keeps that rule to its subject. */}
      <div>
        {scripts.length === 0 ? (
          <p>
            <Hint>{`Nothing matches "${qRaw}".`}</Hint>
          </p>
        ) : (
          scripts.map(({ set, sections }) => (
            <Card key={set.id}>
              <Lbl>
                {set.label} {set.labelJa}
              </Lbl>
              {sections.map(({ section, chars }) => (
                <div key={section.id}>
                  <p className="mb-0.5 mt-3 text-xs font-semibold text-text-muted">
                    {section.label}
                  </p>
                  <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                    {chars.map((ch) => {
                      const mn = mnemonicFor(ch, section.label);
                      return (
                        <div
                          key={ch.c}
                          title={mn ? `${mn} · click to hear` : "click to hear"}
                          onClick={() => speak(ch.c, cfg.voiceName)}
                          className="cursor-pointer select-none rounded-[10px] border border-border px-1.5 pb-2 pt-2.5 text-center hover:bg-panel"
                        >
                          <span className="block text-[26px] leading-[1.25]">
                            {ch.c}
                          </span>
                          <span className="block text-xs text-text-muted">
                            {ch.r.join(" / ")} 🔊
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Card>
          ))
        )}
      </div>
    </>
  );
}
