"use server";

// The Sky's server actions: every read the pages make, on whoever's
// history the caller names (see who.ts), and the two computations a write
// needs (a quiz's session records, a pick's facts). The writes themselves
// happen on the client through the app's own progress calls, which land
// on the account when signed in and in the browser when not, so a visitor's
// sky is kept and carried up on sign-in. Dev-only, like the adapters.
//
// WHO THE CALLER SAYS THEY ARE IS NOT WHO THEY ARE (SAK-445). The `Who` an
// action is handed is a POST body, so every read here starts by putting it
// through `trustedWho`, which drops a claim to be the pretend learner unless
// the dev surfaces are on. The reads below take `TrustedWho` and nothing
// else, so an action that forgot the check would not compile.

import { timedSync } from "@/lib/server-timing";
import { currentUserId } from "@/lib/auth";
import { factInfo } from "@/lib/facts";
import { getStatsRows } from "@/lib/library/stats-rows";
import { isSentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { statForShowing, resolveShowing } from "@/lib/drill-stats";
import { buildSessionRecord } from "@/lib/session-record";
import { loadSettings } from "@/lib/settings";
import { readSessionRow, writeSessionRow } from "@/lib/store/supabase-store";
import { shuffleDeck, type QuizAnswer, type QuizCard } from "@/sky/lib/quiz";
import { readRun, type SavedRun } from "@/sky/lib/quiz-run";
import type { FactId } from "@/types/facts";
import type { SessionStats } from "@/types/sky";
import type { HistoryFile, QuizSessionRecord } from "@/types/store";
import type { AtlasEntry, AtlasSearchResult, AtlasSection } from "@/sky/components/sky-atlas";
import type { SkyPayload } from "./sky-payload";
import type { SkyLessonData } from "@/sky/components/sky-lesson";
import type { SkyObservatoryData } from "@/sky/components/sky-observatory";
import type { PracticePreview, Recipe } from "@/sky/lib/practice";
import type { SkySession } from "@/sky/lib/sessions";
import type { Standing } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

import { atlasEntryFromHistory, atlasSearchFromHistory, atlasSectionsFromHistory, atlasTilesFromHistory, learnerHistory } from "./atlas";
import { atlasPayloadFor } from "./atlas-catalogue";
import type { AtlasPayload } from "./atlas-payload";
import { trustedWho, type TrustedWho } from "./caller";
import { skyPayloadFor } from "./catalogue";
import { lessonFromPicks } from "./lesson";
import { beyondWords, observatoryFromHistory, pickFacts } from "./observatory";
import { practiceCards, practicePreview } from "./practice";
import { cardsFor, quizFromHistory, sampleCards } from "./quiz";
import { sessionsFromHistory } from "./sessions";
import type { Who } from "./who";

/** The history the trusted caller names: the sample's, the browser's, or the
 * account's.
 *
 * The pretend learner's module is loaded here, on the branch that wants it,
 * rather than imported at the top of this file: with the dev surfaces off that
 * branch is unreachable, so a production server never runs a line of it and
 * never builds the made-up history at all (SAK-445). */
async function historyFor(who: TrustedWho): Promise<HistoryFile> {
  if (who.sample) return (await import("./sample-learner")).sampleHistory();
  if (who.local) return who.local;
  return learnerHistory();
}

// ---------- reads ----------

/** The learner's sky as its difference from the catalogue (SAK-381): the
 * standings, the constellations and the panels, without the fifteen thousand
 * stars that are the same for everyone. The browser fetches those once from
 * /api/sky-catalogue and puts the two back together with `joinSky`. */
export async function loadSky(caller: Who, graduateRuns?: number): Promise<SkyPayload> {
  const who = trustedWho(caller);
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
async function graduateRunsFor(who: TrustedWho): Promise<number | undefined> {
  if (who.sample || who.local) return undefined;
  const userId = await currentUserId();
  if (!userId) return undefined;
  return (await loadSettings(userId)).cfg?.graduateRuns ?? undefined;
}

export async function loadObservatory(caller: Who): Promise<SkyObservatoryData> {
  return observatoryFromHistory(await historyFor(trustedWho(caller)));
}

export async function loadLesson(caller: Who, picks: readonly string[]): Promise<SkyLessonData> {
  return lessonFromPicks(await historyFor(trustedWho(caller)), picks);
}

/** The quiz's cards: the named ones (a retry), else the picks' (a lesson),
 * else what is due; the sample with no picks deals every kind. Which extra
 * cards the learner allows come from Settings when signed in, or from the
 * browser's config, handed in, when not. */
export async function loadQuiz(caller: Who, ask: { picks?: readonly string[]; cards?: readonly string[]; audio?: boolean; pitch?: boolean }): Promise<QuizCard[]> {
  const who = trustedWho(caller);
  const history = await historyFor(who);
  const picks = ask.picks ?? [];
  const named = ask.cards ?? [];
  // a retry, and "Run it again" from Sessions: dealt afresh, not re-asked
  // in the order they were recorded in (SAK-388)
  if (named.length) return shuffleDeck(cardsFor(history, named));
  if (who.sample && !picks.length) return sampleCards(history);
  const extras = await extrasFor(who, ask);
  return quizFromHistory(history, picks, Date.now(), extras);
}

/** The two extra kinds of card a deck may ask, whoever is asking: what the
 * caller handed in (the browser's own config), else the account's saved
 * Settings, else on. Both the lesson quiz and a practice deck read them the
 * same way (SAK-426). */
async function extrasFor(who: TrustedWho, ask: { audio?: boolean; pitch?: boolean }): Promise<{ audio: boolean; pitch: boolean }> {
  let { audio, pitch } = ask;
  if (!who.sample && !who.local && (audio === undefined || pitch === undefined)) {
    const userId = await currentUserId();
    const cfg = userId ? (await loadSettings(userId)).cfg : undefined;
    audio ??= cfg?.audioPrompts ?? true;
    pitch ??= cfg?.pitchQuestions ?? true;
  }
  return { audio: audio ?? true, pitch: pitch ?? true };
}

/** A practice deck's cards. The learner's audio and pitch settings reach it
 * the way the quiz's do, so a deck asks by ear and by pitch when Settings
 * say so (SAK-426). */
export async function loadPracticeCards(caller: Who, recipe: Recipe, ask: { audio?: boolean; pitch?: boolean } = {}): Promise<QuizCard[]> {
  const who = trustedWho(caller);
  const history = await historyFor(who);
  const extras = await extrasFor(who, ask);
  return timedSync("practice", () => practiceCards(history, recipe, Date.now(), extras), "dealing the deck");
}

/** Practice's live preview: the recipe resolved against the learner, whose
 * history is where the shakiest-first order comes from (SAK-441). */
export async function practiceLookup(caller: Who, recipe: Recipe): Promise<PracticePreview> {
  const history = await historyFor(trustedWho(caller));
  return timedSync("practice", () => practicePreview(history, recipe), "resolving the recipe");
}

/** The learner's Atlas as its difference from the catalogue (SAK-381): the
 * standings and the shelves' counts, without the 2,815 tiles and ten shelves
 * of sections that are the same for everyone. */
export async function loadAtlas(caller: Who): Promise<AtlasPayload> {
  const history = await historyFor(trustedWho(caller));
  return timedSync("atlas", () => atlasPayloadFor(history), "working out the atlas");
}

/** The Atlas's search, over the app's own index. */
export async function atlasSearch(caller: Who, query: string): Promise<AtlasSearchResult> {
  return atlasSearchFromHistory(await historyFor(trustedWho(caller)), query);
}

/** One Atlas entry, opened: the card's teaching and what relates to it. */
export async function atlasEntry(caller: Who, id: string): Promise<AtlasEntry> {
  const entry = atlasEntryFromHistory(await historyFor(trustedWho(caller)), id);
  if (!entry) throw new Error(`No Atlas entry: ${id}`);
  return entry;
}

/** A streamed shelf's tiles, for the ids of a cut that scrolled near. */
export async function atlasTiles(caller: Who, ids: readonly string[]): Promise<SkyItem[]> {
  return atlasTilesFromHistory(await historyFor(trustedWho(caller)), ids);
}

/** A streamed shelf's cuts, kept to one standing. */
export async function atlasSections(caller: Who, shelfId: string, status: Standing): Promise<AtlasSection[]> {
  return atlasSectionsFromHistory(await historyFor(trustedWho(caller)), shelfId, status);
}

/**
 * The run this learner left part way through, off their account (SAK-404).
 *
 * Null for anyone not signed in, and that is not a gap: a visitor's run is in
 * their browser, which the server cannot see, and the page reads it there.
 * Read on its own rather than with the seed row, since one page in the app
 * wants it.
 *
 * The stored value is whatever was last written, so it is read through the
 * Sky's own `readRun`: an envelope of an older shape, or a run whose every
 * card has since been answered, reads as no run at all.
 */
export async function loadQuizRun(): Promise<SavedRun | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  return readRun(await readSessionRow(userId));
}

/** The run as it stands, or null to clear it. A visitor never reaches here:
 * their run is written to their browser and nowhere else. Validated on the
 * way in as well as on the way out, so the column only ever holds a shape
 * this app can read back. */
export async function saveQuizRun(run: SavedRun | null): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await writeSessionRow(userId, run ? readRun(run) : null);
}

export async function loadSessions(caller: Who): Promise<SkySession[]> {
  const history = await historyFor(trustedWho(caller));
  return timedSync("sessions", () => sessionsFromHistory(history), "listing the sessions");
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
 * right but not a first-try hit; missed is a miss.
 *
 * A practice run comes through here too, and comes through unchanged
 * (SAK-441): `practice` only marks the records it makes, so Sessions can
 * name the row. What is counted, and what it does to the schedule, is the
 * same work by the same path. */
export async function quizRecords(answers: readonly QuizAnswer[], practice?: { name?: string }): Promise<QuizSessionRecord[]> {
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
  const from = practice ? { practice } : {};
  const drill = buildSessionRecord(stats, { mode: "drill", redrill: false, ts, planned: answers.filter((a) => !isSentenceTierMarkerFact(a.cardId as FactId)).map((a) => a.cardId.replace(/#listen$/, "") as FactId), ...from });
  const ordered = buildSessionRecord(assembly, { mode: "assembly", redrill: false, ts: ts + 1, planned: Object.keys(assembly) as FactId[], ...from });
  return [drill, ordered].filter((r): r is QuizSessionRecord => !!r);
}
