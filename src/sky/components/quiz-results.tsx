"use client";

// How it went: the three counts (and what was left), every card with its
// grade, and a retry of the ones picked. Split from the Quiz so the room
// where questions are asked and the room where they are looked back on
// are two components, not one long one.

import { useState } from "react";

import type { PitchComponent } from "@/sky/components/lesson-card";
import { RecipeNameForm } from "@/sky/components/recipe-name-form";
import { SkyButton } from "@/sky/components/sky-button";
import { SkyInfo } from "@/sky/components/sky-info";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { japaneseFont } from "@/sky/lib/japanese";
import { GRADE, GRADES, tally, type Grade, type QuizAnswer, type QuizCard, type WayBack } from "@/sky/lib/quiz";

/** The verdict colours, by grade; the Quiz's pips use the same. */
export const VERDICT: Record<Grade, string> = {
  clean: "text-sky-solid",
  help: "text-sky-shaky",
  missed: "text-sky-slipping",
};

export interface QuizResultsProps {
  cards: readonly QuizCard[];
  answers: Readonly<Record<string, QuizAnswer>>;
  /** Whether recording failed; the normal case says nothing. */
  failed: boolean;
  /** Where this quiz came from, and what to call it (SAK-353). */
  back: WayBack;
  pitch?: PitchComponent;
  onRetry?: (cardIds: readonly string[]) => void;
  /** Keep the recipe this run came from, under a name, without leaving the
   * results to do it (SAK-395). */
  onSave?: (name: string) => void;
  /** The recipe names already taken, so saving over one announces itself.
   * Only meaningful alongside `onSave`. */
  savedNames?: readonly string[];
  /** What comes after this round, when there is a next one (a lesson's
   * quiz rests, then runs again): the primary action, ahead of the way back. */
  next?: { label: string; onClick: () => void };
  height?: string;
}

export function QuizResults({ cards, answers, failed, back, pitch: Pitch, onRetry, onSave, savedNames = [], next, height }: QuizResultsProps) {
  // rows picked for a retry of just those; shift picks a run
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  // the naming box opens here rather than on another page
  const [naming, setNaming] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [lastPick, setLastPick] = useState<number | null>(null);
  const list = cards.map((c) => answers[c.id]).filter((a): a is QuizAnswer => !!a);
  const counts = tally(list);
  const unanswered = cards.length - list.length;

  const count = (label: string, n: number, meaning: string, tone: string) => (
    <div>
      <dd className="font-sky-display text-[28px] leading-none text-sky-ink">{n}</dd>
      <dt className="mt-1"><Eyebrow tone="inherit" className={`mb-0 inline-flex items-center ${tone}`}>{label}<SkyInfo className="ml-1.5" label={`What ${label.toLowerCase()} means`}>{meaning}</SkyInfo></Eyebrow></dt>
    </div>
  );

  return (
    <SkyPageShell eyebrow="Quiz" title="How it went" height={height}>
      <div className="mx-auto flex w-full max-w-[720px] min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui">
        <SkySurface>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-center sm:grid-cols-4">
            {GRADES.map((g) => <div key={g}>{count(GRADE[g].label, counts[g], GRADE[g].meaning, VERDICT[g])}</div>)}
            {count("Unanswered", unanswered, "Left when the quiz ended. Not recorded.", "text-sky-muted")}
          </dl>
        </SkySurface>
        {/* the list fills the page and scrolls inside; a row can be picked for
            a retry of just those cards, shift for a run (Sam, 2026-09-05) */}
        <SkySurface className="flex min-h-0 flex-1 flex-col">
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {cards.map((c, i) => {
              const a = answers[c.id];
              const on = picked.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={(e) => {
                      const next = new Set(picked);
                      if (e.shiftKey && lastPick !== null) {
                        for (let k = Math.min(lastPick, i); k <= Math.max(lastPick, i); k++) next.add(cards[k].id);
                      } else if (on) next.delete(c.id);
                      else next.add(c.id);
                      setPicked(next);
                      setLastPick(i);
                    }}
                    className={`grid w-full grid-cols-[10rem_1fr_auto] items-baseline gap-x-3 rounded-lg border px-2.5 py-2 text-left ${on ? "border-sky-accent bg-sky-card-strong" : "border-transparent hover:bg-sky-card"}`}
                  >
                    {/* the glyph column is one width, so the answers line up */}
                    <span className={`truncate font-sky-display text-[20px] leading-none text-sky-ink ${japaneseFont(c.item.glyph)}`}>{c.item.glyph}</span>
                    <span className={`text-[13px] ${japaneseFont(c.answer)}`}>{c.answerPitch !== undefined && Pitch ? <Pitch reading={c.answer} downstep={c.answerPitch} /> : c.answer}</span>
                    <span className={`text-[12px] font-semibold ${a ? VERDICT[a.grade] : "text-sky-muted"}`}>{a ? GRADE[a.grade].label : "Unanswered"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {/* recording is the normal case and says nothing; only a failure speaks */}
          {failed && <p className="mt-3 shrink-0 text-[12.5px] text-sky-slipping">Could not record this. Your schedule is unchanged.</p>}
        </SkySurface>
        <div className="flex flex-wrap gap-2">
          {next && <SkyButton onClick={next.onClick}>{next.label}</SkyButton>}
          <SkyButton href={back.href} variant={next ? "outline" : "solid"}>{back.label}</SkyButton>
          {onRetry && picked.size > 0 && <SkyButton variant="outline" onClick={() => onRetry(cards.filter((c) => picked.has(c.id)).map((c) => c.id))}>Retry {picked.size === 1 ? "this one" : `these ${picked.size}`}</SkyButton>}
          {onRetry && picked.size === 0 && counts.missed > 0 && <SkyButton variant="outline" onClick={() => onRetry(cards.filter((c) => answers[c.id]?.grade === "missed").map((c) => c.id))}>Retry the {counts.missed === 1 ? "miss" : `${counts.missed} misses`}</SkyButton>}
          {onSave && !naming && !saved && <SkyButton variant="outline" onClick={() => setNaming(true)}>Keep this recipe</SkyButton>}
          {onSave && saved && <span className="self-center text-[13px] text-sky-muted">Kept as <span className={`text-sky-ink ${japaneseFont(saved)}`}>{saved}</span>.</span>}
        </div>
        {onSave && naming && (
          <RecipeNameForm
            taken={savedNames}
            onSave={(name) => { onSave(name); setSaved(name); setNaming(false); }}
            onCancel={() => setNaming(false)}
          />
        )}
      </div>
    </SkyPageShell>
  );
}
