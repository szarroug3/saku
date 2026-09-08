// Tonight's lesson, from the app's tables. Server-side and dev-only, like
// the adapters beside it: the items come from the same build the
// Observatory uses (so a pick is the same thing here), what each star
// teaches comes from ./teach, and the pages behind the stars (a track's
// intro, a term, a sound shift) from the app's own lesson walk. Those
// pages, with the stars already in the sky, are the order's references.

import { COUNTER_CURRICULUM, counterEntry } from "@/data/counters";
import { patternEntry } from "@/data/grammar";
import { KEIGO_SETS, keigoSetEntry } from "@/data/keigo";
import { VERB_PAIRS } from "@/data/transitivity";
import { pairEntry } from "@/data/transitivity-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { TERMS, termEntry } from "@/data/terms";
import { TSU_INTRO } from "@/data/track-intros";
import { currentUserId } from "@/lib/auth";
import { emptyHistory } from "@/lib/history-ops";
import { loadHistory } from "@/lib/history";
import { entryForGlyph, knownFactsOf, libEntry, LIB_ENTRIES_BY_KIND, SENTENCE_RULE_KIND } from "@/lib/library/entries";
import { lessonSteps as appLessonSteps } from "@/lib/lesson-steps";
import type { SkyLessonData } from "@/sky/components/sky-lesson";
import { buildGraph } from "@/sky/lib/graph";
import { lessonReferences, lessonSteps, type LessonPage, type LessonTeach } from "@/sky/lib/lesson";
import type { SkyItem } from "@/sky/lib/types";
import type { HistoryFile } from "@/types";

import { offerings, TSU_RULE, type Offerings } from "./observatory";
import { pageFromIntro, teachFor } from "./teach";

/** One of everything, for a look at every kind of card: a plain kana row,
 * the row with ん (a heads up), a word with a piece and a kanji under it,
 * a glyph that is a piece, a kanji and a word, a counter, a grammar rule,
 * a sentence rule, a verb pair and a keigo set. Built on an empty history,
 * so all of it is new. */
export function showcasePicks(): string[] {
  const word = (keb: string) => entryForGlyph(VOCAB_SUBJECT, keb);
  const sentenceRule = LIB_ENTRIES_BY_KIND.get(SENTENCE_RULE_KIND)?.[0]?.id;
  return [
    "kana-row:h-vowels",
    "kana-row:h-w",
    word("花火"), word("山"),
    counterEntry(COUNTER_CURRICULUM[0]),
    patternEntry("te-sequence"),
    sentenceRule,
    pairEntry(VERB_PAIRS[0]),
    keigoSetEntry(KEIGO_SETS[0]),
  ].filter((id): id is string => !!id);
}

/** The signed-in learner's lesson for these picks, or a visitor's. */
export async function learnerLesson(picks: readonly string[], now = Date.now()): Promise<SkyLessonData> {
  const userId = await currentUserId();
  const history = userId ? await loadHistory(userId) : emptyHistory();
  return lessonFromPicks(history, picks, now);
}

export function lessonFromPicks(history: HistoryFile, picks: readonly string[], now = Date.now()): SkyLessonData {
  const offer = offerings(history, now);
  // every pick is built, whether or not its section had it on its first page
  const known = picks.filter((p) => !!offer.offerPick(p));
  const items = [...offer.items.values()];
  const byId = offer.items;
  const learned = [...offer.learned];
  const graph = buildGraph(items);
  const learnedSet = offer.learned;
  // the card for every star tonight: the steps, the picks, and the known stars under them
  const teach: Record<string, LessonTeach> = {};
  const ids = new Set<string>();
  const stars = lessonSteps(graph, known, learnedSet);
  for (const s of stars) ids.add(s.id);
  for (const p of known) for (const id of graph.orderOf(p)) ids.add(id);
  // the pages, per pick: the app's walk branches on what a teach set is
  // (a counter unit, a grammar sitting), so each pick gets its own walk;
  // a page two picks would both open with is read once, at its first use.
  // The walk also says which reading of a word tonight teaches.
  const seen = new Set<string>();
  const readings = new Map<string, string>();
  const pages = known
    .flatMap((pick) => walkFor(stars.filter((s) => s.pick === pick).map((s) => s.id), history, offer, readings))
    .filter((page) => { if (seen.has(page.item.id)) return false; seen.add(page.item.id); return true; });
  for (const id of ids) { const it = byId.get(id); if (it && !it.group) teach[id] = teachFor(it, { reading: readings.get(id) }); }
  // what tonight rests on and does not teach: the stars already in the sky
  // under tonight's picks, and the pages the walk put behind them
  const references = lessonReferences(graph, known, learnedSet, pages);
  return { items, learned, picks: known, teach, references };
}

