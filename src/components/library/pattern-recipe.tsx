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
// 〜ので takes a verb (行く + ので, which transforms nothing), an い-adjective
// (高い + ので, likewise) and a な-adjective (静か → 静かな + ので, which does).
// Only the third carries a fact, because only the third is a question — but ALL
// THREE are real Japanese, and a card showing only the scored one would be
// telling the reader 〜ので is an adjective pattern. This card says what is
// true, and the score column beside it says what is scored. See the
// recipeFormula doc in lib/grammar/formula.ts.
//
// WHY THE SCORES LIVE HERE AND NOT IN THE HEADER
// ==============================================
// They used to be chips in the entry header, one per production host, beside
// the meaning chip. 〜すぎる has three production hosts and so had four chips,
// and four chips is a header that has stopped being a header: the row squeezed
// the title until the gloss broke over five lines. The kanji page had already
// solved this — a kanji's meaning is a chip and its eight readings are a table
// with a "How you're doing" column — and a pattern's facts split the same way.
// The meaning stays a chip. The build, which is per host, goes where the hosts
// already are: this card, one row each, score in the last column.
//
// WHEN THE SCORE COLUMN IS ABSENT
// ===============================
// 28 of the 81 patterns carry no production fact at all (〜ことができる is 食べる
// + ことができる — nothing is conjugated, so "build it" is typing). Every cell in
// their score column would be blank, so the column and its header are dropped
// rather than ruled off around nothing.
//
// WHEN ONE CELL IS EMPTY
// ======================
// The three mixed patterns (〜ので, 〜ても, 〜てもいい) have rows on both sides of
// that line, and they are unscored for TWO DIFFERENT REASONS that used to render
// identically — a blank cell either way.
//
//   NOTHING HAPPENS TO THE WORD. 〜ので's verb row is 行く + ので and its
//   い-adjective row is 高い + ので. The cell stays EMPTY — not "not seen", which
//   would promise a question that is waiting for you, and not a sentence
//   explaining the absence, which would be the app narrating itself. The row's
//   own formula already says why: "just as it is" is a step that asks nothing.
//
//   THE RULE IS SCORED ON ANOTHER PAGE. 〜ても's い-adjective row is 高い → 高くて,
//   a real transformation, and it is blank because 〜て already scores い → くて —
//   see `sharedProductionWith` in data/grammar/recipes.ts. THAT blank was a
//   defect: the row visibly transforms, shows nothing, and gives no hint the
//   score exists one page over. It now prints "same rule as 〜て", muted, with the
//   pattern linked to its own entry.
//
// The line is GENERATED from `sharedProductionWith` and the owning recipe's own
// `pattern` string, never authored per row, so it cannot drift from the data it
// describes. It is four words because the reader is a beginner: "same rule as"
// is the whole of what may be said without explaining the app to itself.

import Link from "next/link";

import { StandingChip } from "@/components/library/standing-chip";
import { Card, Lbl } from "@/components/ui";
import {
  patternEntry,
  productionHosts,
  patternProductionFactId,
  sharedRuleOwner,
} from "@/data/grammar";
import { isProducible, type Recipe } from "@/data/grammar/recipes";
import type { Claims } from "@/lib/claims";
import type { Formula, RecipeFormula } from "@/lib/grammar/formula";
import { entryHref } from "@/lib/library/href";
import { standingOf } from "@/lib/library/standing";
import type { AccuracyMetric, HistoryFile } from "@/types";

/** "same rule as 〜て", muted, with the pattern linked to its own entry.
 *
 * The decision of WHETHER to print is `sharedRuleOwner`'s, in data/grammar,
 * because it is a question about the data and it is the one the tests pin. This
 * is only the typesetting, and it takes the owning RECIPE rather than a string
 * so the words on screen are that recipe's own `pattern` — a copy here is a copy
 * that drifts.
 *
 * Styled as the kanji page styles "opens with <word>": muted phrase, accent
 * link, no underline. Same shape of thing, same look, deliberately. */
