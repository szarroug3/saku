// Gallery for the prerequisite graph, built from the app's own data.
// Route: /dev/sky/graph
//
// A server component on purpose: it reads the kanji and vocab tables (this
// dev route is exempt from the Sky boundary, and it is the only place they
// meet Sky code before cutover), builds the graph once, and renders plain
// tables. Nothing here ships to the client but markup.

import { kanjiRow, variantTaughtKanji } from "@/data/kanji";
import { vocabRow } from "@/data/vocab";
import { StandingChip } from "@/sky/components/standing-legend";
import { buildGraph } from "@/sky/lib/graph";
import { isKnown, type Standing } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

/** A few real words with overlapping kanji, so sharing shows. */
const WORDS = ["日本", "大学", "火山", "水田", "時間", "電車", "休む", "学生"];

/** A pretend learner: what they already have, by glyph. */
const STANDINGS: Record<string, Standing> = {
  日: "solid", 本: "solid", 大: "solid", 学: "getting-there", 火: "solid", 山: "claimed",
  木: "solid", 人: "solid", 亻: "claimed", 日本: "solid", 大学: "getting-there",
};
const standingOf = (glyph: string): Standing => STANDINGS[glyph] ?? "not-seen";

/** The app's tables, read into the Sky's item shape: a word is its kanji; a
 * kanji is its direct components, which are kanji themselves or primitives. */
function itemsFor(words: readonly string[]): SkyItem[] {
  const items = new Map<string, SkyItem>();
  const addGlyph = (c: string): void => {
    if (items.has(c)) return;
    const row = kanjiRow(c);
    if (row) {
      items.set(c, { id: c, kind: "kanji", glyph: c, english: row.meanings[0] ?? c, standing: standingOf(c), components: [...row.comps] });
      for (const comp of row.comps) addGlyph(comp);
      return;
    }
    const of = variantTaughtKanji(c);
    const base = of ? kanjiRow(of) : undefined;
    items.set(c, { id: c, kind: "radical", glyph: c, english: base ? `a form of ${base.meanings[0]}` : "a piece with no name of its own", standing: standingOf(c) });
  };
  for (const keb of words) {
    const row = vocabRow(keb);
    const kanji = [...keb].filter((c) => kanjiRow(c));
    items.set(keb, { id: keb, kind: "word", glyph: keb, english: row?.senses[0]?.glosses[0] ?? keb, reading: row?.reb, standing: standingOf(keb), components: kanji });
    for (const c of kanji) addGlyph(c);
  }
  return [...items.values()];
}

export default function SkyGraphPage() {
  const items = itemsFor(WORDS);
  const g = buildGraph(items);
  const learned = (id: string) => isKnown(g.itemOf(id)?.standing ?? "not-seen");
  const cart = ["時間", "電車", "休む"];

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold text-text">The prerequisite graph</h2>
        <p className="mt-1 max-w-[72ch] text-sm text-text-muted">
          One shared model of what needs what: a word is made of kanji, a kanji of its
          parts, a verb pair or keigo form of its own kanji plus the headword it
          attaches to. Built here from the app&apos;s real kanji and vocab tables for{" "}
          {WORDS.length} words: {g.size} nodes, {g.dangling.length} dangling references,{" "}
          {g.cycles.length} cycles. A piece used twice is one node with one state.
          Learning a thing says nothing about its parts: a claimed word is only the word.
        </p>
      </section>

      <section>
        <div className="border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-text">Each word&apos;s lesson, in order</h3>
          <p className="mt-1 text-xs text-text-muted">Pieces first, then the kanji, then the word; each piece once. Standings are a pretend learner&apos;s.</p>
        </div>
        <div className="mt-3 space-y-3">
          {WORDS.map((w) => {
            const item = g.itemOf(w)!;
            const unmet = g.unmetPrerequisites(w, learned);
            return (
              <div key={w} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-kana text-xl text-text">{w}</span>
                  <span className="text-sm text-text-muted">{item.english}</span>
                  <StandingChip standing={item.standing} />
                  <span className="ml-auto text-xs text-text-muted">
                    {g.isAvailable(w, learned) ? "available to open" : `${unmet.length} still to learn`} · {g.orderOf(w).length} stars
                  </span>
                </div>
                <ol className="mt-2 flex flex-wrap gap-1.5">
                  {g.orderOf(w).map((id) => {
                    const it = g.itemOf(id)!;
                    const depth = g.constellationOf(w).nodes.find((n) => n.id === id)?.depth ?? 0;
                    return (
                      <li key={id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] ${learned(id) ? "border-success/40 text-text-muted" : "border-border text-text"}`} title={`${it.english} · ${it.kind} · depth ${depth}${learned(id) ? " · learned" : ""}`}>
                        <span className="font-kana text-[15px]">{it.glyph}</span>
                        <span className="text-text-muted">{it.english}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-text">A cart: {cart.join(", ")}</h3>
          <p className="mt-1 text-xs text-text-muted">What each pick brings, minus what the learner knows and minus what an earlier pick already brings. The total is the distinct new pieces.</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="pr-4 font-medium">pick</th>
                <th className="pr-4 font-medium">new pieces</th>
                <th className="pr-4 font-medium">free (learned)</th>
                <th className="font-medium">shared with an earlier pick</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((id, i) => {
                const cost = g.costOf(id, learned, cart.slice(0, i));
                const glyphs = (ids: readonly string[]) => (ids.length ? ids.map((x) => g.itemOf(x)?.glyph ?? x).join(" ") : "none");
                return (
                  <tr key={id} className="border-t border-border">
                    <td className="py-1.5 pr-4 font-kana text-text">{id}</td>
                    <td className="py-1.5 pr-4 font-kana text-text">{cost.pieces.length} · {glyphs(cost.pieces)}</td>
                    <td className="py-1.5 pr-4 font-kana text-text-muted">{glyphs(cost.free)}</td>
                    <td className="py-1.5 font-kana text-text-muted">{glyphs(cost.shared)}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-border font-semibold">
                <td className="py-1.5 pr-4 text-text">total</td>
                <td className="py-1.5 pr-4 text-text" colSpan={3}>{g.pieceCount(cart, learned)} pieces</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-text">What learning one thing would unlock</h3>
          <p className="mt-1 text-xs text-text-muted">For the Planetarium&apos;s hints: dependents that become available once this is learned, and only those.</p>
        </div>
        <ul className="mt-3 space-y-1 text-[13px]">
          {items.filter((it) => !learned(it.id)).map((it) => ({ it, unlocks: g.wouldUnlock(it.id, learned) })).filter(({ unlocks }) => unlocks.length).map(({ it, unlocks }) => (
            <li key={it.id} className="text-text">
              <span className="font-kana">{it.glyph}</span> <span className="text-text-muted">({it.english})</span> would open{" "}
              <span className="font-kana">{unlocks.map((u) => g.itemOf(u)?.glyph).join(", ")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
