"use client";

// The dakuten phase's lesson card: one MARK, one rule, five results.
//
// WHY THIS IS NOT MnemonicView WITH A FLAG
// ========================================
// MnemonicView is built around one glyph, one drawing, one story — its whole
// composition is "here is a picture, and here is the character hiding in it".
// A conversion has none of those. There is no single glyph (there are ten,
// arranged in pairs), there is no picture and there never will be, and the
// subject is a TRANSFORMATION rather than a shape. Stretching the mnemonic view
// with `if (isConversion)` would have produced a card that reads as a
// character card with its picture missing, which is exactly the wrong
// impression: the point of the dakuten phase is that there is nothing new to
// look at. So this is a sibling, and the two share only what they genuinely
// have in common — the speaker and the call-out.
//
// WHAT IT HAS TO GET ACROSS, IN THIS ORDER
// ========================================
//   1. THE MARK IS THE LESSON. ゛ set large and once, in the slot the mnemonic
//      spends on art. The learner is not learning five characters; they are
//      learning that two strokes change a sound.
//   2. THE RULE, BARE. k → g, in the same visual register as the mark, so the
//      two read as one statement: "this mark does this".
//   3. THE PAIRS ARE THE IMAGE. か→が five times over, base muted and result at
//      full strength, so the eye reads "same shape, plus the mark, new sound"
//      without being told which pair to start with. Each result carries a
//      speaker, because voicing is a sound and "ga" on a page is not a sound.
//   4. THE HOOK, one line, under the strip — the words that make the rule
//      stick. Its changing consonants arrive bracketed and render as accent,
//      the same emphasis the character stories give their sound.
//   5. THE EXCEPTION, when the row has one, in the shared call-out so it cannot
//      be mistaken for more of the hook. Three of the five rows have none and
//      the card has to look finished without it.
//
// The ゜ card leans on being the odd one: its base is the は row AGAIN, which is
// the single most confusable thing in this phase, so it says so in an aside
// rather than quietly reusing the same five base glyphs and hoping.

import { Callout } from "@/components/lesson/callout";
import { HearButton } from "@/components/lesson/hear-button";
import { CHAR_INDEX } from "@/data/characters";
import { hookRuns, type DakutenRow } from "@/data/dakuten-rows";
import { useQuizConfig } from "@/lib/quiz-config";

/** The canonical romaji for a kana — the data file's first accepted answer, so
 * the strip says "shi" where the drill says "shi". */
function romaji(c: string): string {
  return CHAR_INDEX[c]?.r[0] ?? "";
}

/** One base→converted pair: the shape you know, greyed, and the shape it turns
 * into, at full strength with its sound. */
function Pair({
  base,
  converted,
  voiceName,
}: {
  base: string;
  converted: string;
  voiceName: string;
}) {
  return (
    <div className="flex min-w-[86px] flex-col items-center gap-1.5">
      <div className="flex items-baseline gap-1.5">
        {/* The one you already know, deliberately quiet — it is the "before",
            not the lesson. */}
        <span className="font-kana text-[26px] font-extralight leading-none text-text-muted/50">
          {base}
        </span>
        <span aria-hidden className="text-[13px] text-text-muted/50">
          →
        </span>
        <span className="font-kana text-[38px] font-light leading-none text-text">
          {converted}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] tracking-wide text-text-muted/60">
          {romaji(base)}
        </span>
        <span aria-hidden className="text-[10px] text-text-muted/40">
          →
        </span>
        <span className="text-[12px] font-medium tracking-wide text-text">
          {romaji(converted)}
        </span>
      </div>
      <HearButton glyph={converted} voiceName={voiceName} className="mt-0.5" />
    </div>
  );
}

export function ConversionCard({ row }: { row: DakutenRow }) {
  const { cfg } = useQuizConfig();
  const runs = hookRuns(row.hook);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
        {row.markName} · one mark, five sounds
      </p>

      {/* THE HERO: the mark, and the rule it performs. Side by side and at the
          same weight, because neither means anything without the other. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex flex-col items-center">
          {/* A PLATE, not a floating glyph. ゛ and ゜ sit at the very top of
              their em box — set loose at display size they drift above the
              line and read as debris. Boxed and optically centred, the mark
              becomes the object of study the card says it is. */}
          <span
            aria-hidden
            className="flex size-[88px] items-center justify-center overflow-hidden rounded-xl border border-border bg-panel"
          >
            <span className="translate-y-[0.32em] font-kana text-[64px] font-light leading-none text-text">
              {row.mark}
            </span>
          </span>
          <span className="mt-2 text-[11px] uppercase tracking-[0.08em] text-text-muted">
            {row.markName}
          </span>
        </div>
        <p className="flex items-center gap-3 text-[44px] font-extralight leading-none tracking-[-1px] text-text">
          <span>{row.from}</span>
          <span aria-hidden className="text-[26px] text-text-muted">
            →
          </span>
          <span className="text-accent">{row.to}</span>
        </p>
      </div>

      {/* THE STRIP — what the rule does, five times, so the pattern is seen
          rather than asserted. This is the card's picture. */}
      <div className="mt-8 border-t border-border pt-7">
        <div className="flex flex-wrap gap-x-6 gap-y-6">
          {row.pairs.map(([base, converted]) => (
            <Pair
              key={converted}
              base={base}
              converted={converted}
              voiceName={cfg.voiceName}
            />
          ))}
        </div>
      </div>

      {/* THE HOOK. Absent until authored — a row with no line yet shows the
          rule and the strip and stops, rather than showing a placeholder. */}
      {runs.length ? (
        <p className="mt-8 max-w-[52ch] text-[19px] font-light leading-relaxed text-text">
          {runs.map((r, i) =>
            r.hit ? (
              <span key={i} className="font-medium text-accent">
                {r.text}
              </span>
            ) : (
              <span key={i}>{r.text}</span>
            ),
          )}
        </p>
      ) : null}

      {/* The row's own oddities, kept apart from the hook so neither is read as
          the other. The aside is about the ROW (ぱ reuses は's shapes); the
          call-out is about a character in it. */}
      {row.aside || row.callout ? (
        <div className="mt-7 space-y-3">
          {row.aside ? <Callout label="Note.">{row.aside}</Callout> : null}
          {row.callout ? <Callout label="Heads up.">{row.callout}</Callout> : null}
        </div>
      ) : null}
    </div>
  );
}
