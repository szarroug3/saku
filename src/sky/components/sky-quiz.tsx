"use client";

// The Quiz: the quiet room. Tracked as SAK-312 to SAK-317.
//
// The sky is dense and full of things to look at; the Quiz is the opposite
// on purpose: one prompt, centred, nothing in the corners. The screen only
// widens once you have answered, because that is the moment there is
// something worth saying. Narrow to concentrate, wide to understand.
//
// One call from the route, given the cards and a grader. A thin strip of
// pips along the top, one per card, coloured by outcome. Every card opens
// on a blank box; a miss shows the narrowed set for a second look, and the
// set can be asked for at any time at the cost of the clean grade. The
// reveal is the same card the Lesson teaches with, so the explanation is
// the teaching. At the end, the four counts and what each does to the
// schedule, then the answers go to whoever records them.

import { useEffect, useRef, useState, type FormEvent } from "react";

import { LessonCard, type HearComponent, type PitchComponent } from "@/sky/components/lesson-card";
import { SkyButton } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { japaneseFont } from "@/sky/lib/japanese";
import { GRADE, GRADES, gradeFor, tally, type Grade, type QuizAnswer, type QuizCard, type Verdict } from "@/sky/lib/quiz";
import { KIND_LABEL } from "@/sky/lib/tokens";

export interface SkyQuizProps {
  cards: readonly QuizCard[];
  /** Whether what was typed answers the card, and if not, whether it nearly did. */
  grade: (card: QuizCard, given: string) => Verdict;
  /** Where the answers go when the session ends: the schedule. */
  onFinish?: (answers: readonly QuizAnswer[]) => Promise<void>;
  /** Back to the sky. */
  skyHref: string;
  hear?: HearComponent;
  pitch?: PitchComponent;
  height?: string;
}

/** The pip and verdict colours, by grade. */
const PIP: Record<Grade, string> = {
  clean: "bg-sky-solid",
  nearly: "bg-sky-getting-there",
  help: "bg-sky-shaky",
  missed: "bg-sky-slipping",
};
const VERDICT: Record<Grade, string> = {
  clean: "text-sky-solid",
  nearly: "text-sky-getting-there",
  help: "text-sky-shaky",
  missed: "text-sky-slipping",
};

type Stage = "ask" | "narrowed" | "reveal";

