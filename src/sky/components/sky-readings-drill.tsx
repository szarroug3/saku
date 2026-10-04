"use client";

// The readings drill's screen (SAK-495): one kanji at a time, its readings in
// a random order with no labels, and a kun'yomi and an on'yomi button beside
// each. A press is graded on the spot, a check or an X, and a miss shows the
// right label. End quiz is there the whole time; the score is the last screen.
//
// A view and nothing else. Which readings, which kanji first, the shuffle,
// the grading and the score are src/sky/lib/readings-drill.ts, with its
// tests. Nothing is written anywhere: the run is this component's state, so
// leaving the page or starting over is the end of it.

import { useMemo, useState } from "react";

import { SkyButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyPageBody } from "@/sky/components/sky-page-body";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { VERDICT } from "@/sky/components/quiz-results";
import { useMounted } from "@/sky/components/use-mounted";
import { japaneseFont } from "@/sky/lib/japanese";
import { seeded } from "@/sky/lib/random";
import { endRun, isRight, kanjiDone, labelReading, nextKanji, READING_LABEL, rightLabel, shuffleReadings, startRun, type DrillKanji, type DrillReading, type DrillRun, type DrillScore, type ReadingLabel } from "@/sky/lib/readings-drill";

const TITLE = "Kun'yomi or on'yomi?";
const LABELS: readonly ReadingLabel[] = ["kun", "on"];

/** A fresh seed for the readings' order, one per run. */
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export function SkyReadingsDrill({ pool, backHref, height }: {
  /** The kanji, in the order they are asked. */
  pool: readonly DrillKanji[];
  /** Where Back to practice goes. */
  backHref: string;
  height?: string;
}) {
  const [run, setRun] = useState<DrillRun>(startRun);
  const [seed, setSeed] = useState(newSeed);
  // the order is random, so it is only decided in the browser: the server's
  // order and the browser's would differ and the page would be drawn twice
  const mounted = useMounted();
  const kanji = run.ended ? undefined : pool[run.at];
  const readings = useMemo(() => (kanji ? shuffleReadings(kanji, seeded(seed + run.at)) : []), [kanji, seed, run.at]);

  if (run.ended) {
    return <DrillScoreView score={run.score} backHref={backHref} height={height} onAgain={() => { setRun(startRun()); setSeed(newSeed()); }} />;
  }

  const done = kanjiDone(run, pool);
  const end = <SkyButton variant="outline" onClick={() => setRun(endRun(run))}>End quiz</SkyButton>;
  return (
    <SkyPageShell eyebrow="Practice" title={TITLE} aside={end} height={height}>
      <SkyPageBody width="reading">
        {mounted && kanji && (
          <SkySurface className="flex flex-col items-center gap-5">
            <p className="text-center text-[13px] text-sky-muted">
              Sort each reading as kun&apos;yomi or on&apos;yomi.
              {run.score.labeled > 0 && <span className="tabular-nums"> {run.score.right} of {run.score.labeled} right so far.</span>}
            </p>
            <p lang="ja" className={`font-sky-display text-[88px] leading-none text-sky-ink ${japaneseFont(kanji.kanji)}`}>{kanji.kanji}</p>
            <ul className="flex w-full max-w-[460px] flex-col gap-2">
              {readings.map((r) => (
                <ReadingRow key={r.reading} reading={r} said={run.labels[r.reading]} onLabel={(label) => setRun(labelReading(run, pool, r.reading, label))} />
              ))}
            </ul>
            {done && <SkyButton onClick={() => setRun(nextKanji(run, pool))}>Next kanji</SkyButton>}
          </SkySurface>
        )}
      </SkyPageBody>
    </SkyPageShell>
  );
}

/** One reading: the two buttons until it is labeled, then the verdict. */
function ReadingRow({ reading, said, onLabel }: { reading: DrillReading; said?: ReadingLabel; onLabel: (label: ReadingLabel) => void }) {
  const right = said ? isRight(reading, said) : undefined;
  return (
    <li className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-sky-line px-4 py-2">
      <span lang="ja" className={`font-sky-display text-[24px] leading-none text-sky-ink ${japaneseFont(reading.reading)}`}>{reading.reading}</span>
      {said === undefined ? (
        <span className="flex gap-2">
          {LABELS.map((label) => <SkyButton key={label} variant="outline" onClick={() => onLabel(label)}>{READING_LABEL[label]}</SkyButton>)}
        </span>
      ) : right ? (
        <span className={`flex items-center gap-2 text-[14px] font-semibold ${VERDICT.clean}`}>
          <span aria-hidden>✓</span>
          <span>{rightLabel(reading)}</span>
          <span className="sr-only">, right</span>
        </span>
      ) : (
        <span className="flex flex-col items-end text-[14px]">
          <span className={`flex items-center gap-2 font-semibold ${VERDICT.missed}`}>
            <span aria-hidden>✗</span>
            <span className="line-through">{READING_LABEL[said]}</span>
            <span className="sr-only">, wrong</span>
          </span>
          <span className="text-sky-ink">It is {rightLabel(reading)}.</span>
        </span>
      )}
    </li>
  );
}

/** The end: the score, and nothing saved. */
function DrillScoreView({ score, backHref, height, onAgain }: { score: DrillScore; backHref: string; height?: string; onAgain: () => void }) {
  return (
    <SkyPageShell eyebrow="Practice" title="How it went" height={height}>
      <SkyPageBody width="reading">
        <SkySurface className="flex flex-col items-center gap-2 text-center">
          {score.labeled > 0 ? (
            <>
              <Eyebrow tight>Your score</Eyebrow>
              <p className="font-sky-display text-[44px] leading-none text-sky-ink tabular-nums">{score.right} of {score.labeled}</p>
              <p className="text-[14px] text-sky-ink/90">
                You sorted {score.right} of {score.labeled} {score.labeled === 1 ? "reading" : "readings"} right, over {score.kanji} kanji.
              </p>
            </>
          ) : (
            <p className="text-[14px] text-sky-ink/90">You ended before sorting any readings.</p>
          )}
          <p className="text-[13px] text-sky-muted">Nothing from this drill is saved.</p>
        </SkySurface>
        <div className="flex flex-wrap gap-2">
          <SkyButton onClick={onAgain}>Start over</SkyButton>
          <SkyButton variant="outline" href={backHref}>Back to practice</SkyButton>
        </div>
      </SkyPageBody>
    </SkyPageShell>
  );
}
