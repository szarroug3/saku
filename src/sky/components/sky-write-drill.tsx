"use client";

// The writing drill's screen (#BuildHybridAI): one English sentence at a
// time, a box to write it in Japanese, and a Check button. A near miss gets a
// hint and another try; right or wrong shows one way to say it, with its
// words line. A line above the card says where answers are checked: on this
// device, in the cloud, or not at all on a site with no Firebase set up.
//
// A view and nothing else. The run, the score and the grading prompt are
// src/sky/lib/write-drill.ts. Grading itself is handed in by the route
// (`grade`), the way the quiz gets its grader, so this file never touches
// the network or Firebase.

import { useEffect, useMemo, useState } from "react";

import { SkyButton, SkyTextButton } from "@/sky/components/sky-button";
import { DrillEndView, newDrillSeed } from "@/sky/components/drill-end";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyInput } from "@/sky/components/sky-input";
import { SkyPageBody } from "@/sky/components/sky-page-body";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { VERDICT } from "@/sky/components/quiz-results";
import { ExampleWords } from "@/sky/components/teach-page";
import { useMounted } from "@/sky/components/use-mounted";
import { japaneseFont } from "@/sky/lib/japanese";
import { seeded, shuffled } from "@/sky/lib/random";
import { endRun, giveUp, nextItem, recordGrade, startRun, WRITE_DRILL, type DeviceModelState, type Graded, type WriteItem, type WriteRun } from "@/sky/lib/write-drill";

const TITLE = WRITE_DRILL.name;


export interface WriteGrader {
  /** Whether this site can grade at all (Firebase is set up). */
  configured: boolean;
  /** Where Gemini Nano stands in this browser. */
  deviceState: () => Promise<DeviceModelState>;
  /** Starts Gemini Nano's download. Must be called from a click. */
  prepareDevice: (onProgress: (fraction: number) => void) => Promise<void>;
  /** Grades an answer. Throws when nothing could. */
  grade: (item: WriteItem, given: string) => Promise<Graded>;
}

export function SkyWriteDrill({ pool, backHref, grader, toKana, height }: {
  /** The sentences. The screen shuffles them. */
  pool: readonly WriteItem[];
  /** Where Back to practice goes. */
  backHref: string;
  grader: WriteGrader;
  /** Romaji to kana as it is typed, the quiz's own (typing.ts). */
  toKana: (value: string, katakana: boolean) => string;
  height?: string;
}) {
  const [run, setRun] = useState<WriteRun>(startRun);
  const [seed, setSeed] = useState(newDrillSeed);
  const [answer, setAnswer] = useState("");
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const device = useDeviceModel(grader);
  // the order is random, so it is only decided in the browser
  const mounted = useMounted();
  const order = useMemo(() => shuffled(pool, seeded(seed)), [pool, seed]);
  const item = run.ended ? undefined : order[run.at];

  if (run.ended) {
    return <DrillEndView
        right={run.score.right}
        of={run.score.answered}
        line={`You wrote ${run.score.right} of ${run.score.answered} ${run.score.answered === 1 ? "sentence" : "sentences"} right, ${run.score.firstTry} on the first try.`}
        empty="You ended before writing any sentences."
        backHref={backHref}
        height={height}
        onAgain={() => { setRun(startRun()); setSeed(newDrillSeed()); setAnswer(""); setFailed(false); }}
      />;
  }

  async function check() {
    if (!item || checking || run.done || !answer.trim() || !grader.configured) return;
    setChecking(true);
    setFailed(false);
    try {
      const graded = await grader.grade(item, answer);
      setRun((r) => recordGrade(r, graded));
    } catch {
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }

  function next() {
    setRun(nextItem(run, order));
    setAnswer("");
    setFailed(false);
  }

  const end = <SkyButton variant="outline" onClick={() => setRun(endRun(run))}>End quiz</SkyButton>;
  return (
    <SkyPageShell eyebrow="Practice" title={TITLE} aside={end} height={height}>
      <SkyPageBody width="reading">
        {mounted && item && (
          <SkySurface className="flex flex-col gap-4">
            <CheckedWhere configured={grader.configured} device={device} />
            <div className="flex flex-col gap-1">
              <Eyebrow tight>Write this in Japanese</Eyebrow>
              <p className="font-sky-display text-[26px] leading-snug text-sky-ink">{item.en}</p>
              <p className="text-[13px] text-sky-muted">
                {/* the gloss has brackets of its own ("as X (in the role
                    of)"), so it is quoted rather than bracketed */}
                It can use <span lang="ja" className={`text-sky-ink ${japaneseFont(item.pattern)}`}>{item.pattern}</span>, meaning &ldquo;{item.gloss}&rdquo;, but any natural way to say it counts.
              </p>
            </div>
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void check(); }}>
              <SkyInput
                lang="ja"
                aria-label="Your Japanese"
                value={answer}
                onChange={(e) => setAnswer(toKana(e.target.value, false))}
                placeholder="Type in romaji or Japanese"
                disabled={run.done || checking}
                className={`flex-1 text-[18px] ${japaneseFont(answer)}`}
                autoFocus
              />
              {!run.done && <SkyButton onClick={() => void check()} disabled={checking || !answer.trim() || !grader.configured}>{checking ? "Checking…" : "Check"}</SkyButton>}
            </form>
            {failed && <p className="text-[14px] text-sky-ink">Nothing could check that answer. Check your connection, or show the answer to compare.</p>}
            {run.last && <VerdictLine graded={run.last} />}
            {run.done ? (
              <>
                <Answer item={item} />
                <div><SkyButton onClick={next}>Next sentence</SkyButton></div>
              </>
            ) : (
              <div><SkyTextButton onClick={() => { setRun(giveUp(run)); setFailed(false); }}>Show the answer</SkyTextButton></div>
            )}
          </SkySurface>
        )}
      </SkyPageBody>
    </SkyPageShell>
  );
}