export function SkyQuiz({ cards, grade, onFinish, skyHref, hear, pitch, height }: SkyQuizProps) {
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<readonly QuizAnswer[]>([]);
  const [stage, setStage] = useState<Stage>(cards[0]?.typed ? "ask" : "narrowed");
  const [given, setGiven] = useState("");
  const [tries, setTries] = useState(0);
  const [narrowedBy, setNarrowedBy] = useState<"miss" | "ask" | "only" | null>(cards[0]?.typed ? null : "only");
  const [showHint, setShowHint] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<QuizAnswer | null>(null);
  const [saved, setSaved] = useState<"no" | "saving" | "yes" | "failed">("no");
  const input = useRef<HTMLInputElement>(null);

  const card = cards[at];
  const done = at >= cards.length;

  // the box takes focus for every new card, and the reveal's Next does
  useEffect(() => { if (stage === "ask") input.current?.focus(); }, [at, stage]);

  const settle = (g: Grade, extra: Partial<QuizAnswer> = {}) => {
    const answer: QuizAnswer = { cardId: card.id, grade: g, tries: Math.max(1, tries + 1), narrowed: narrowedBy !== null, given: given || undefined, ...extra };
    setResult(answer);
    setStage("reveal");
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = given.trim();
    if (!text) return;
    const verdict = grade(card, text);
    const g = gradeFor(verdict, narrowedBy !== null, tries + 1);
    if (g) { settle(g); return; }
    // a miss: not marked wrong yet; the narrowed set, and a second look
    if (narrowedBy === null) { setNarrowedBy("miss"); setStage("narrowed"); setTries(tries + 1); return; }
    settle("missed", { tries: tries + 1 });
  };

  const choose = (id: string) => {
    setChosen(id);
    if (id === card.answerId) settle("help", { tries: tries + 1 });
    else settle("missed", { tries: tries + 1 });
  };

  const next = () => {
    if (!result) return;
    const all = [...answers, result];
    setAnswers(all);
    const n = at + 1;
    setAt(n);
    setGiven(""); setTries(0); setShowHint(false); setChosen(null); setResult(null);
    const coming = cards[n];
    setNarrowedBy(coming && !coming.typed ? "only" : null);
    setStage(coming && !coming.typed ? "narrowed" : "ask");
    if (n >= cards.length && onFinish) {
      setSaved("saving");
      onFinish(all).then(() => setSaved("yes"), () => setSaved("failed"));
    }
  };

  // Enter moves on from the reveal
  useEffect(() => {
    if (stage !== "reveal") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); next(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const strip = (
    <div className="flex items-center gap-3 font-sky-ui text-[12.5px] text-sky-muted">
      <div className="flex items-center gap-1" aria-label="The cards">
        {cards.map((c, i) => {
          const a = answers[i] ?? (i === at ? result : null);
          return <span key={c.id} aria-hidden className={`h-1.5 w-4 rounded-full ${a ? PIP[a.grade] : i === at ? "bg-sky-ink" : "bg-sky-card-strong"}`} />;
        })}
      </div>
      <span className="tabular-nums">{Math.min(at + 1, cards.length)} of {cards.length}</span>
    </div>
  );

  if (cards.length === 0) {
    return (
      <SkyPageShell eyebrow="Quiz" title="Nothing to quiz" height={height}>
        <SkySurface className="mx-auto max-w-[560px]">
          <p className="text-[14px] text-sky-muted">Nothing is due. Learn something in the Observatory, or pick things in the Atlas and ask for a quiz.</p>
          <SkyButton href={skyHref} className="mt-4">Back to the sky</SkyButton>
        </SkySurface>
      </SkyPageShell>
    );
  }

  if (done) {
    const counts = tally(answers);
    return (
      <SkyPageShell eyebrow="Quiz" title="How it went" aside={strip} height={height}>
        <div className="mx-auto flex w-full max-w-[720px] min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui">
          <SkySurface>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {GRADES.map((g) => (
                <div key={g}>
                  <dt className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${VERDICT[g]}`}>{GRADE[g].label}</dt>
                  <dd className="font-sky-display text-[28px] leading-none text-sky-ink">{counts[g]}</dd>
                  <dd className="mt-1 text-[12px] leading-snug text-sky-muted">{GRADE[g].consequence}</dd>
                </div>
              ))}
            </dl>
          </SkySurface>
          <SkySurface>
            <ul className="flex flex-col gap-2">
              {answers.map((a) => {
                const c = cards.find((x) => x.id === a.cardId)!;
                return (
                  <li key={a.cardId} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-sky-line pb-2 last:border-0 last:pb-0">
                    <span className={`font-sky-display text-[20px] leading-none text-sky-ink ${japaneseFont(c.item.glyph)}`}>{c.item.glyph}</span>
                    <span className={`text-[13px] ${japaneseFont(c.answer)}`}>{c.answer}</span>
                    <span className={`ml-auto text-[12px] font-semibold ${VERDICT[a.grade]}`}>{GRADE[a.grade].label}</span>
                    {a.grade === "nearly" && a.given && <span className="w-full text-[12px] text-sky-muted">You wrote {a.given}.</span>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[12.5px] text-sky-muted">
              {!onFinish ? "A look only: nothing was recorded." : saved === "saving" ? "Recording…" : saved === "yes" ? "Recorded against your schedule." : saved === "failed" ? "Could not record this. Your schedule is unchanged." : ""}
            </p>
          </SkySurface>
          <div><SkyButton href={skyHref}>Back to the sky</SkyButton></div>
        </div>
      </SkyPageShell>
    );
  }

  const meta = [KIND_LABEL[card.item.kind], card.seen > 0 ? `seen ${card.seen} ${card.seen === 1 ? "time" : "times"}` : "first time", card.missed > 0 ? `missed ${card.missed} ${card.missed === 1 ? "time" : "times"} before` : null].filter(Boolean).join(" · ");
  const wide = stage === "reveal";

  return (
    <SkyPageShell eyebrow="Quiz" title="Quiz" aside={strip} height={height}>
      <div className={`mx-auto flex w-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui transition-[max-width] ${wide ? "max-w-[960px]" : "max-w-[560px]"}`}>
        <SkySurface className="shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">{meta}</p>
          <div className="mt-4 flex flex-col items-center text-center">
            <p className={`font-sky-display leading-none text-sky-ink ${card.prompt.jp ? ([...card.prompt.glyph].length <= 2 ? "text-[72px]" : "text-[40px]") : "text-[30px]"} ${japaneseFont(card.prompt.glyph)}`}>{card.prompt.glyph}</p>
            {card.prompt.context && <p className={`mt-3 text-[15px] text-sky-muted ${japaneseFont(card.prompt.context)}`}>{card.prompt.context}</p>}
            {card.instruction && stage !== "reveal" && <p className="mt-2 text-[13px] text-sky-muted">{card.instruction}</p>}
          </div>

          {stage !== "reveal" && (
            <div className="mt-5 flex flex-col gap-3">
              {stage === "narrowed" && narrowedBy === "miss" && (
                <p className="text-[13px] text-sky-muted">Not that. Here it is narrowed down; one more look.</p>
              )}
              {stage === "narrowed" && narrowedBy === "ask" && (
                <p className="text-[13px] text-sky-muted">Narrowed down. A right answer now counts as with help.</p>
              )}
              {(stage === "ask" || (stage === "narrowed" && card.typed)) && (
                <form onSubmit={submit} className="flex gap-2">
                  <input
                    ref={input}
                    value={given}
                    onChange={(e) => setGiven(e.target.value)}
                    placeholder={card.answerIs === "reading" ? "The reading, in romaji" : card.answerIs === "meaning" ? "The meaning, in English" : "Your answer"}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-xl border border-sky-muted/45 bg-sky-card px-4 py-2.5 text-[16px] text-sky-ink placeholder:text-sky-muted focus:border-sky-accent focus:outline-none"
                  />
                  <SkyButton onClick={() => submit()} disabled={!given.trim()}>Check</SkyButton>
                </form>
              )}
              {stage === "narrowed" && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {card.options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => choose(o.id)}
                      className={`rounded-xl border border-sky-line bg-sky-card px-3 py-2.5 text-left hover:border-sky-accent ${o.jp ? `font-sky-display text-[18px] ${japaneseFont(o.label)}` : "text-[13.5px]"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              {showHint && card.hint && (
                <div className="flex items-center gap-3 rounded-xl border border-sky-line px-3 py-2 text-[13.5px] text-sky-muted">
                  {card.hint.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.hint.image} alt="" className="size-[72px] rounded-md object-contain" />
                  )}
                  {card.hint.text && <span>{card.hint.text}</span>}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-sky-muted">
                {stage === "ask" && <button type="button" onClick={() => { setNarrowedBy("ask"); setStage("narrowed"); }} className="underline hover:text-sky-ink">Narrow it down (costs the clean grade)</button>}
                {card.hint && !showHint && <button type="button" onClick={() => setShowHint(true)} className="underline hover:text-sky-ink">A hint</button>}
                <button type="button" onClick={() => settle("missed", { tries: tries + 1 })} className="underline hover:text-sky-ink">I don&apos;t know this one</button>
              </div>
            </div>
          )}

          {stage === "reveal" && result && (
            <div className="mt-5 flex flex-col gap-3">
              <p className="text-center">
                <span className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${VERDICT[result.grade]}`}>{GRADE[result.grade].label}</span>
                <span className="mt-1 block text-[13px] text-sky-muted">{GRADE[result.grade].meaning}</span>
              </p>
              <p className={`text-center font-sky-display text-[28px] leading-tight text-sky-ink ${japaneseFont(card.answer)}`}>{card.answer}</p>
              {result.grade === "nearly" && result.given && <p className="text-center text-[13px] text-sky-muted">You wrote <span className="text-sky-ink">{result.given}</span>; it is <span className={`text-sky-ink ${japaneseFont(card.answer)}`}>{card.answer}</span>.</p>}
              {(result.grade === "missed" || result.grade === "help") && chosen && chosen !== card.answerId && (
                <p className="text-center text-[13px] text-sky-muted">You chose {card.options.find((o) => o.id === chosen)?.label}.</p>
              )}
              <div className="flex justify-center"><SkyButton onClick={next}>{at + 1 < cards.length ? "Next" : "Finish"}</SkyButton></div>
            </div>
          )}
        </SkySurface>

        {stage === "reveal" && (
          <LessonCard item={card.item} teach={card.teach} madeOf={[]} partOf={[]} known={false} onSelect={() => undefined} hear={hear} pitch={pitch} />
        )}
      </div>
    </SkyPageShell>
  );
}