function SharedRule({ owner }: { owner: Recipe }) {
  return (
    <span className="text-[13px] text-text-muted">
      same rule as{" "}
      {/* NOWRAP ON THE PATTERN. The score column is narrow and this line wrapped
          BETWEEN 〜 and て, splitting a two-character pattern down the middle and
          leaving a line ending in a bare 〜 — the same misread the "+ すぎる" note
          above describes, arrived at the same way. The phrase may wrap before the
          pattern; the pattern may not wrap inside itself. */}
      <Link
        href={entryHref(patternEntry(owner.id))}
        className="whitespace-nowrap font-kana text-accent no-underline"
      >
        {owner.pattern}
      </Link>
      {owner.sense && (
        <span className="whitespace-nowrap font-kana text-[13px] text-text-muted">
          {" "}({owner.sense})
        </span>
      )}
    </span>
  );
}

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
        <span className="flex items-center gap-2">
          <Arrow />
          <span className="rounded-md border border-border px-2 py-1 text-text">
            {f.formLabel}
          </span>
        </span>
      ) : null}

      {/* The trim reads as a subtraction because that is what it is: ない minus
          い. Spelling it as its own step is what keeps 〜なければならない a table
          row rather than a special case, in the display layer as in the data. */}
      {/* OPERATOR AND OPERAND IN ONE NOWRAP SPAN. The line is flex-wrap and the
          score column took width off it, so "+ すぎる" started breaking between
          the plus and the suffix: a line ending in a bare "+" is the exact
          misread the `add` doc warns about, arrived at by layout instead of by
          data. They wrap together or not at all. */}
      {f.trim ? (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="select-none text-text-muted">−</span>
          <Fixed>{f.trim}</Fixed>
        </span>
      ) : null}

      {/* Null, not "", when the pattern IS a form (〜ば, 〜たら, the potential).
          An empty add here is how a card comes to print "+" with nothing after
          it, which reads as a bug on a card whose promise is the rule. */}
      {f.add ? (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="select-none text-text-muted">+</span>
          <Fixed>{f.add}</Fixed>
        </span>
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

export function PatternRecipe({
  pattern,
  formula,
  facts,
  claims,
  metric,
  now,
}: {
  pattern: Recipe;
  formula: RecipeFormula;
  facts: HistoryFile["facts"];
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
}) {
  const { opening, closing } = formula;
  if (opening.length === 0) return null;

  // JOINED ON HOST, never zipped by index. `productionHosts` returns the hosts
  // that carry a fact and `recipeFormula` returns a row per host INCLUDING the
  // unscored ones, so the two lists are different lengths on the three mixed
  // patterns and 〜ので's one score would land on its verb row.
  const scored = new Set(isProducible(pattern) ? productionHosts(pattern) : []);
  const anyScored = opening.some((f) => scored.has(f.host));

  return (
    // Full height: the page pairs this with the Links card in a row that shares
    // one height, so the box fills its half rather than ending short of it.
    <Card className="h-full">
      <Lbl>How to build it</Lbl>
      <table className="w-full text-left">
        {/* THE HEADER ROW EXISTS ONLY WHEN THERE ARE TWO COLUMNS. "The rule"
            names the left column, which holds the formula and the worked
            examples that are its evidence. Not "How it's built": the card's own
            title already says that, and a column header repeating it stutters.
            When nothing here is scored the score column is dropped, and a lone
            "The rule" over the only column is noise, so the whole row goes with
            it. */}
        {anyScored ? (
          <thead>
            <tr className="border-b border-border text-xs font-medium text-text-muted">
              <th className="py-1.5 pr-2 font-medium">The rule</th>
              <th className="py-1.5 font-medium">How you&rsquo;re doing</th>
            </tr>
          </thead>
        ) : null}
        <tbody>
          {opening.map((f) => {
            const id = patternProductionFactId(pattern.id, f.host);
            const owner = sharedRuleOwner(pattern, f.host);
            return (
              <tr
                key={`open-${f.host}`}
                className="border-b border-border last:border-b-0"
              >
                <td className="py-2.5 pr-2 align-top">
                  <FormulaLine f={f} />
                  <WorkedLine f={f} />
                </td>
                {anyScored ? (
                  // EMPTY, not "not seen": see the header. A row is here
                  // because the Japanese is real, not because a question is.
                  // Unless the rule is scored on ANOTHER pattern's page, which
                  // is a different silence and says so — see the doc up top.
                  <td className="py-2.5 align-top">
                    {scored.has(f.host) ? (
                      <StandingChip
                        standing={
                          standingOf(facts[id], claims[id], metric, now).standing
                        }
                      />
                    ) : owner ? (
                      <SharedRule owner={owner} />
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* THE CLOSING HALF OF A WRAP, labelled, because without the label the
          two formulas read as alternatives rather than as two ends of one
          pattern. 〜しか〜ない is not "a noun with しか OR a verb with ない"; it
          is both at once, around a phrase, and four recipes in the table are
          like that.

          OUTSIDE the table, still, and it stays that way: it is not another
          host's row, it is the far end of the same row's pattern, and a fourth
          line in the tbody would read as a fourth alternative. All four wraps
          are non-producible, so the score column and this section never appear
          together. */}
      {closing.length > 0 ? (
        <div className="mt-3.5 border-t border-border pt-3.5">
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
    </Card>
  );
}
