// "How to build it" — the card grammar has that no other kind does.
//
// A kana page shows you a shape and a kanji page shows you strokes, because
// those are things you look AT. A pattern is not a thing you look at, it is a
// thing you DO to a word, and the only honest picture of an operation is its
// formula. So this card is not a worked example with a caption; it is the rule,
// typeset, with worked examples underneath it as evidence.
//
// WHY THE SLOT IS DASHED AND THE RESULT IS ACCENTED
// ================================================
// The whole reading of this card turns on one distinction: which parts of
// 〜てから are YOURS to fill in and which are FIXED. A dashed outline is the
// standard way to draw a hole, and the accent is the app's "this is the answer"
// colour everywhere else. Between them the reader gets the sentence "you supply
// a verb, we supply から" without the card having to say it in words, which is
// the whole of the no-overexplaining rule as it applies to a diagram.
//
// ONE ROW PER HOST, NOT PER PRODUCTION FACT
// =========================================
// 〜ので takes a verb (行く + ので, which transforms nothing) and a な-adjective
// (静か → 静かな + ので, which does). Only the second carries a fact, because
// only the second is a question — but BOTH are real Japanese, and a card showing
// only the scored one would be telling the reader 〜ので is an adjective pattern.
// The chips in the header say what is scored. This card says what is true. See
// the recipeFormula doc in lib/grammar/formula.ts.

import { Card, Lbl } from "@/components/ui";
import type { Formula, RecipeFormula } from "@/lib/grammar/formula";

/** A fixed piece of the pattern — the suffix, the trim. Accent, because it is
 * the part the pattern contributes and the part you have to remember. */
function Fixed({ children }: { children: string }) {
  return <span className="font-kana text-[15px] text-accent">{children}</span>;
}

/** The arrow between steps. A real character rather than a border, so it wraps
 * with the text on a narrow screen instead of leaving a rule floating in a gap. */
function Arrow() {
  return <span className="select-none text-text-muted">→</span>;
}

function FormulaLine({ f }: { f: Formula }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      {/* THE HOLE. Dashed, muted, and it names the host rather than showing a
          word: the moment it shows 行く it has stopped being a formula and
          become an example, and there are examples on the next line. */}
      <span className="rounded-md border border-dashed border-border px-2 py-1 text-text-muted">
        {f.slot}
      </span>

      {/* No form named means the bare word (the noun rows). The step is dropped
          rather than printed as "no change", which would be a step. */}
      {f.formLabel ? (
        <>
          <Arrow />
          <span className="rounded-md border border-border px-2 py-1 text-text">
            {f.formLabel}
          </span>
        </>
      ) : null}

      {/* The trim reads as a subtraction because that is what it is: ない minus
          い. Spelling it as its own step is what keeps 〜なければならない a table
          row rather than a special case, in the display layer as in the data. */}
      {f.trim ? (
        <>
          <span className="select-none text-text-muted">−</span>
          <Fixed>{f.trim}</Fixed>
        </>
      ) : null}

      {/* Null, not "", when the pattern IS a form (〜ば, 〜たら, the potential).
          An empty add here is how a card comes to print "+" with nothing after
          it, which reads as a bug on a card whose promise is the rule. */}
      {f.add ? (
        <>
          <span className="select-none text-text-muted">+</span>
          <Fixed>{f.add}</Fixed>
        </>
      ) : null}
    </div>
  );
}

/** The worked line: real words, through the real conjugation engine.
 *
 * "Any verb you know" is the claim the formula makes, and these three are the
 * evidence for it — one per conjugation class, so the reader watches the same
 * ending survive three different stems. If the engine is wrong these are wrong,
 * which is the same bet the cluster page makes and the reason neither page
 * hardcodes a single character of Japanese. */
function WorkedLine({ f }: { f: Formula }) {
  if (f.worked.length === 0) return null;
  return (
    <p className="mt-2 text-[13px] text-text-muted">
      {/* A WRAP CANNOT SAY "any noun you know", because the example beside it
          holds two words and only one of them is the noun. The pattern's own
          line at the top of the page already says it wraps around a phrase, so
          the example just presents itself. */}
      {f.wraps ? "Worked out: " : `Any ${f.slot.replace("any ", "")} you know: `}
      {f.worked.map((w, i) => (
        // The separator is its OWN element, outside the nowrap span, so a line
        // that runs out of room breaks BETWEEN examples. Kept inside, the "·"
        // travelled with the example after it and a wrapped line began with a
        // dangling bullet.
        <span key={w.from}>
          {i > 0 ? <span> · </span> : null}
          <span className="whitespace-nowrap">
            <span className="font-kana text-text">{w.from}</span> →{" "}
            <span className="font-kana text-text">{w.to}</span>
          </span>
        </span>
      ))}
    </p>
  );
}

export function PatternRecipe({ formula }: { formula: RecipeFormula }) {
  const { opening, closing } = formula;
  if (opening.length === 0) return null;
  return (
    // Full height: the page pairs this with the Links card in a row that shares
    // one height, so the box fills its half rather than ending short of it.
    <Card className="h-full">
      <Lbl>How to build it</Lbl>
      <div className="flex flex-col gap-3.5">
        {opening.map((f) => (
          <div key={`open-${f.host}`}>
            <FormulaLine f={f} />
            <WorkedLine f={f} />
          </div>
        ))}
        {/* THE CLOSING HALF OF A WRAP, labelled, because without the label the
            two formulas read as alternatives rather than as two ends of one
            pattern. 〜しか〜ない is not "a noun with しか OR a verb with ない"; it
            is both at once, around a phrase, and four recipes in the table are
            like that. */}
        {closing.length > 0 ? (
          <div className="border-t border-border pt-3.5">
            <p className="mb-2 text-xs text-text-muted">
              and, at the other end of the phrase:
            </p>
            <div className="flex flex-col gap-3.5">
              {closing.map((f) => (
                <FormulaLine key={`close-${f.host}`} f={f} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
