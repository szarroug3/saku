// Gallery for the constellation renderer, on real words. Route: /dev/sky/constellations
//
// Everything the five consumers need, side by side: the same word at three
// sizes (one shape, scale the only difference), a kanji-centred tile and a
// lone kana, standings as colour beside their legend, the lesson's looks
// (tonight, lit, emphasis), and the dots-off mode with the caller's own
// stars drawn on the positions the layout returns.

import { ConstellationFigure, paintFor, type StarLook } from "@/sky/components/constellation";
import { StandingLegend } from "@/sky/components/standing-legend";
import { layoutConstellation, placeConstellation, roleOf, sizeFor, STAR_RADIUS } from "@/sky/lib/constellation";
import { buildGraph } from "@/sky/lib/graph";

import { itemsFor, WORDS } from "../real-items";

export default function SkyConstellationsPage() {
  const items = itemsFor(WORDS);
  const g = buildGraph(items);
  const layoutOf = (id: string) => layoutConstellation(g.constellationOf(id));
  const lookOf = (id: string): StarLook => {
    const it = g.itemOf(id);
    return { role: roleOf(it?.kind ?? "word"), standing: it?.standing ?? "not-seen" };
  };
  const word = "時間";
  const lesson = layoutOf(word);
  const lessonOrder = g.orderOf(word);
  const litUpTo = 3; // the first three steps opened
  const selected = lessonOrder[litUpTo - 1];
  const lessonLook = (id: string): StarLook => {
    const i = lessonOrder.indexOf(id);
    return { ...lookOf(id), tonight: true, lit: i >= 0 && i < litUpTo, emphasis: id === selected };
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold text-text">Constellations</h2>
        <p className="mt-1 max-w-[72ch] text-sm text-text-muted">
          One seeded layout per item, from the graph&apos;s shape: the root in the centre,
          its parts on a ring, their parts fanned out beyond, a shared piece placed once
          between the parents that share it. Positions are normalised, so the only thing
          that changes between the home sky, the Planetarium, the lesson, an Atlas tile
          and Practice is the scale. Never <code className="text-text">Math.random</code>:
          every number hashes from the item&apos;s id.
        </p>
      </section>

      <section className="sky-wash rounded-2xl border border-sky-line p-6 font-sky-ui text-sky-ink">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">One shape, three sizes: {word}</div>
        <svg viewBox="0 0 720 240" className="mt-2 w-full max-w-[720px]" role="img" aria-label={`${word} at three sizes`}>
          {[[60, 120, 40, 0.8], [220, 120, 80, 1.1], [500, 120, 110, 1.5]].map(([cx, cy, r, unit]) => (
            <ConstellationFigure key={cx} layout={lesson} cx={cx} cy={cy} r={r} unit={unit} lookOf={lookOf} />
          ))}
        </svg>
        <p className="mt-1 text-[12px] text-sky-muted">{lesson.stars.length} stars: one per prerequisite, plus the word. Colour is the pretend learner&apos;s standing.</p>
      </section>

      <section className="sky-wash rounded-2xl border border-sky-line p-6 font-sky-ui text-sky-ink">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">Every word, sized by its stars, coloured by standing</div>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          {WORDS.map((w) => {
            const l = layoutOf(w);
            const S = sizeFor(l.stars.length, 48);
            return (
              <figure key={w} className="flex flex-col items-center gap-1">
                <svg viewBox={`0 0 ${S + 12} ${S + 12}`} width={S + 12} height={S + 12} role="img" aria-label={w}>
                  <ConstellationFigure layout={l} cx={(S + 12) / 2} cy={(S + 12) / 2} r={S / 2 - 4} unit={S / 70} lookOf={lookOf} />
                </svg>
                <figcaption className="font-sky-display text-[15px]">{w}</figcaption>
              </figure>
            );
          })}
        </div>
        <StandingLegend className="mt-4" />
      </section>

      <section className="sky-wash rounded-2xl border border-sky-line p-6 font-sky-ui text-sky-ink">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">Kanji-centred tiles and a lone star</div>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          {["時", "休", "本", "日"].map((k) => {
            const l = layoutOf(k);
            const S = 64;
            return (
              <figure key={k} className="flex flex-col items-center gap-1">
                <svg viewBox={`0 0 ${S + 12} ${S + 12}`} width={S + 12} height={S + 12} role="img" aria-label={k}>
                  <ConstellationFigure layout={l} cx={(S + 12) / 2} cy={(S + 12) / 2} r={S / 2 - 4} unit={1} lookOf={lookOf} />
                </svg>
                <figcaption className="text-[12px] text-sky-muted"><span className="font-sky-display text-[15px] text-sky-ink">{k}</span> {g.itemOf(k)?.english}</figcaption>
              </figure>
            );
          })}
        </div>
        <p className="mt-2 max-w-[60ch] text-[12px] text-sky-muted">The same function: a kanji&apos;s shape is the kanji in the middle and its parts around it, and a piece with nothing under it is one star.</p>
      </section>

      <section className="sky-wash rounded-2xl border border-sky-line p-6 font-sky-ui text-sky-ink">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">The lesson&apos;s looks: tonight, lit, emphasis, and dots off</div>
        <div className="mt-2 flex flex-wrap gap-6">
          <figure className="flex flex-col items-center gap-1">
            <svg viewBox="0 0 220 220" width={220} height={220} role="img" aria-label={`${word} tonight, three stars lit`}>
              <ConstellationFigure layout={lesson} cx={110} cy={110} r={96} unit={1.4} lookOf={lessonLook} />
            </svg>
            <figcaption className="text-[12px] text-sky-muted">tonight: faint and dashed; lit stars stay lit; the selected one in gold</figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-1">
            <svg viewBox="0 0 220 220" width={220} height={220} role="img" aria-label={`${word} with the whole word emphasised`}>
              <ConstellationFigure layout={lesson} cx={110} cy={110} r={96} unit={1.4} lookOf={(id) => ({ ...lookOf(id), emphasis: true })} />
            </svg>
            <figcaption className="text-[12px] text-sky-muted">the whole word in gold</figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-1">
            <svg viewBox="0 0 220 220" width={220} height={220} role="img" aria-label={`${word} with the caller's own stars`}>
              <ConstellationFigure layout={lesson} cx={110} cy={110} r={96} unit={1.4} lookOf={lessonLook} dots={false}>
                {placeConstellation(lesson, 110, 110, 96).map((s) => {
                  const look = lessonLook(s.id);
                  const paint = paintFor(look);
                  const rr = STAR_RADIUS[look.role] * 3;
                  return (
                    <g key={s.id}>
                      <circle cx={s.px} cy={s.py} r={rr + 4} fill="none" stroke={paint.fill} strokeOpacity={look.lit ? 0.7 : 0.4} strokeDasharray={look.lit ? undefined : "2 3"} />
                      <circle cx={s.px} cy={s.py} r={rr * 0.5} fill={paint.fill} opacity={look.lit ? 1 : 0.6} />
                      <text x={s.px} y={s.py - rr - 7} textAnchor="middle" fontSize={10} fill="var(--sky-muted)">{g.itemOf(s.id)?.glyph}</text>
                    </g>
                  );
                })}
              </ConstellationFigure>
            </svg>
            <figcaption className="text-[12px] text-sky-muted">dots off: the lesson draws its own clickable stars on the returned positions</figcaption>
          </figure>
        </div>
      </section>

      <section className="max-w-[72ch] text-sm text-text-muted">
        <div className="border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-text">Where the numbers come from</h3>
        </div>
        <p className="mt-2">
          The root&apos;s parts sit on a ring at half the reach, spread evenly with a little
          seeded jitter. A part&apos;s own parts fan outward beyond it, each level reaching a
          little less. A piece used by two parents gets one position, the mean of where
          each parent would put it, and a line from each. The whole thing is then scaled so
          the farthest star touches the unit box. Star size is by role (word, kanji, piece),
          colour by standing through the standing tokens, glow on known stars, and lines
          fade and dash to stars that are not lit or known.
        </p>
      </section>
    </div>
  );
}
