"use server";

// What the Observatory can do to the learner's history, as server actions
// the route hands to the page. Dev-only, like the adapters beside it.

import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { factInfo } from "@/lib/facts";
import { statForShowing, resolveShowing } from "@/lib/drill-stats";
import { dropClaims, saveClaims, saveSession, saveSeen } from "@/lib/history";
import { buildSessionRecord } from "@/lib/session-record";
import type { QuizAnswer } from "@/sky/lib/quiz";
import type { FactId, SessionStats } from "@/types";
import type { AtlasEntry, AtlasSearchResult, AtlasSection } from "@/sky/components/sky-atlas";
import type { Standing } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

import { atlasEntryFromHistory, atlasSearchFromHistory, atlasSectionsFromHistory, atlasTilesFromHistory, learnerHistory } from "./atlas";
import { pickFacts } from "./observatory";
import { practicePreview } from "./practice";
import type { PracticeMisses, PracticePreview, Recipe } from "@/sky/lib/practice";
import { sampleHistory } from "./sample-learner";

/** "I already know these": claim the picks, the app's own claim (a skip of
 * the lesson, untested; never mastery, and a later miss outranks it). Each
 * pick claims only itself. */
/** A star opened in a lesson enters rotation now (Sam, 2026-09-06): its
 * facts are marked seen, which is what the schedule reads, and the Sky
 * shows it as untested until its first quiz. Never a claim. */
export async function markSeen(id: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const facts = pickFacts([id.replace(/^page:/, "")]);
  if (!facts.length) return;
  await saveSeen(userId, facts, Date.now());
  revalidatePath("/dev/sky/planetarium");
  revalidatePath("/dev/sky/observatory");
  revalidatePath("/dev/sky/atlas");
}

export async function claimPicks(ids: readonly string[]): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const facts = pickFacts(ids);
  if (facts.length === 0) return;
  await saveClaims(userId, facts, Date.now());
  revalidatePath("/dev/sky/observatory");
  revalidatePath("/dev/sky/planetarium");
  revalidatePath("/dev/sky/atlas");
}

/** "I don't know this": the mirror of a claim, the app's own withdrawal.
 * The picks' facts go back to brand new (claim and quiz record both), the
 * way the Library's "Mark as not known" does. */
export async function unclaimPicks(ids: readonly string[]): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const facts = pickFacts(ids);
  if (facts.length === 0) return;
  await dropClaims(userId, facts);
  revalidatePath("/dev/sky/observatory");
  revalidatePath("/dev/sky/planetarium");
  revalidatePath("/dev/sky/atlas");
}

/** The Atlas's search, over the app's own index, on the learner's history
 * (or the pretend learner's, when the page shows the sample). Bound to
 * `sample` by the route, so the page calls it with the query alone. */
export async function atlasSearch(sample: boolean, query: string): Promise<AtlasSearchResult> {
  const history = sample ? sampleHistory() : await learnerHistory();
  return atlasSearchFromHistory(history, query);
}

/** One Atlas entry, opened: the card's teaching and what relates to it. */
export async function atlasEntry(sample: boolean, id: string): Promise<AtlasEntry> {
  const history = sample ? sampleHistory() : await learnerHistory();
  const entry = atlasEntryFromHistory(history, id);
  if (!entry) throw new Error(`No Atlas entry: ${id}`);
  return entry;
}

/** The Quiz's answers, recorded as one session against the schedule, the
 * app's own way (a session record folded into the fact aggregates). The
 * three grades map onto the model's two: perfect is a hit; with help is
 * right but not a first-try hit; missed is a miss. A grade-aware interval
 * treatment (SAK-317) waits on the scoring model itself. */
export async function recordQuiz(answers: readonly QuizAnswer[]): Promise<void> {
  const userId = await currentUserId();
  if (!userId || answers.length === 0) return;
  const stats: SessionStats = {};
  for (const a of answers) {
    // a card with no fact behind it (a retry of something the data no longer has)
    if (!factInfo(a.cardId as FactId)) continue;
    const st = statForShowing(stats, a.cardId as FactId);
    const ok = a.grade !== "missed";
    const credit = a.grade === "clean";
    resolveShowing(st, credit, ok, { dir: "jp2en", mode: a.narrowed ? "mc" : "typed", listen: false });
    if (!ok || a.tries > 1) st.misses += Math.max(1, a.tries - (ok ? 1 : 0));
  }
  const record = buildSessionRecord(stats, { mode: "drill", redrill: false, ts: Date.now(), planned: answers.map((a) => a.cardId as FactId) });
  if (!record) return;
  await saveSession(userId, record);
  revalidatePath("/dev/sky/planetarium");
  revalidatePath("/dev/sky/atlas");
  revalidatePath("/dev/sky/quiz");
}

/** A streamed shelf's tiles, for the ids of a cut that scrolled near. */
export async function atlasTiles(sample: boolean, ids: readonly string[]): Promise<SkyItem[]> {
  return atlasTilesFromHistory(sample ? sampleHistory() : await learnerHistory(), ids);
}

/** A streamed shelf's cuts, kept to one standing. */
export async function atlasSections(sample: boolean, shelfId: string, status: Standing): Promise<AtlasSection[]> {
  return atlasSectionsFromHistory(sample ? sampleHistory() : await learnerHistory(), shelfId, status);
}

/** Practice's live preview: the recipe resolved against the learner (or the
 * pretend one). Reads only; practice never writes the schedule. */
export async function practiceLookup(sample: boolean, recipe: Recipe, misses: PracticeMisses): Promise<PracticePreview> {
  return practicePreview(sample ? sampleHistory() : await learnerHistory(), recipe, misses);
}
