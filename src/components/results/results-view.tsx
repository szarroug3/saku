"use client";

// The results screen, top to bottom: how it went, what's still wrong, what's
// getting better, and then the board — where everything lit is what Redrill
// will run.
//
// Renders a ResultsPayload from useQuizSession: either a live finish or a
// stored session reopened from Recent sessions. Sessions saved before
// per-character detail existed (summaryOnly) keep their stored percentages and
// simply have less to say — no confusions were recorded, so Patterns and
// Progress stay silent rather than guess.
//
// NOTHING HERE WRITES SETTINGS. The First try / Eventually right chips are a
// local lens on this run; the global preference only decides which one they
// start on.

import { useMemo, useState } from "react";

import { AccuracyRing } from "@/components/home/accuracy-ring";
import { PatternSection } from "@/components/results/pattern-rows";
import {
  deriveRun,
  historyBefore,
  readableStats,
  summarize,
  type Bit,
} from "@/components/results/summary";
import { TriageSection } from "@/components/results/triage-board";
import { Card, Chip, PageTitle } from "@/components/ui";
import { analyzeRun } from "@/lib/confusions";
import { weakestFacts } from "@/lib/decks";
import { entryOf } from "@/lib/facts";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ResultsPayload } from "@/lib/quiz-session";
import { emptySelection, resolve } from "@/lib/selection";
import { useHistory } from "@/lib/use-history";
import type { AccuracyMetric, FactId, QuizMode } from "@/types";

const EMPTY_ANALYSIS = { patterns: [], progress: [] };

function modeName(m: QuizMode): string {
  return m === "pairs" ? "Match pairs" : m === "grid" ? "Grid" : "Drill";
}

/**
 * Accuracy as a filled arc — the same read as Home's deck rings, at hero size.
 * A finished run always has a number, so there is no dashed empty state here;
 * `null` only happens if a session somehow stored nothing, and then the ring
 * simply doesn't draw rather than claiming a 0% nobody earned.
 *
 * Home's AccuracyRing at 78px rather than a second copy of the arc: this used
 * to be its own conic, which meant its seam had to be fixed twice and its
 * `rounded-full border` silently collected globals.css's per-theme chrome —
 * squaring the "circle" to a 2px-radius box in aizome.
 *
 * Green at 100%: the one moment the ring is reporting an achievement rather
 * than a measurement.
 */
function BigRing({ pct }: { pct: number | null }) {
  return (
    <AccuracyRing
      pct={pct}
      unpractised="hidden"
      size={78}
      stroke={7.5}
      arc={pct === 100 ? "var(--success)" : "var(--arc)"}
      labelClassName="text-[17px] font-semibold tabular-nums"
    />
  );
}

/** A generated sentence, with the characters your eye should land on. */
function Line({ bits, className }: { bits: Bit[]; className?: string }) {
  return (
    <span className={className}>
      {bits.map((b, i) =>
        b.em ? (
          <b key={i} className="font-kana font-medium text-text">
            {b.t}
          </b>
        ) : (
          <span key={i}>{b.t}</span>
        ),
      )}
    </span>
  );
}