/** The reading a lesson item teaches, from its facts: a qualified reading
 * fact (word:日/reading@にち) names it; a plain one is the word's first. */
function taughtReading(facts: readonly string[]): string | undefined {
  for (const f of facts) { const m = /\/reading@([^#]+)/.exec(f); if (m) return m[1]; }
  return undefined;
}

/** The pages the app's own lesson walk puts behind these stars (a track's
 * intro, the terms it defines, a sound shift), each attached to the star
 * that puts it in play, and each the thing it is about, shown with the same
 * card a star gets (Sam, 2026-09-05): a term is its Atlas entry, the 〜つ
 * intro is the 〜つ rule, a sound shift is the mark's page kept to that one
 * row. The walk reads history, so an intro already shown is not shown
 * again. `readings` collects which reading of a word the walk teaches.
 *
 * This is where the references come from (SAK-416). The walk already knows
 * which term or intro a star puts in play, so the list under the order is
 * derived from it rather than written out by hand; each page says in one
 * word which of the two it is. */
function walkFor(starIds: readonly string[], history: HistoryFile, offer: Offerings, readings: Map<string, string>): LessonPage[] {
  const facts = starIds.flatMap((id) => { const e = libEntry(id as Parameters<typeof libEntry>[0]); return e ? [...knownFactsOf(e)] : []; });
  const pages: LessonPage[] = [];
  let pending: Omit<LessonPage, "before">[] = [];
  const push = (kind: string, why: LessonPage["why"], item: SkyItem | undefined, teach?: LessonTeach) => { if (item) pending.push({ kind, why, item, teach: teach ?? teachFor(item) }); };
  // a page belongs to the first of OUR stars not yet passed, not to the
  // app's next item: a piece with no facts of its own (艹) is a star here
  // but never an item there, and a page must not land after it
  let cursor = 0;
  for (const step of appLessonSteps(facts, history)) {
    if (step.type === "item") {
      const reading = taughtReading(step.item.facts);
      if (reading) readings.set(step.item.entry, reading);
      const at = starIds.indexOf(step.item.entry);
      if (at < 0) continue;
      const before = starIds[Math.min(cursor, at)];
      for (const page of pending) pages.push({ ...page, before });
      pending = [];
      cursor = at + 1;
    } else if (step.type === "intro") {
      if (step.intro.id === TSU_INTRO.id) { push("Counting rule", "intro", offer.offerPick(TSU_RULE)); continue; }
      // an intro with no entry of its own is a page to read, named the way
      // the app's own rail names it: a short name, else the eyebrow
      const name = step.intro.name ?? step.intro.eyebrow ?? step.intro.title;
      push("Intro", "intro", { id: `page:${step.intro.id}`, kind: "term", glyph: name, english: name, standing: "not-seen" }, { pages: [pageFromIntro(step.intro)] });
    } else if (step.type === "term") {
      push("Term", "term", offer.offerPick(step.entry));
    } else if (step.type === "conversion") {
      // the mark's own page, kept to the one conversion being taught
      const term = TERMS.find((t) => t.name === (step.row.mark === "゜" ? "Handakuten" : "Dakuten"));
      const item = term ? offer.offerPick(termEntry(term.id)) : undefined;
      if (!item) continue;
      const whole = teachFor(item);
      const title = `${step.row.from} to ${step.row.to}`;
      push("Sound shift", "term", item, { ...whole, pages: whole.pages?.map((pg) => ({ ...pg, tables: pg.tables?.filter((t) => t.title === title) })) });
    }
  }
  return pages;
}