/** Where Gemini Nano stands, kept fresh while it downloads. */
function useDeviceModel(grader: WriteGrader): { state?: DeviceModelState; progress?: number; download: () => void } {
  const [state, setState] = useState<DeviceModelState>();
  const [progress, setProgress] = useState<number>();
  useEffect(() => {
    let live = true;
    void grader.deviceState().then((s) => { if (live) setState(s); });
    return () => { live = false; };
  }, [grader]);
  const download = () => {
    setState("downloading");
    setProgress(0);
    grader.prepareDevice((f) => setProgress(f))
      .then(() => grader.deviceState())
      .then((s) => setState(s))
      .catch(() => setState("unavailable"));
  };
  return { state, progress, download };
}

/** The line that says where answers are checked. */
function CheckedWhere({ configured, device }: { configured: boolean; device: ReturnType<typeof useDeviceModel> }) {
  const line = "text-[13px] text-sky-muted";
  if (!configured) return <p className={line}>Checking is not set up on this site. Write each one, then show the answer to compare.</p>;
  switch (device.state) {
    case undefined:
      return <p className={line}>&nbsp;</p>;
    case "available":
      return <p className={line}>Answers are checked by Gemini Nano on this device. When it finds a mistake, Gemini in the cloud checks again.</p>;
    case "downloadable":
      return (
        <p className={line}>
          Gemini Nano can check answers on this device once it is downloaded. Until then, answers are checked in the cloud.{" "}
          <SkyTextButton onClick={device.download}>Download it</SkyTextButton>
        </p>
      );
    case "downloading":
      return <p className={line}>Gemini Nano is downloading{device.progress !== undefined ? ` (${Math.round(device.progress * 100)}%)` : ""}. Until it is done, answers are checked in the cloud.</p>;
    case "unavailable":
      // the Prompt API is there but says no: a device that can't run Nano,
      // or a managed profile whose policy turns it off
      return <p className={line}>Gemini Nano is turned off or can&apos;t run on this device, so answers are checked by Gemini in the cloud.</p>;
    default:
      return <p className={line}>This browser has no on-device model, so answers are checked by Gemini in the cloud.</p>;
  }
}

const SOURCE: Record<Graded["source"], string> = {
  exact: "It matches the answer.",
  on_device: "Checked on your device.",
  in_cloud: "Checked in the cloud.",
};

/** The verdict, the grader's note, and where it was checked. */
function VerdictLine({ graded }: { graded: Graded }) {
  if (graded.unsure) {
    return (
      <p className="text-[14px] text-sky-ink" role="status">
        Your device wasn&apos;t sure about this one, and it can&apos;t be checked in the cloud right now. Compare yours with the answer below.
      </p>
    );
  }
  const head = graded.verdict === "right"
    ? <span className={`font-semibold ${VERDICT.clean}`}><span aria-hidden>✓ </span>Right</span>
    : graded.verdict === "close"
      ? <span className={`font-semibold ${VERDICT.help}`}>Almost. Try again.</span>
      : <span className={`font-semibold ${VERDICT.missed}`}><span aria-hidden>✗ </span>Not quite</span>;
  const where = graded.checked ? "Checked on your device, then again in the cloud." : SOURCE[graded.source];
  return (
    <div className="flex flex-col gap-1 text-[14px]" role="status">
      <p>{head}{graded.note && <span className="text-sky-ink"> {graded.note}</span>}</p>
      <p className="text-[12.5px] text-sky-muted">{where}</p>
    </div>
  );
}

/** One way to say it, with its words line and where the sentence is from. */
function Answer({ item }: { item: WriteItem }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-sky-line px-4 py-3">
      <Eyebrow tight>One way to say it</Eyebrow>
      <p lang="ja" className={`text-[22px] text-sky-ink ${japaneseFont(item.jp)}`}>{item.jp}</p>
      {item.words.length > 0 && <ExampleWords words={item.words} />}
      <a href={`https://tatoeba.org/en/sentences/show/${item.id}`} target="_blank" rel="noreferrer" className="text-[12px] text-sky-muted underline">Sentence from Tatoeba</a>
    </div>
  );
}
