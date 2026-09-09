"use client";

// How it went: the three counts (and what was left), every card with its
// grade, and a retry of the ones picked. Split from the Quiz so the room
// where questions are asked and the room where they are looked back on
// are two components, not one long one.
//
// Two components here, not one (SAK-420). `QuizResults` is the container: it
// is what the Quiz turns into when the deck runs out, and it OWNS the
// recording, which is the one thing on this screen that is not a picture of
// what already happened. The answers go to whoever records them the moment it
// appears, and it says where that has got to. `HowItWent` under it is the
// screen itself and knows nothing about promises. The Quiz used to hold the
// save state and thread a dozen props through to here.

import { useEffect, useRef, useState } from "react";

import type { PitchComponent } from "@/sky/components/lesson-card";
import { RecipeNameForm } from "@/sky/components/recipe-name-form";
import { SkyButton } from "@/sky/components/sky-button";
import { SkyInfo } from "@/sky/components/sky-info";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { SkyPageBody } from "@/sky/components/sky-page-body";
import { japaneseFont } from "@/sky/lib/japanese";
import { GRADE, GRADES, tally, type Grade, type QuizAnswer, type QuizCard, type WayBack } from "@/sky/lib/quiz";

/** The verdict colours, by grade; the Quiz's pips use the same. */
export const VERDICT: Record<Grade, string> = {
  clean: "text-sky-solid",
  help: "text-sky-shaky",
  missed: "text-sky-slipping",
};

/**
 * Where the run's record has got to.
 *
 * "no" is a quiz nobody is recording (the sample deck), which says nothing at
 * all. The other three are this screen's own: it paints in the click that ends
 * the quiz, and for a visitor the record does not exist until a server action
 * has turned the answers into one (SAK-406 left this as the open half, SAK-410
 * closed it). Leaving inside that window lost the quiz, so the screen says
 * where it is and the way back waits for it.
 */
type SaveState = "no" | "saving" | "saved" | "failed";

/** What the screen says while the record is on its way, and after. */
const SAVE_LINE: Record<Exclude<SaveState, "no">, string> = {
  saving: "Saving this run.",
  saved: "Saved.",
  failed: "Could not record this. Your schedule is unchanged.",
};

/** What the end of a deck offers, and where its answers go.
 *
 * The Quiz hands this straight through as its own `results` prop: none of it
 * is anything the room where questions are asked has an opinion about. */
export interface QuizEnding {
  /** Where this quiz came from, and what to call it (SAK-353). The empty
   * deck's one button is this too: there is nothing else to do there. */
  back: WayBack;
  /** Where the answers go: the schedule, or practice's own note of a miss.
   * A deck nobody records (the sample) has none, and this screen stays quiet
   * about saving rather than claiming anything. */
  onFinish?: (answers: readonly QuizAnswer[]) => Promise<void>;
  /** Starts a new quiz of just the cards picked here. */
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
}

interface QuizResultsProps {
  cards: readonly QuizCard[];
  answers: Readonly<Record<string, QuizAnswer>>;
  /** Everything about the end of this deck. See QuizEnding. */
  ending: QuizEnding;
  pitch?: PitchComponent;
  height?: string;
}

/**
 * The results screen, and the recording that goes with it.
 *
 * The answers go the moment this appears, which is the click that ended the
 * quiz. `save` opens at "saving" rather than at nothing, because a first frame
 * saying nothing and a second saying "Saving this run." would be a flicker
 * rather than news: by the time anything is painted the answers are already on
 * their way.
 *
 * Once, and once only. This screen appears once per run, but an effect is not
 * a promise of that: React runs one twice over in development on purpose, and
 * this one writes to a schedule. The ref says whether it has gone, and the
 * recorder is read through a second ref so a caller passing a fresh closure
 * every render does not look like a reason to send it again.
 */
