"use client";

// The visual body of a hint (SAK-50 follow-up) — extracted out of
// drill-screen.tsx so the reveal on a miss can show "whatever content a Hint
// would have shown for this same question" without duplicating the four-way
// kind switch. Used two places now: the Hint button's own drawer (gated on
// q.hinted, unchanged) and the reveal's answer panel (shown unconditionally
// once the answer is out, since there is nothing left to protect by hiding
// it). Both pass the same `Hint` value hintFor() already builds; this
// component only decides how to DRAW it.

import { MnemonicImage } from "@/components/lesson/mnemonic-image";
import type { Hint } from "@/lib/engine/hint";
import type { DerivationEquation } from "@/lib/grammar/derivation";

/**
 * One derivation equation — "たかい − い + くて → たかくて", or the
 * whole-word "いい → よくて" for an irregular build. The starting word sits
 * in a dashed box (mirrors IntroBuildFormula on the Library's form pages);
 * the trim/add operators are muted; the RESULT is accented, never the added
 * suffix — a confirmed SAK-194 design call, since what a learner should
 * notice is what the word BECAME.
 */
function DerivationRow({ eq }: { eq: DerivationEquation }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <p className="text-[10px] uppercase tracking-[0.06em] text-text-muted">{eq.label}</p>
      <p
        lang="ja"
        className="flex flex-wrap items-center justify-center gap-1.5 font-kana text-[15px]"
      >
        <span className="rounded-md border border-dashed border-text-muted/60 px-2 py-0.5 text-text">
          {eq.from}
        </span>
        {!eq.whole && eq.trim ? <span className="text-text-muted">− {eq.trim}</span> : null}
        {!eq.whole && eq.add ? <span className="text-text-muted">+ {eq.add}</span> : null}
        <span className="text-text-muted">→</span>
        <span className="text-accent">{eq.to}</span>
      </p>
    </span>
  );
}

export function HintBody({ hint, font }: { hint: Hint; font?: string }) {
  if (hint.kind === "image") {
    return (
      <MnemonicImage
        src={hint.src}
        glyph={hint.glyph}
        imgClassName="h-[104px] w-[104px] rounded-lg object-contain"
        glyphClassName="text-4xl text-text-muted"
      />
    );
  }
  if (hint.kind === "formula") {
    return (
      <span className="flex flex-wrap items-end justify-center gap-x-1.5 gap-y-1 text-text-muted">
        {hint.formula.pieces.map((p, i) => (
          <span key={i} className="flex items-end gap-x-1.5">
            {i > 0 ? <span className="pb-0.5 text-[14px]">+</span> : null}
            <span className="flex flex-col items-center leading-none">
              <span className="min-h-[13px] text-[11px] text-accent">
                {p.reading ?? " "}
              </span>
              <span className="text-xl text-text">{p.text}</span>
            </span>
          </span>
        ))}
        <span className="pb-0.5 text-[14px]">=</span>
        <span className="pb-0.5 text-xl text-text">{hint.formula.result}</span>
      </span>
    );
  }
  if (hint.kind === "derivation") {
    const { derivation } = hint;
    return (
      <span className="flex max-w-[360px] flex-col items-center gap-2">
        <p className="flex flex-wrap items-center justify-center gap-1 text-[12px] text-text-muted">
          <span lang="ja" className="font-kana text-[15px] text-text">
            {derivation.word}
          </span>
          <span>becomes</span>
          <span lang="ja" className="font-kana text-[15px] text-accent">
            {derivation.answer}
          </span>
        </p>
        {derivation.title ? (
          <p className="text-[12px] font-semibold text-text">{derivation.title}</p>
        ) : null}
        <span className="flex flex-col items-center gap-2">
          {derivation.step1 ? <DerivationRow eq={derivation.step1} /> : null}
          {derivation.step2 ? <DerivationRow eq={derivation.step2} /> : null}
        </span>
      </span>
    );
  }
  if (hint.kind === "written") {
    return (
      <span className="flex flex-col items-center gap-0.5">
        <span className="text-3xl leading-none text-text" style={{ fontFamily: font }} lang="ja">
          {hint.text}
        </span>
        {hint.parts ? (
          <span className="max-w-[320px] text-center text-[12px] text-text-muted">
            {hint.parts}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <p className="max-w-[320px] text-center text-[12px] text-text-muted">{hint.text}</p>
  );
}
