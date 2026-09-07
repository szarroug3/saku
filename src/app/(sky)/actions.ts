"use server";

// The Sky's server actions: every read the pages make, on whoever's
// history the caller names (see who.ts), and the two computations a write
// needs (a quiz's session records, a pick's facts). The writes themselves
// happen on the client through the app's own progress calls, which land
// on the account when signed in and in the browser when not, so a visitor's
// sky is kept and carried up on sign-in. Dev-only, like the adapters.

import { timedSync } from "@/lib/server-timing";
import { currentUserId } from "@/lib/auth";
import { factInfo } from "@/lib/facts";
import { getStatsRows } from "@/lib/library/server-lookups";
import { isSentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { statForShowing, resolveShowing } from "@/lib/drill-stats";
import { buildSessionRecord } from "@/lib/session-record";
import { loadSettings } from "@/lib/settings";
import { shuffleDeck, type QuizAnswer, type QuizCard } from "@/sky/lib/quiz";
import type { FactId, HistoryFile, QuizSessionRecord, SessionStats } from "@/types";
import type { AtlasEntry, AtlasSearchResult, AtlasSection } from "@/sky/components/sky-atlas";
import type { SkyPayload } from "./sky-payload";
import type { SkyLessonData } from "@/sky/components/sky-lesson";
import type { SkyObservatoryData } from "@/sky/components/sky-observatory";
import type { PracticeMisses, PracticePreview, Recipe } from "@/sky/lib/practice";
import type { SkySession } from "@/sky/lib/sessions";
import type { Standing } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

import { atlasEntryFromHistory, atlasSearchFromHistory, atlasSectionsFromHistory, atlasTilesFromHistory, learnerHistory } from "./atlas";
import { atlasPayloadFor } from "./atlas-catalogue";
import type { AtlasPayload } from "./atlas-payload";
import { skyPayloadFor } from "./catalogue";
import { lessonFromPicks } from "./lesson";
import { beyondWords, observatoryFromHistory, pickFacts } from "./observatory";
import { practiceCards, practicePreview } from "./practice";
import { cardsFor, quizFromHistory, sampleCards } from "./quiz";
import { sampleHistory } from "./sample-learner";
import { sessionsFromHistory } from "./sessions";
import type { Who } from "./who";

/** The history the caller names: the sample's, the browser's, or the account's. */
async function historyFor(who: Who): Promise<HistoryFile> {
  if (who.sample) return sampleHistory();
  if (who.local) return who.local;
  return learnerHistory();
}

// ---------- reads ----------

/** The learner's sky as its difference from the catalogue (SAK-381): the
 * standings, the constellations and the panels, without the fifteen thousand
 * stars that are the same for everyone. The browser fetches those once from
 * /api/sky-catalogue and puts the two back together with `joinSky`. */
export async function loadSky(who: Who, graduateRuns?: number): Promise<SkyPayload> {
  // The history and the settings at the same time (SAK-382). The page used to
  // read the settings, wait, and then call this, which read the history and
  // waited again: two round trips to the same database, queued, for two
  // answers that have nothing to say to each other. Measured on the deployed
  // app, the settings read alone was 336 ms of a 1328 ms home.
  const [history, runs] = await Promise.all([historyFor(who), graduateRuns ?? graduateRunsFor(who)]);
  const rows = await getStatsRows();
  return timedSync("sky", () => skyPayloadFor(history, undefined, rows, { everything: true, beyond: beyondWords, ...(runs ? { graduateRuns: runs } : {}) }), "working out the sky");
}

/** The learner's own bar for clearing a mix-up. Undefined for anyone whose
 * settings are the browser's, which is everyone not signed in. */
async function graduateRunsFor(who: Who): Promise<number | undefined> {
  if (who.sample || who.local) return undefined;
  const userId = await currentUserId();
  if (!userId) return undefined;
  return (await loadSettings(userId)).cfg?.graduateRuns ?? undefined;
}

export async function loadObservatory(who: Who): Promise<SkyObservatoryData> {
  return observatoryFromHistory(await historyFor(who));
}

export async function loadLesson(who: Who, picks: readonly string[]): Promise<SkyLessonData> {
  return lessonFromPicks(await historyFor(who), picks);
}

/** The quiz's cards: the named ones (a retry), else the picks' (a lesson),
 * else what is due; the sample with no picks deals every kind. Which extra
 * cards the learner allows come from Settings when signed in, or from the
 * browser's config, handed in, when not. */
export async function loadQuiz(who: Who, ask: { picks?: readonly string[]; cards?: readonly string[]; audio?: boolean; pitch?: boolean }): Promise<QuizCard[]> {
  const history = await historyFor(who);
  const picks = ask.picks ?? [];
  const named = ask.cards ?? [];
  // a retry, and "Run it again" from Sessions: dealt afresh, not re-asked
  // in the order they were recorded in (SAK-388)
  if (named.length) return shuffleDeck(cardsFor(history, named));
  if (who.sample && !picks.length) return sampleCards(history);
  let { audio, pitch } = ask;
  if (!who.sample && !who.local && (audio === undefined || pitch === undefined)) {
    const userId = await currentUserId();
    const cfg = userId ? (await loadSettings(userId)).cfg : undefined;
    audio ??= cfg?.audioPrompts ?? true;
    pitch ??= cfg?.pitchQuestions ?? true;
  }
  return quizFromHistory(history, picks, Date.now(), { audio: audio ?? true, pitch: pitch ?? true });
}

export async function loadPracticeCards(who: Who, recipe: Recipe): Promise<QuizCard[]> {
  const history = await historyFor(who);
  return timedSync("practice", () => practiceCards(history, recipe, {}), "dealing the deck");
}

/** Practice's live preview: the recipe resolved against the learner. Reads
 * only; practice never writes the schedule. */
export async function practiceLookup(who: Who, recipe: Recipe, misses: PracticeMisses): Promise<PracticePreview> {
  const history = await historyFor(who);
  return timedSync("practice", () => practicePreview(history, recipe, misses), "resolving the recipe");
}

/** The learner's Atlas as its difference from the catalogue (SAK-381): the
 * standings and the shelves' counts, without the 2,815 tiles and ten shelves
 * of sections that are the same for everyone. */
export async function loadAtlas(who: Who): Promise<AtlasPayload> {
  const history = await historyFor(who);
  return timedSync("atlas", () => atlasPayloadFor(history), "working out the atlas");
}

/** The Atlas's search, over the app's own index. */
export async function atlasSearch(who: Who, query: string): Promise<AtlasSearchResult> {
  return atlasSearchFromHistory(await historyFor(who), query);
}

/** One Atlas entry, opened: the card's teaching and what relates to it. */
export async function atlasEntry(who: Who, id: string): Promise<AtlasEntry> {
  const entry = atlasEntryFromHistory(await historyFor(who), id);
  if (!entry) throw new Error(`No Atlas entry: ${id}`);
  return entry;
}

/** A streamed shelf's tiles, for the ids of a cut that scrolled near. */
export async function atlasTiles(who: Who, ids: readonly string[]): Promise<SkyItem[]> {
  return atlasTilesFromHistory(await historyFor(who), ids);
}

/** A streamed shelf's cuts, kept to one standing. */
export async function atlasSections(who: Who, shelfId: string, status: Standing): Promise<AtlasSection[]> {
  return atlasSectionsFromHistory(await historyFor(who), shelfId, status);
}

export async function loadSessions(who: Who): Promise<SkySession[]> {
  return sessionsFromHistory(await historyFor(who));
}

// ---------- what a write needs ----------

/** The facts behind some picks (a kana row's sounds, a star's own), for a
 * claim, a withdrawal, or a lesson's "seen". */
export async function factsOfPicks(ids: readonly string[]): Promise<FactId[]> {
  return pickFacts(ids.map((id) => id.replace(/^page:/, "")));
}

/** The Quiz's answers as session records, the app's own way: a drill
 * session of the cards' facts (a listening card is its fact, asked by
 * ear) and, when ordering cards were answered, an assembly session of
 * their sentences' pattern facts, which is what marks a tier done. The
 * three grades map onto the model's two: perfect is a hit; with help is
 * right but not a first-try hit; missed is a miss. */
export async function quizRecords(answers: readonly QuizAnswer[]): Promise<QuizSessionRecord[]> {
  if (answers.length === 0) return [];
  const stats: SessionStats = {};
  const assembly: SessionStats = {};
  for (const a of answers) {
    if (isSentenceTierMarkerFact(a.cardId as FactId)) {
      for (const f of (a.meta?.facts ?? "").split("|").filter(Boolean) as FactId[]) {
        const st = statForShowing(assembly, f);
        const ok = a.grade !== "missed";
        resolveShowing(st, a.grade === "clean", ok, { dir: "jp2en", mode: "typed", listen: false });
        if (!ok || a.tries > 1) st.misses += Math.max(1, a.tries - (ok ? 1 : 0));
      }
      continue;
    }
    const fact = a.cardId.replace(/#listen$/, "") as FactId;
    // a card with no fact behind it (a retry of something the data no longer has)
    if (!factInfo(fact)) continue;
    const st = statForShowing(stats, fact);
    const ok = a.grade !== "missed";
    resolveShowing(st, a.grade === "clean", ok, { dir: "jp2en", mode: a.narrowed ? "mc" : "typed", listen: a.cardId.endsWith("#listen") });
    if (!ok || a.tries > 1) st.misses += Math.max(1, a.tries - (ok ? 1 : 0));
  }
  const ts = Date.now();
  const drill = buildSessionRecord(stats, { mode: "drill", redrill: false, ts, planned: answers.filter((a) => !isSentenceTierMarkerFact(a.cardId as FactId)).map((a) => a.cardId.replace(/#listen$/, "") as FactId) });
  const ordered = buildSessionRecord(assembly, { mode: "assembly", redrill: false, ts: ts + 1, planned: Object.keys(assembly) as FactId[] });
  return [drill, ordered].filter((r): r is QuizSessionRecord => !!r);
}