export function QuizResults({ cards, answers, ending, pitch, height }: QuizResultsProps) {
  const list = cards.map((c) => answers[c.id]).filter((a): a is QuizAnswer => !!a);
  const [save, setSave] = useState<SaveState>(ending.onFinish ? "saving" : "no");
  // read on the first render and never again, which is the point: what goes is
  // the run as it stood when this screen appeared
  const record = useRef<{ send: QuizEnding["onFinish"]; answers: readonly QuizAnswer[] }>({ send: ending.onFinish, answers: list });
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const { send, answers: going } = record.current;
    send?.(going).then(() => setSave("saved"), () => setSave("failed"));
  }, []);

  return <HowItWent cards={cards} answers={answers} list={list} save={save} ending={ending} pitch={pitch} height={height} />;
}

function HowItWent({ cards, answers, list, save, ending: { back, onRetry, onSave, savedNames = [], next }, pitch: Pitch, height }: QuizResultsProps & { list: readonly QuizAnswer[]; save: SaveState }) {
  // rows picked for a retry of just those; shift picks a run
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  // the naming box opens here rather than on another page
  const [naming, setNaming] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [lastPick, setLastPick] = useState<number | null>(null);
  const counts = tally(list);
  const unanswered = cards.length - list.length;

  const count = (label: string, n: number, meaning: string, tone: string) => (
    <div>
      <dd className="font-sky-display text-[28px] leading-none text-sky-ink">{n}</dd>
      <dt className="mt-1"><Eyebrow tone="inherit" tight className={`inline-flex items-center ${tone}`}>{label}<SkyInfo className="ml-1.5" label={`What ${label.toLowerCase()} means`}>{meaning}</SkyInfo></Eyebrow></dt>
    </div>
  );

  return (
    <SkyPageShell eyebrow="Quiz" title="How it went" height={height}>
      <SkyPageBody width="reading">
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
                  {/* items-center, not items-baseline (SAK-415): a 20px glyph
                      beside 13px and 12px text centres on the row rather than
                      dragging the smaller two down to its own baseline */}
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
                    className={`grid w-full grid-cols-[10rem_1fr_auto] items-center gap-x-3 rounded-lg border px-2.5 py-2 text-left ${on ? "border-sky-accent bg-sky-card-strong" : "border-transparent hover:bg-sky-card"}`}
                  >
                    {/* the glyph column is one width, so the answers line up */}
                    <span className={`truncate font-sky-display text-[20px] leading-none text-sky-ink ${japaneseFont(c.item.glyph)}`}>{c.item.glyph}</span>
                    <span className={`text-[13px] ${japaneseFont(c.answer)}`}>{c.answerPitch !== undefined && Pitch ? <Pitch reading={c.answer} downstep={c.answerPitch} /> : c.answer}</span>
                    {/* the grade, and what it cost (SAK-425): a card that took
                        three goes and a card that took one both read "Help",
                        and the run already knows which was which */}
                    <span className="text-right">
                      <span className={`block text-[12px] font-semibold ${a ? VERDICT[a.grade] : "text-sky-muted"}`}>{a ? GRADE[a.grade].label : "Unanswered"}</span>
                      {a && a.tries > 1 && <span className="block text-[11px] text-sky-muted">after {a.tries} tries</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {/* one quiet line, and only while there is something to say: a
              sample deck records nothing and stays silent. `aria-live` so a
              reader who is not watching this corner still hears it settle. */}
          {save !== "no" && (
            <p aria-live="polite" className={`mt-3 shrink-0 text-[12.5px] ${save === "failed" ? "text-sky-slipping" : "text-sky-muted"}`}>
              {SAVE_LINE[save]}
            </p>
          )}
        </SkySurface>
        <div className="flex flex-wrap gap-2">
          {next && <SkyButton onClick={next.onClick}>{next.label}</SkyButton>}
          {/* held while it is saving: this is the one control that leaves the
              page, and leaving before the record lands loses the run */}
          <SkyButton href={back.href} disabled={save === "saving"} variant={next ? "outline" : "solid"}>{back.label}</SkyButton>
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
      </SkyPageBody>
    </SkyPageShell>
  );
}