export function ResultsView({ results }: { results: ResultsPayload }) {
  const { cfg } = useQuizConfig();
  const { history } = useHistory();
  const { active, abandonQuiz, startQuiz } = useQuizSession();

  // Local lens, never a setting. Null means "still following the preference",
  // which also survives cfg hydrating from localStorage a beat after mount —
  // no effect, no stale initial state.
  const [chosen, setChosen] = useState<AccuracyMetric | null>(null);
  const metric = chosen ?? cfg.accuracyMetric;

  // Fixed at mount: a just-finished quiz shows time-of-day like the legacy
  // finish screen; anything older (reopened sessions) shows the full date.
  const [recent] = useState(() => Date.now() - results.ts < 60_000);

  const { summaryOnly } = results;
  const graduateRuns = cfg.graduateRuns;
  // One normalisation, so nothing downstream has to remember that a stored
  // session's per-character detail is largely synthesized.
  const stats = useMemo(() => readableStats(results), [results]);

  // History as it was BEFORE this run — the session is POSTed the moment it
  // finishes, and a run must not be part of the history that judges it.
  const prior = useMemo(
    () => historyBefore(history, results.ts),
    [history, results.ts],
  );
  const analysis = useMemo(
    () =>
      summaryOnly
        ? EMPTY_ANALYSIS
        : analyzeRun(stats, history, {
            graduateRuns,
            entryOf,
            excludeTs: results.ts,
          }),
    [stats, history, graduateRuns, results.ts, summaryOnly],
  );
  const facts = useMemo(() => deriveRun(results, metric), [results, metric]);
  const summary = useMemo(
    () => summarize(facts, stats, prior, analysis.progress),
    [facts, stats, prior, analysis.progress],
  );
  const weakest = useMemo(
    () => weakestFacts(prior, metric, 20),
    [prior, metric],
  );

  // The heaviest record on screen, so an improving row can say what the pair
  // was before it started getting better.
  const worstKey = useMemo(() => {
    const rows = [...analysis.patterns, ...analysis.progress];
    let worst: (typeof rows)[number] | null = null;
    for (const r of rows) if (!worst || r.record.total > worst.record.total) worst = r;
    return worst?.key;
  }, [analysis]);

  const when = recent
    ? new Date(results.ts).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : new Date(results.ts).toLocaleString();

  /** Stored results can be viewed mid-quiz — starting a new run from here
   * must explicitly discard the one in progress. True = clear to start. */
  const discardActive = (): boolean => {
    if (!active) return true;
    if (!window.confirm("Discard the quiz in progress?")) return false;
    abandonQuiz();
    return true;
  };

  /** Start a run over FACTS. There is no conversion left to do — the runtime
   * is fact-native, so what this screen scored is exactly what it can re-drill.
   * The old bridge here mapped every fact back to its entry's glyph and started
   * a quiz on characters, which was correct only while every entry was one kana
   * whose glyph was its key. */
  const startFacts = (facts: FactId[], what: string, redrill?: boolean) => {
    if (!facts.length) return;
    if (!discardActive()) return;
    startQuiz(facts, { redrill, what });
  };

  /**
   * The things THIS session asked, for Rerun.
   *
   * Rerun used to re-read the live selection (`selectedChars(cfg)`), which
   * answered a different question: it ran whatever is selected NOW, not what
   * you just did. Same button, same word, different set — and you would only
   * notice if you had changed the selection since.
   *
   * A past session is a named list of keys, so this is one field on an empty
   * query and no new code path. It goes through resolve() like everything else,
   * which is also what makes it self-correcting: a fact the data no longer has
   * drops out here rather than being queued for a question nobody can render.
   */
  const rerunFacts = (): FactId[] =>
    resolve({ ...emptySelection(), session: results.ts }, history);

  return (
    <>
      <PageTitle
        title="Results"
        sub={`${modeName(results.mode)}${results.redrill ? " (redrill)" : ""} · ${
          facts.total
        } characters · ${when}${summaryOnly ? " · Older session, summary only" : ""}`}
      />

      <Card className="flex items-center gap-3.5">
        <BigRing pct={facts.pct} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{summary.headline}</span>
          {summary.detail ? (
            <Line bits={summary.detail} className="text-[13px] text-text-muted" />
          ) : null}
          <Line bits={summary.counts} className="text-[13px] text-text-muted" />
        </span>
      </Card>

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        <Chip on={metric === "firstTry"} onClick={() => setChosen("firstTry")}>
          First try
        </Chip>
        <Chip on={metric === "attempt"} onClick={() => setChosen("attempt")}>
          Eventually right
        </Chip>
      </div>

      <PatternSection
        label="Patterns"
        rows={analysis.patterns}
        stats={stats}
        graduateRuns={graduateRuns}
        worstKey={worstKey}
      />
      <PatternSection
        label="Progress"
        rows={analysis.progress}
        stats={stats}
        graduateRuns={graduateRuns}
        worstKey={worstKey}
      />

      <TriageSection
        // Remount on a flip: the chip re-derives which characters need work, so
        // the selection it seeded has to be re-seeded with them.
        key={metric}
        facts={facts}
        stats={stats}
        weakest={weakest}
        onRedrill={(picked) => startFacts(picked, "The misses", true)}
        // Rerun is not a special case and has no code of its own: a past
        // session is a named list of keys, so "run that again" is Drill on a
        // slice — the same resolve() as everything else, with one field set.
        onRerun={() => startFacts(rerunFacts(), "That session")}
        onDrillWeakest={() => startFacts(weakest, "The weakest")}
      />
    </>
  );
}
