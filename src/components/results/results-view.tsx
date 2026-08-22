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
// NOTHING HERE WRITES SETTINGS. Results are shown as correct or not — a retry
// that landed counts the same as landing cold.

import { useCallback, useMemo, useState } from "react";

import { FactProgressSection } from "@/components/results/fact-progress";
import { PatternSection } from "@/components/results/pattern-rows";
import { ResultsCard } from "@/components/results/results-card";
import {
  deriveRun,
  historyBefore,
  readableStats,
  summarize,
} from "@/components/results/summary";
import { TriageSection } from "@/components/results/triage-board";
import { Btn, Lbl, PageTitle } from "@/components/ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { pairEntries } from "@/lib/confusions";
import { analyzeRun } from "@/lib/confusions";
import { pairRecentRuns } from "@/lib/confusions";
import type { PairRow } from "@/lib/confusions";
import {
  resolveFactInfos,
  resolveFactsOfEntries,
  resolveWeakestFacts,
} from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type ResultsPayload } from "@/lib/quiz-session";
import { useHistoryWrites } from "@/lib/history-writes";
import { emptySelection, resolve } from "@/lib/selection";
import { deriveSessionList } from "@/lib/session-list";
import { useHistory } from "@/lib/use-history";
import { useLists } from "@/lib/use-lists";
import { SOLID_PCT, standingOf } from "@/lib/library/standing";
import { addClearedFact } from "@/components/results/clear-state";
import type { EntryId, FactId, FactInfo, QuizMode } from "@/types";

const EMPTY_ANALYSIS = { patterns: [], progress: [] };
const EMPTY_FACT_IDS: readonly FactId[] = [];
const EMPTY_ENTRY_IDS: readonly EntryId[] = [];
const EMPTY_FACT_INFO_MAP: Record<string, FactInfo> = {};
const EMPTY_FACTS_OF_MAP: Record<string, FactId[]> = {};

function pctOf(runs: boolean[]): number {
  if (!runs.length) return 0;
  const hits = runs.filter(Boolean).length;
  return (100 * hits) / runs.length;
}

function runsToReach(runs: boolean[], targetPct: number): number {
  if (pctOf(runs) >= targetPct) return 0;
  let next = [...runs];
  for (let i = 1; i <= 50; i++) {
    next = [...next, true].slice(-10);
    if (pctOf(next) >= targetPct) return i;
  }
  return 50;
}

function modeName(m: QuizMode): string {
  return m === "pairs"
    ? "Match pairs"
    : m === "grid"
      ? "Grid"
      : m === "assembly"
        ? "Build sentences"
        : m === "substitution"
          ? "Substitution"
          : m === "listen-sentence"
            ? "Listen to sentences"
            : "Drill";
}

