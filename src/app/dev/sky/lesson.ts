// Tonight's lesson, from the app's tables. Server-side and dev-only, like
// the adapters beside it: the items come from the same build the
// Observatory uses (so a pick is the same thing here), what each star
// teaches comes from ./teach, and the pages between the stars (a track's
// intro, a term, a sound shift) from the app's own lesson walk.

import { COUNTER_CURRICULUM, counterEntry } from "@/data/counters";
import { patternEntry } from "@/data/grammar";
import { KEIGO_SETS, keigoSetEntry } from "@/data/keigo";
import { VERB_PAIRS } from "@/data/transitivity";
import { pairEntry } from "@/data/transitivity-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { TERMS, termEntry } from "@/data/terms";
import { currentUserId } from "@/lib/auth";
import { emptyHistory } from "@/lib/history-ops";
import { loadHistory } from "@/lib/history";
import { entryForGlyph, knownFactsOf, libEntry, LIB_ENTRIES_BY_KIND, SENTENCE_RULE_KIND } from "@/lib/library/entries";
import { lessonSteps as appLessonSteps } from "@/lib/lesson-steps";
import type { SkyLessonData } from "@/sky/components/sky-lesson";
import { buildGraph } from "@/sky/lib/graph";
import { lessonSteps, type LessonPage, type LessonTeach } from "@/sky/lib/lesson";
import type { HistoryFile } from "@/types";

import { offerings } from "./observatory";
import { paragraphs, teachFor } from "./teach";

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
  for (const id of ids) { const it = byId.get(id); if (it && !it.group) teach[id] = teachFor(it); }
  // the pages, per pick: the app's walk branches on what a teach set is
  // (a counter unit, a grammar sitting), so each pick gets its own walk;
  // a page two picks would both open with is read once, at its first use
  const seen = new Set<string>();
  const pages = known
    .flatMap((pick) => pagesFor(stars.filter((s) => s.pick === pick).map((s) => s.id), history))
    .filter((page) => { const key = `${page.kind}:${page.page.title}`; if (seen.has(key)) return false; seen.add(key); return true; });
  return { items, learned, picks: known, teach, pages };
}

/** The pages the app's own lesson walk puts between these stars (a track's
 * intro, the terms it defines, a sound shift), each attached to the star it
 * comes before. The walk reads history, so an intro already shown is not
 * shown again. */
function pagesFor(starIds: readonly string[], history: HistoryFile): LessonPage[] {
  const facts = starIds.flatMap((id) => { const e = libEntry(id as Parameters<typeof libEntry>[0]); return e ? [...knownFactsOf(e)] : []; });
  const pages: LessonPage[] = [];
  let pending: Omit<LessonPage, "before">[] = [];
  // pages go before the first of OUR stars not yet passed, not before the
  // app's next item: a piece with no facts of its own (艹) is a star here
  // but never an item there, and a page must not land after it
  let cursor = 0;
  for (const step of appLessonSteps(facts, history)) {
    if (step.type === "item") {
      const at = starIds.indexOf(step.item.entry);
      if (at < 0) continue;
      const before = starIds[Math.min(cursor, at)];
      for (const page of pending) pages.push({ ...page, before });
      pending = [];
      cursor = at + 1;
    } else if (step.type === "intro") {
      // named the way the app's own rail names it: a short name, else the eyebrow
      const title = step.intro.name ?? step.intro.eyebrow ?? step.intro.title;
      pending.push({ kind: "Intro", page: { title, ...(title === step.intro.title ? {} : { lead: step.intro.title }), paragraphs: paragraphs(step.intro.body) } });
    } else if (step.type === "term") {
      const term = TERMS.find((t) => termEntry(t.id) === step.entry);
      if (term) pending.push({ kind: "Term", page: { title: term.name, lead: term.summary, paragraphs: term.body.map((text) => ({ text })) } });
    } else if (step.type === "conversion") {
      pending.push({ kind: "Sound shift", page: { title: `${step.row.from} to ${step.row.to}`, paragraphs: [{ text: step.row.hook }] } });
    }
  }
  return pages;
}