export function ResultsView({ results }: { results: ResultsPayload }) {
  const { cfg } = useQuizConfig();
  const { history } = useHistory();
  const writes = useHistoryWrites();
  const confirm = useConfirm();
  const { save } = useLists();
  const { active, abandonQuiz, startQuiz } = useQuizSession();

  // Fixed at mount: a just-finished quiz shows time-of-day like the legacy
  // finish screen; anything older (reopened sessions) shows the full date.
  const [recent] = useState(() => Date.now() - results.ts < 60_000);

  // "Save as a list" flips this on success so the button can't fire twice. The
  // id is derived from the timestamp, so a second save would be idempotent
  // anyway — this is just what the person sees.
  const [savedAsList, setSavedAsList] = useState(false);

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
  // SAK-104: lib/facts.ts's entryOf is a guarded dictionary read, injected
  // into analyzeRun/pairRecentRuns below exactly the way lib/confusions.ts's
  // own `EntryOf` type is built for (see its header comment) — so the fix is
  // to batch-resolve it, not to restructure those functions. The full set of
  // facts either function can ever ask about is bounded by what's already in
  // `history` (this run's own `stats` plus every past session's recorded
  // `detail`, both keyed by FactId — see SessionStats/QuizSessionRecord),
  // fetched once here and read synchronously through `localEntryOf` — the
  // same fallback lib/facts.ts documents (an id this run doesn't recognise
  // answers as itself).
  const allFactIds = useMemo(() => {
    const set = new Set<FactId>();
    for (const f of Object.keys(stats)) set.add(f as FactId);
    for (const s of history.sessions) {
      if (s.detail) for (const f of Object.keys(s.detail)) set.add(f as FactId);
    }
    return set.size ? [...set] : EMPTY_FACT_IDS;
  }, [stats, history]);
  const factInfoMap =
    useServerLookup(resolveFactInfos, [allFactIds]) ?? EMPTY_FACT_INFO_MAP;
  const localEntryOf = useCallback(
    (id: FactId): EntryId =>
      factInfoMap[id as unknown as string]?.entry ?? (id as unknown as EntryId),
    [factInfoMap],
  );

  const analysis = useMemo(
    () =>
      summaryOnly
        ? EMPTY_ANALYSIS
        : analyzeRun(stats, history, {
            graduateRuns,
            entryOf: localEntryOf,
            excludeTs: results.ts,
          }),
    [stats, history, graduateRuns, results.ts, summaryOnly, localEntryOf],
  );
  // Compute pair runs for all progress rows once, then filter and reuse.
  // This avoids calling pairRecentRuns twice per row (once to filter visibility,
  // once to display runs), which is expensive when iterating through history.
  //
  // Declared here, right after `analysis`, rather than nearer the pair-progress
  // code below that mostly uses it: `clearNow` (further down) closes over this
  // value, and the React Compiler's memoization-preservation check trips when a
  // closure created BEFORE a memo's declaration reads it — even though that's
  // completely valid JS (the closure only ever RUNS after this line has
  // executed for the render). Source order matching actual dependency order
  // avoids the false bailout; see the "Compilation Skipped" error this used to
  // produce if you move it back down next to clearNow.
  const allProgressPairRuns = useMemo(
    () =>
      new Map(
        analysis.progress.map((row) => [
          row.key,
          [
            ...pairRecentRuns(history, row.key, {
              entryOf: localEntryOf,
              excludeTs: results.ts,
            }),
            true,
          ].slice(-10),
        ]),
      ),
    [analysis.progress, history, results.ts, localEntryOf],
  );

  const facts = useMemo(() => deriveRun(results), [results]);
  const summary = useMemo(
    () => summarize(facts, stats, prior, analysis.progress),
    [facts, stats, prior, analysis.progress],
  );
  // Ranked as of THIS RUN's timestamp, not as of now — `results.ts`, the same
  // clock `prior` is cut at. Two reasons, and neither is tidiness:
  //
  //   1. A stored session reopened next week must say what it said when it
  //      finished. Ranking it against today's clock would rewrite the past:
  //      "here's what to work on" would drift every time you looked at it,
  //      under a heading about a run that ended on Tuesday.
  //   2. Date.now() in a render is not a pure render. This one is a prop of the
  //      payload, so the screen is a function of its input and nothing here
  //      needs a clock at all.
  const weakest: FactId[] = [
    ...(useServerLookup(resolveWeakestFacts, [prior, results.ts, 20]) ?? EMPTY_FACT_IDS),
  ];

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
   * must explicitly discard the one in progress. True = clear to start.
   *
   * Async now, and so is everything downstream of it: the confirm is a dialog
   * in the page rather than the browser's blocking one, so the answer arrives
   * on a later tick and cannot be returned to this frame. */
  const discardActive = async (): Promise<boolean> => {
    if (!active) return true;
    const ok = await confirm({
      title: "Discard the quiz in progress?",
      body: "Your answers so far will not be scored.",
      confirmLabel: "Discard quiz",
    });
    if (!ok) return false;
    abandonQuiz();
    return true;
  };

  /** Start a run over FACTS. There is no conversion left to do — the runtime
   * is fact-native, so what this screen scored is exactly what it can re-drill.
   * The old bridge here mapped every fact back to its entry's glyph and started
   * a quiz on characters, which was correct only while every entry was one kana
   * whose glyph was its key.
   *
   * Async because `discardActive` is: the confirm is a dialog in the page, not
   * the browser's blocking one, so the answer arrives on a later tick. */
  const startFacts = async (
    facts: FactId[],
    what: string,
    opts?: { redrill?: boolean; mode?: QuizMode; coverage?: boolean },
  ) => {
    if (!facts.length) return;
    if (!(await discardActive())) return;
    startQuiz(facts, { redrill: opts?.redrill, what, mode: opts?.mode, coverage: opts?.coverage });
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
  const rerunFacts = useMemo(
    (): FactId[] =>
      resolve({ ...emptySelection(), session: results.ts }, history),
    [history, results.ts],
  );

  /** Turn this finished session into a saved list, so its exact items can be
   * drilled again later. A past session is a DERIVED list whose query selects
   * the session by timestamp — the same rule Rerun resolves, now given a name.
   * The id is `session-<ts>`, so saving twice writes the same list rather than
   * a duplicate. */
  const saveAsList = async () => {
    await save(deriveSessionList(results.ts));
    setSavedAsList(true);
  };

  // Clearing a pair stamps `clearedMixups[key]` to now, which makes
  // `pairRecords` discard every run for that pair (all of them predate "now")
  // rather than land on the natural "cleared" state — so the row would vanish
  // from `analysis.progress` the instant history re-renders. A snapshot of the
  // row (and its runs) taken right before clearing is what keeps it on screen
  // afterwards, tagged Cleared instead of flickering out.
  const [clearedProgressPairs, setClearedProgressPairs] = useState<
    Map<string, { row: PairRow; runs: boolean[] }>
  >(new Map());
  const [selectedProgress, setSelectedProgress] = useState<Set<FactId>>(new Set());
  const [clearedProgressFacts, setClearedProgressFacts] = useState<Set<FactId>>(new Set());

  const clearNow = async (key: string) => {
    const [a, b] = pairEntries(key);
    // SAK-104: factsOf reads lib/facts.ts (server-only). This is an event
    // handler, not a render, so a live round trip costs nothing a click
    // wasn't already going to wait on.
    const resolved = await resolveFactsOfEntries([a, b]);
    const facts = [...new Set([...(resolved[a] ?? []), ...(resolved[b] ?? [])])];
    if (facts.length) writes.claim(facts);
    const row = analysis.progress.find((r) => r.key === key);
    const runs = allProgressPairRuns.get(key);
    writes.clearMixup(key);
    if (row) {
      setClearedProgressPairs((prev) => {
        const next = new Map(prev);
        next.set(key, { row, runs: runs ?? [] });
        return next;
      });
    }
  };

  // Facts that were unstable before this run (shaky/getting there) and are
  // now clean can be cleared individually from the triage board.
  const factProgressRows = useMemo(() => {
    const out: Array<{ fact: FactId; runs: boolean[] }> = [];
    for (const fact of facts.solid) {
      const priorStanding = standingOf(
        prior.facts[fact],
        prior.claims?.[fact],
        results.ts,
      ).standing;
      if (priorStanding === "shaky" || priorStanding === "getting-there") {
        const runs = [
          ...(prior.facts[fact]?.recentRuns ?? []).map((run) => run.firstTry),
          true,
        ].slice(-10);
        if (runsToReach(runs, SOLID_PCT) === 0) continue;
        out.push({ fact, runs });
      }
    }
    return out;
  }, [facts.solid, prior.facts, prior.claims, results.ts]);
  const clearableFacts = useMemo(
    () => new Set<FactId>(factProgressRows.map((row) => row.fact)),
    [factProgressRows],
  );

  const clearFactNow = (fact: FactId): void => {
    if (!clearableFacts.has(fact)) return;
    setClearedProgressFacts((prev) => addClearedFact(prev, fact));
    writes.claim([fact]);
  };

  const triageFacts = useMemo(
    () => facts.facts.filter((fact) => !clearableFacts.has(fact)),
    [facts.facts, clearableFacts],
  );
  const triageRun = useMemo(
    () => ({ ...facts, facts: triageFacts, solid: facts.solid.filter((fact) => !clearableFacts.has(fact)) }),
    [facts, triageFacts, clearableFacts],
  );

  const visiblePairProgressRows = useMemo(() => {
    const rows = analysis.progress.filter((row) => {
      // Show pairs that still need work, or pairs that have been explicitly cleared
      if (clearedProgressPairs.has(row.key)) return true;
      const runs = allProgressPairRuns.get(row.key) ?? [];
      return runsToReach(runs, SOLID_PCT) > 0;
    });
    // A cleared pair's record gets truncated to nothing once history reflects
    // the clear, so analyzeRun stops producing it at all. The snapshot taken
    // at clear time is what keeps the row (and its Cleared tag) on screen.
    const seen = new Set(rows.map((row) => row.key));
    for (const [key, snapshot] of clearedProgressPairs) {
      if (!seen.has(key)) rows.push(snapshot.row);
    }
    return rows;
  }, [analysis.progress, allProgressPairRuns, clearedProgressPairs]);

  // The pair-progress board's own on-screen rows are the whole bounded set —
  // batch every entry they name in one round trip rather than one per row.
  const pairProgressEntryIds = useMemo(() => {
    const set = new Set<EntryId>();
    for (const row of visiblePairProgressRows) {
      const [a, b] = pairEntries(row.key);
      set.add(a);
      set.add(b);
    }
    return set.size ? [...set] : EMPTY_ENTRY_IDS;
  }, [visiblePairProgressRows]);
  const pairFactsMap =
    useServerLookup(resolveFactsOfEntries, [pairProgressEntryIds]) ?? EMPTY_FACTS_OF_MAP;
  const progressPairFacts = useMemo(() => {
    const out = new Map<string, FactId[]>();
    for (const row of visiblePairProgressRows) {
      const [a, b] = pairEntries(row.key);
      const af = pairFactsMap[a as unknown as string] ?? [];
      const bf = pairFactsMap[b as unknown as string] ?? [];
      out.set(row.key, [...new Set([...af, ...bf])]);
    }
    return out;
  }, [visiblePairProgressRows, pairFactsMap]);

  const progressPairRuns = useMemo(() => {
    const out = new Map<string, boolean[]>();
    for (const row of visiblePairProgressRows) {
      const runs = allProgressPairRuns.get(row.key) ?? clearedProgressPairs.get(row.key)?.runs;
      if (runs) out.set(row.key, runs);
    }
    return out;
  }, [visiblePairProgressRows, allProgressPairRuns, clearedProgressPairs]);

  const hasAnyProgress = visiblePairProgressRows.length > 0 || factProgressRows.length > 0;

  const toggleProgressPair = (key: string) => {
    const pairFacts = progressPairFacts.get(key) ?? [];
    if (!pairFacts.length) return;
    setSelectedProgress((prev) => {
      const next = new Set(prev);
      const allOn = pairFacts.every((fact) => next.has(fact));
      for (const fact of pairFacts) {
        if (allOn) next.delete(fact);
        else next.add(fact);
      }
      return next;
    });
  };

  const isProgressPairSelected = (key: string): boolean => {
    const pairFacts = progressPairFacts.get(key) ?? [];
    return pairFacts.length > 0 && pairFacts.every((fact) => selectedProgress.has(fact));
  };

  const toggleProgressFact = (fact: FactId) => {
    setSelectedProgress((prev) => {
      const next = new Set(prev);
      if (!next.delete(fact)) next.add(fact);
      return next;
    });
  };

  return (
    <>
      <PageTitle
        title="Results"
        sub={`${modeName(results.mode)}${results.redrill ? " (redrill)" : ""} · ${
          facts.questionsTotal
        } questions · ${when}${summaryOnly ? " · Older session, summary only" : ""}`}
      />

      <ResultsCard
        pct={facts.pct}
        headline={summary.headline}
        detail={summary.detail}
        counts={summary.counts}
        trailing={
          <Btn
            className="disabled:cursor-default disabled:opacity-45"
            disabled={savedAsList}
            onClick={() => void saveAsList()}
          >
            {savedAsList ? "Saved as a list" : "Save as a list"}
          </Btn>
        }
      />

      <PatternSection
        label="Patterns"
        rows={analysis.patterns}
        stats={stats}
        graduateRuns={graduateRuns}
        worstKey={worstKey}
      />
      {hasAnyProgress ? <Lbl>Making progress</Lbl> : null}
      {hasAnyProgress ? (
        <div className="mb-3.5 flex flex-col gap-1.5">
          <PatternSection
            label="Progress"
            rows={visiblePairProgressRows}
            stats={stats}
            graduateRuns={graduateRuns}
            worstKey={worstKey}
            onClear={clearNow}
            showLabel={false}
            showContainer={false}
            isSelected={isProgressPairSelected}
            onToggle={toggleProgressPair}
            runsByKey={progressPairRuns}
            isCleared={(key) => clearedProgressPairs.has(key)}
          />
          <FactProgressSection
            rows={factProgressRows}
            onClear={clearFactNow}
            isCleared={(fact) => clearedProgressFacts.has(fact)}
            showLabel={false}
            showContainer={false}
            isSelected={(fact) => selectedProgress.has(fact)}
            onToggle={toggleProgressFact}
          />
        </div>
      ) : null}

      <TriageSection
        facts={triageRun}
        stats={stats}
        weakest={weakest}
        extraSelectedFacts={selectedProgress}
        // All three of these re-run in the SESSION's mode (results.mode), never
        // the current Practice/Home builder's. The builder can drift after a run
        // finishes (Match pairs, Endless, ...), and a mode the material has no
        // card for produces a 0-question run whose empty record then makes the
        // button do nothing. Passing results.mode pins each re-run to the drill
        // it came from, so a drifted builder cannot corrupt it. Redrill already
        // forces full coverage (forceCoverage in beginLeg), so it needs no
        // coverage flag; Rerun and Drill weakest ask coverage explicitly so each
        // is a finite pass over its set.
        onRedrill={(picked) =>
          void startFacts(picked, "The misses", {
            redrill: true,
            mode: results.mode,
          })
        }
        canRerun={rerunFacts.length > 0}
        onRerun={() =>
          void startFacts(rerunFacts, "That session", {
            mode: results.mode,
            coverage: true,
          })
        }
        onDrillWeakest={() =>
          void startFacts(weakest, "The weakest", {
            mode: results.mode,
            coverage: true,
          })
        }
      />
    </>
  );
}
