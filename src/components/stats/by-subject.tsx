"use client";

// Where you are in each subject — four rows, and every number on them is a count
// of something you could point at.
//
// TWO QUESTIONS PER ROW, AND EACH ONE ANSWERED ONCE
// =================================================
//   the bar     how is my memory of what I've met, against what's out there? —
//               FACTS. A memory holds facts. 生 is not in one condition; its
//               nine readings are in nine. The untouched remainder is a fact
//               count too, drawn as track-toned rather than blank.
//   the number  how much of this subject have I met? — ENTRIES. You meet 生,
//               once. "70 of 2,136 kanji" is a sentence. "154 of 5,314 kanji"
//               is not: there are not 5,314 kanji, and nobody could name what
//               there are 5,314 of.
//
// THE BAR CARRIES COVERAGE ON PURPOSE, THE SMUDGE INCLUDED
// ==========================================================
// An earlier version of this bar drew only what you had MET, full width, and
// left coverage to the number beside it — because at the real library's scale
// (2,136 kanji, 8,045 words) a typical learner is ~3% covered, and scaling the
// bar against the full total turned every colour in it into what that version's
// comment called a "two-pixel smudge": three of four rows would have rendered
// as empty track.
//
// Sam's call (owner's intent) is that the smudge IS the honest answer, not a
// bug to hide: a mostly-empty bar with a sliver of colour at low coverage is
// what "you've barely started" looks like, and a scannable "what's left" signal
// next to a subject you've barely touched is worth more than a bar that always
// reads full. So the bar is drawn against the SUBJECT'S WHOLE FACT COUNT —
// `tallyFacts` is already called with every fact in the subject, met or not —
// and the untouched remainder gets its own segment: track-toned, never a status
// colour, so it never reads as a sixth condition of memory. See tally.ts's
// `barSegments`. Do not add a minimum-segment-width floor to make small slivers
// more visible; a bar that lies about a 3%-covered subject looking bigger than
// it is would defeat the reason this segment exists.
//
// AN ENTRY IS STILL NEVER GIVEN A STANDING. The alternative row was "生 is solid
// if all nine readings are", and it is the move this codebase has already
// deleted once, in decks.weakestEntries(). A min over nine predictions is an
// average with the arithmetic filed off, and it would put 生 in a bucket that no
// fact of 生 is in. `met` counts entries, and counting is all it does.

import { useState } from "react";

import { Lbl } from "@/components/ui";
import { EntryBreakdown } from "@/components/stats/entry-breakdown";
import { barSegments, groupEntriesByStanding, tallyFacts } from "@/components/stats/tally";
import type { Standing } from "@/lib/library/standing";
import { counterForm, isBareNumber } from "@/data/counters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { numberConstructionEntry } from "@/data/number-construction-id";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { KANA_SUBJECT } from "@/data/characters";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import type { Claims } from "@/lib/claims";
import { ALL_FACTS, entryOf, factInfo } from "@/lib/facts";
import { KIND_LABEL } from "@/lib/library/entries";
import { markEntry } from "@/lib/library/library-index";
import { factType } from "@/lib/practice-types";
import { learnedSentenceTierIds } from "@/lib/sentence-ordering-learned";
import type {

  EntryId,
  FactAggregate,
  FactId,
  HistoryFile,
} from "@/types";

/** What each subject is called. KIND_LABEL is the Library's, and reusing it is
 * the point: the Library and Progress calling the same shelf two things is a bug
 * nobody would file and everybody would feel. Grammar has no Library shelf yet,
 * so its word is added here rather than invented there. */
const SUBJECT_LABEL: Record<string, string> = {
  ...KIND_LABEL,
  [GRAMMAR_SUBJECT]: "Grammar",
  // Transitivity is a scheduled subject with no Library shelf, so it has no
  // KIND_LABEL entry and would otherwise fall back to its raw id ("transitivity")
  // here. "Verb pairs" is the app's word for it everywhere else — the session
  // header and the Home card both avoid the jargon — so Progress says the same.
  [TRANSITIVITY_SUBJECT]: "Verb pairs",
};

interface Subject {
  id: string;
  label: string;
  facts: FactId[];
  entries: EntryId[];
  /** entry → its facts, within this subject's own population only. Built once
   * per Subject (top-level or a split-off child/group member alike) rather
   * than read from one shared registry keyed by top-level subject id, which
   * is what let a synthetic subject (Hiragana, Numbers, …) compute `met` the
   * same way a real one does. */
  entryFacts: Map<EntryId, FactId[]>;
}

/** Build a Subject from any fact list — a real top-level subject (the SUBJECTS
 * walk below) or a slice carved out of one (Hiragana out of Kana, Numbers out
 * of Words' counting facts, …). The entry index is a groupBy over `facts`
 * alone, so it is exactly the population the row it renders is about. */
function buildSubject(id: string, label: string, facts: FactId[]): Subject {
  const entryFacts = new Map<EntryId, FactId[]>();
  for (const f of facts) {
    const e = entryOf(f);
    const list = entryFacts.get(e);
    if (list) list.push(f);
    else entryFacts.set(e, [f]);
  }
  return { id, label, facts, entries: [...entryFacts.keys()], entryFacts };
}

/** Every subject in the app, in data order, with its facts and its entries.
 *
 * Module scope, so the 21,753-fact walk happens once per page load rather than
 * once per render. It reads ALL_FACTS and factInfo — the registry — rather than
 * importing the four data modules directly, which is what keeps a fifth subject
 * from needing a line here: facts.ts's SUBJECTS list is already the contract. */
const SUBJECTS: Subject[] = (() => {
  const byId = new Map<string, FactId[]>();
  const order: string[] = [];
  for (const f of ALL_FACTS) {
    const id = factInfo(f)?.subject;
    if (!id) continue;
    let list = byId.get(id);
    if (!list) {
      list = [];
      byId.set(id, list);
      order.push(id);
    }
    list.push(f);
  }
  return order.map((id) => buildSubject(id, SUBJECT_LABEL[id] ?? id, byId.get(id)!));
})();

/** SAK-25: Radicals, Kanji, and Words nest under a "Vocabulary" parent row
 * rather than sitting as three flat siblings. The three are already separate
 * subjects (see SUBJECTS above) — this only changes how they're grouped for
 * display, not what's counted. */
const VOCABULARY_CHILD_IDS: readonly string[] = [
  RADICAL_SUBJECT,
  KANJI_SUBJECT,
  VOCAB_SUBJECT,
];

/** SAK-25: the two Counting synthetic subject ids, carved out of the Words
 * subject's own facts (see splitWordSubject). Neither is a real FactId
 * subject — COUNTER_FACTS and CONSTRUCTION_CATEGORY_FACTS both still carry
 * subject "word" (see src/data/counters.ts: the owner ruled counters "vocab
 * with a track label", not a seventh subject kind, and counters.test.ts
 * asserts COUNTERS_SUBJECT === VOCAB_SUBJECT — changing that would contradict
 * a standing design decision and break that assertion). So this ticket's
 * "own subject id" for Counting is a DISPLAY-layer id, in the same spirit as
 * practice-types.ts's factType() already splitting "word" into "word" and
 * "counter" for the Practice type chooser — this file reuses that exact
 * predicate and only adds the finer Numbers/Counters cut underneath it. */
const COUNTING_NUMBERS_ID = "counting-numbers";
const COUNTING_COUNTERS_ID = "counting-counters";

/** SAK-25: the two Kana synthetic subject ids, carved out of the Kana
 * subject's own facts by script (see splitKanaSubject). Reuses factType()'s
 * existing hiragana/katakana predicate rather than re-deriving it from
 * CHAR_INDEX, so this row can never disagree with the Practice type chooser
 * about which glyph is which script. */
const KANA_HIRAGANA_ID = "kana-hiragana";
const KANA_KATAKANA_ID = "kana-katakana";

/** The two bare-number generative categories ("Numbers 1-99", "Numbers
 * 100-9999") — the only construction categories with no counter attached.
 * Every other category (nin, hon, hiki, mai, ko, dai, satsu, hai, kai, sai)
 * is a real counter. See src/data/counter-categories.ts and
 * src/data/number-construction.ts (those two ids are the only ones built
 * with no `kind: CounterKind`). */
const NUMBER_CATEGORY_ENTRIES: ReadonlySet<EntryId> = new Set([
  numberConstructionEntry("tens"),
  numberConstructionEntry("big"),
]);

/** Within the "counter" practice type (factType()'s split of "word"): is this
 * entry a bare number (いち, にじゅう, …) rather than a counted form (三本) or a
 * per-counter category (〜本)? A memorised form asks counters.ts's own
 * isBareNumber; a generative category asks membership in the two bare-number
 * ranges above — every other category is a counter. */
function isCountingNumberEntry(entry: EntryId): boolean {
  if (NUMBER_CATEGORY_ENTRIES.has(entry)) return true;
  const form = counterForm(entry);
  return form !== undefined && isBareNumber(form);
}

/** Split the Words subject's own facts into the three Counting-era pieces:
 * plain vocabulary words, the Counting track's Numbers, and its Counters.
 * `factType` already answers "word" vs "counter" (practice-types.ts); this
 * only adds the Numbers/Counters cut underneath "counter". */
function splitWordSubject(
  subject: Subject,
): { words: Subject; numbers: Subject; counters: Subject } {
  const wordFacts: FactId[] = [];
  const numberFacts: FactId[] = [];
  const counterFacts: FactId[] = [];
  for (const f of subject.facts) {
    if (factType(f) !== "counter") {
      wordFacts.push(f);
      continue;
    }
    (isCountingNumberEntry(entryOf(f)) ? numberFacts : counterFacts).push(f);
  }
  return {
    words: buildSubject(subject.id, subject.label, wordFacts),
    numbers: buildSubject(COUNTING_NUMBERS_ID, "Numbers", numberFacts),
    counters: buildSubject(COUNTING_COUNTERS_ID, "Counters", counterFacts),
  };
}

/** Split the Kana subject's own facts into Hiragana and Katakana, by
 * factType()'s existing script predicate — the same test that already drives
 * the Practice type chooser's Hiragana/Katakana chips. */
function splitKanaSubject(
  subject: Subject,
): { hiragana: Subject; katakana: Subject } {
  const hiraganaFacts = subject.facts.filter((f) => factType(f) === "hiragana");
  const katakanaFacts = subject.facts.filter((f) => factType(f) === "katakana");
  return {
    hiragana: buildSubject(KANA_HIRAGANA_ID, "Hiragana", hiraganaFacts),
    katakana: buildSubject(KANA_KATAKANA_ID, "Katakana", katakanaFacts),
  };
}

type Row =
  | { kind: "subject"; subject: Subject }
  | { kind: "group"; label: string; children: Subject[] };

/** SUBJECTS in render order, with Kana split into a Hiragana/Katakana group,
 * Radicals/Kanji/Words collected into a Vocabulary group, and the counting
 * facts carved out of Words into a Counting group placed right after it.
 * Everything else (Grammar, Verb pairs, Keigo) keeps its exact original row
 * and order. */
const ROWS: Row[] = (() => {
  const out: Row[] = [];
  let vocabularyChildren: Subject[] | null = null;
  for (const s of SUBJECTS) {
    if (s.id === KANA_SUBJECT) {
      const { hiragana, katakana } = splitKanaSubject(s);
      out.push({ kind: "group", label: "Kana", children: [hiragana, katakana] });
      continue;
    }
    if (s.id === VOCAB_SUBJECT) {
      const { words, numbers, counters } = splitWordSubject(s);
      if (!vocabularyChildren) {
        vocabularyChildren = [];
        out.push({ kind: "group", label: "Vocabulary", children: vocabularyChildren });
      }
      vocabularyChildren.push(words);
      out.push({ kind: "group", label: "Counting", children: [numbers, counters] });
      continue;
    }
    if (VOCABULARY_CHILD_IDS.includes(s.id)) {
      if (!vocabularyChildren) {
        vocabularyChildren = [];
        out.push({ kind: "group", label: "Vocabulary", children: vocabularyChildren });
      }
      vocabularyChildren.push(s);
      continue;
    }
    out.push({ kind: "subject", subject: s });
  }
  return out;
})();

export function BySubject({
  facts,
  claims,
  now,
  history,
}: {
  facts: Record<FactId, FactAggregate>;
  claims: Claims;
  now: number;
  history: HistoryFile;
}) {
  const learnedSentenceIds = learnedSentenceTierIds(history);
  // SAK-78 follow-up review: "these should be clickable to show the sidebar
  // too for their items." One panel for the whole table, same shape as
  // KnowledgeBase's single BucketBreakdown — only one row's breakdown can be
  // open at a time, so a shared { label, groups } slot is enough; no row
  // needs its own open/closed state.
  //
  // SAK-78 round 5: `entries` became `groups` — already grouped and BUCKETS-
  // ordered by `groupEntriesByStanding` (tally.ts), computed by SubjectRow/
  // GroupRow at click time from that row's own `metEntries` + entry→facts
  // scope, same as `entries` was before. EntryBreakdown only renders what
  // it's handed.
  const [open, setOpen] = useState<{
    label: string;
    groups: { standing: Standing; entries: EntryId[] }[];
  } | null>(null);
  const onOpen = (label: string, groups: { standing: Standing; entries: EntryId[] }[]) =>
    setOpen({ label, groups });
  return (
    <section>
      <Lbl>By subject</Lbl>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {ROWS.map((row) =>
            row.kind === "subject" ? (
              <SubjectRow
                key={row.subject.id}
                subject={row.subject}
                facts={facts}
                claims={claims}
                now={now}
                onOpen={onOpen}
              />
            ) : (
              <GroupRow
                key={row.label}
                label={row.label}
                subjects={row.children}
                facts={facts}
                claims={claims}
                now={now}
                onOpen={onOpen}
              />
            ),
          )}
          <SentenceSubjectRow learnedIds={learnedSentenceIds} onOpen={onOpen} />
        </tbody>
      </table>
      <EntryBreakdown
        open={open !== null}
        label={open?.label ?? ""}
        groups={open?.groups ?? []}
        onClose={() => setOpen(null)}
      />
    </section>
  );
}

/** SAK-78 round 6: "i have claimed a sentence lesson but it's not clickable
 * here." Root cause — this row never went through the Subject/`metEntries`
 * model every other row uses. Sentence-ordering tiers are the 10
 * SENTENCE_ORDERING_TIERS, not FactIds with a `subject` field, so they never
 * land in ALL_FACTS's walk that builds SUBJECTS (by-subject.tsx's own module
 * comment above). A tier is "learned" via `sentenceTierMarkerFact` — a
 * deliberately unregistered, non-drilled marker fact (see
 * sentence-ordering-progress.ts's own header: "not a registered quiz fact") —
 * checked either by an explicit claim or by at least one answered fact in an
 * assembly session (`sentenceTierDone`). Before this round the row was drawn
 * by hand from `learnedSentenceTierIds(history).length` alone, with no
 * `onOpen` ever wired in: not a guard that happened to always fail, an
 * `onClick` that was never written. That's why Sam's claimed tier didn't open
 * a panel — every other row's "0 has no button" guard was doing its job;
 * this row had no button to guard.
 *
 * THE FIX, AND ITS HONEST LIMIT. This row is now clickable exactly like every
 * other once `learnedIds` is non-empty, opening the same EntryBreakdown panel.
 * But it cannot reuse `metGroups`/`groupEntriesByStanding` — that machinery
 * asks `standingOf` a fact's `FactAggregate` (seen count, recall curve), and a
 * tier's marker fact carries neither: it is never scored, so there is no
 * solid/getting-there/shaky/slipping question to ask of it, only "done" or
 * not. Forcing it through the standing model would either crash (no
 * aggregate) or silently mislabel a session-completed tier as an untested
 * self-report. So a learned tier's group is a single, explicit `"claimed"`
 * bucket — the closest existing word for "the app has no decay/accuracy model
 * for this, only a completion record," not a claim that overrides a session
 * completion's actual (unmodelled) confidence. Flagged in this ticket's
 * Linear round-6 comment as the one subject kind that only approximately fits
 * this panel's status-grouped shape, rather than silently forcing a false
 * standing on it. */
function SentenceSubjectRow({
  learnedIds,
  onOpen,
}: {
  learnedIds: string[];
  onOpen?: (label: string, groups: { standing: Standing; entries: EntryId[] }[]) => void;
}) {
  const total = SENTENCE_ORDERING_TIERS.length;
  const learned = learnedIds.length;
  // A tier's Library page is a MARK entry, not `sentenceTierEntry`'s own id
  // (see entry-breakdown.tsx's file header for the full reasoning) — marks.ts
  // mints one sentence-rule mark per tier with the exact same id suffix
  // (SENTENCE_ORDERING_TIERS' "simple" <-> marks.ts's "sentence-rule-simple"),
  // so this is a re-mint, not a guess.
  const entries = learnedIds.map((id) => markEntry(`sentence-rule-${id}`));

  return (
    <tr>
      <th scope="row" className="py-2 pr-2 text-left font-normal">
        {learned > 0 && onOpen ? (
          <button
            type="button"
            data-testid="by-subject-met-sentences"
            onClick={() =>
              onOpen(`${learned.toLocaleString()} of ${total.toLocaleString()} Sentences`, [
                { standing: "claimed", entries },
              ])
            }
            className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-text"
          >
            Sentences
          </button>
        ) : (
          "Sentences"
        )}
      </th>
      <td className="w-[92px] py-2">
        <span
          aria-hidden="true"
          className="block h-1.5 overflow-hidden rounded-full bg-panel"
        >
          <span
            className="block h-full bg-accent"
            style={{ width: `${total > 0 ? (100 * learned) / total : 0}%` }}
          />
        </span>
      </td>
      <td className="w-[104px] whitespace-nowrap py-2 text-right tabular-nums text-text-muted">
        {learned.toLocaleString()} of {total.toLocaleString()}
      </td>
    </tr>
  );
}

/** Met: entries with any record behind them — one showing, or one claim. A
 * count, and the only thing about an entry this page asserts. It says nothing
 * about how the entry is GOING, which is the question an entry cannot answer.
 * Shared by SubjectRow and GroupRow so a parent row's "met" is the same
 * question asked over a bigger population, not a different one. Reads
 * `subject.entryFacts` directly (built alongside the subject itself, see
 * buildSubject) rather than a shared registry keyed by top-level subject id —
 * a split-off child (Hiragana, Numbers, …) is not in that registry, and
 * doesn't need to be.
 *
 * A thin wrapper over `metEntries` (SAK-78) — kept as its own function rather
 * than inlined as `metEntries(...).length` at every call site, because most
 * of this row's renders only need the count, not the array: the bar and the
 * "70 of 2,136" text run on every render, the actual list of which 70 is only
 * needed once, when a click opens the panel. */
function metCount(
  subject: Subject,
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
): number {
  return metEntries(subject, facts, claims).length;
}

/** The entries `metCount` is counting, not just their count (SAK-78: "these
 * should be clickable to show the sidebar too for their items"). Same
 * predicate as `metCount` — "any record behind them, showing or claimed" —
 * kept in exact lockstep with it (metCount calls this rather than
 * re-filtering) so the number a row prints and the list its panel opens can
 * never independently disagree, the same guarantee tally.ts's
 * `factsByStanding` gives knowledge-base.tsx's panel. */
function metEntries(
  subject: Subject,
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
): EntryId[] {
  return subject.entries.filter((e) =>
    (subject.entryFacts.get(e) ?? []).some((f) => facts[f]?.seen || claims[f]),
  );
}

/** `metEntries`'s output, grouped and ordered by status (SAK-78 round 5: "the
 * side panel should separate by status ... ordered ... claimed → solid →
 * …"). A thin wrapper over tally.ts's `groupEntriesByStanding`, handed
 * `subject.entryFacts` as the lookup so the grouping asks about the exact
 * same facts `metEntries` used to decide each entry was met — see that
 * function's header for why the lookup is scoped, not global. */
function metGroups(
  subject: Subject,
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
): { standing: Standing; entries: EntryId[] }[] {
  return groupEntriesByStanding(
    metEntries(subject, facts, claims),
    (e) => subject.entryFacts.get(e) ?? [],
    facts,
    claims,
    now,
  );
}

/** `metGroups`'s sibling for a GroupRow's aggregate panel — every child
 * subject's met entries, grouped by status over the UNION of the children's
 * `entryFacts` lookups. Safe for the same disjointness reason GroupRow's own
 * comment already gives for summing `met` across children: no entry belongs
 * to two subjects here, so merging their entryFacts maps can never let one
 * subject's lookup answer for another's entry. */
function metGroupsForSubjects(
  subjects: Subject[],
  facts: Record<FactId, FactAggregate>,
  claims: Claims,
  now: number,
): { standing: Standing; entries: EntryId[] }[] {
  const lookup = new Map<EntryId, FactId[]>();
  for (const s of subjects) {
    for (const [e, fs] of s.entryFacts) lookup.set(e, fs);
  }
  const entries = subjects.flatMap((s) => metEntries(s, facts, claims));
  return groupEntriesByStanding(entries, (e) => lookup.get(e) ?? [], facts, claims, now);
}

function SubjectRow({
  subject,
  facts,
  claims,
  now,
  indent = false,
  onOpen,
}: {
  subject: Subject;
  facts: Record<FactId, FactAggregate>;
  claims: Claims;
  now: number;
  /** SAK-25: true for any subject rendered as a group's child row (Vocabulary's
   * Radicals/Kanji/Words, Counting's Numbers/Counters, Kana's
   * Hiragana/Katakana) rather than as a flat top-level row. */
  indent?: boolean;
  /** SAK-78: opens the shared EntryBreakdown panel with this row's met
   * entries, grouped by status (round 5). Optional so SentenceSubjectRow (no
   * entries — sentences are tiers, not entries) never has to pretend it has
   * one. */
  onOpen?: (label: string, groups: { standing: Standing; entries: EntryId[] }[]) => void;
}) {
  const tally = tallyFacts(subject.facts, facts, claims, now);
  const met = metCount(subject, facts, claims);

  return (
    <tr>
      <th
        scope="row"
        className={`py-2 pr-2 text-left font-normal${indent ? " pl-4 text-text-muted" : ""}`}
      >
        {/* Clickable only once there's something to open — "0 of 2,136" has
         * no items behind it, and a panel that opened to say "Nothing here"
         * for a row that hasn't started would be a worse answer than no
         * button, same guard knowledge-base.tsx's buckets use. SAK-78 review:
         * the name is the click target, not the count beside it. */}
        {met > 0 && onOpen ? (
          <button
            type="button"
            data-testid={`by-subject-met-${subject.id}`}
            onClick={() =>
              onOpen(
                `${met.toLocaleString()} of ${subject.entries.length.toLocaleString()} ${subject.label}`,
                metGroups(subject, facts, claims, now),
              )
            }
            className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-text"
          >
            {subject.label}
          </button>
        ) : (
          subject.label
        )}
      </th>
      <td className="w-[92px] py-2">
        {/* `tally` here was built from the subject's WHOLE fact list (see
         * SUBJECTS above), so its own count is the total `barSegments` needs —
         * no separate total to thread through. The untouched segment is
         * transparent, so an unstarted subject renders as plain track, which
         * is the one case where "nothing here" is the whole answer. */}
        <span
          aria-hidden="true"
          className="flex h-1.5 overflow-hidden rounded-full bg-panel"
        >
          {barSegments(tally, subject.facts.length).map((seg) => (
            <span
              key={seg.bucket}
              className={`block h-full ${seg.fill}`}
              style={{ flex: seg.flex }}
            />
          ))}
        </span>
      </td>
      {/* nowrap: "0 of 2,136" broke across two lines on a 375px screen and read
       * as two numbers in a column of one-number cells. */}
      <td className="w-[104px] whitespace-nowrap py-2 text-right tabular-nums text-text-muted">
        {met.toLocaleString()} of {subject.entries.length.toLocaleString()}
      </td>
    </tr>
  );
}

/** SAK-25: a parent row over a group of child subjects — "Vocabulary" over
 * Radicals/Kanji/Words, "Counting" over Numbers/Counters, "Kana" over
 * Hiragana/Katakana — rendered as its own header row followed by the
 * children's indented rows (reusing SubjectRow as-is, just with `indent`).
 * One component for all three groups, so they read as the same pattern
 * because they ARE the same pattern, not three copies that could drift.
 *
 * The parent's own bar and count are an AGGREGATE, not a subject of its own:
 * its facts are the children's facts concatenated, so `tallyFacts` sees the
 * exact same population it would if asked to count them all at once, and its
 * `met` is the children's `met` summed — safe because every group here splits
 * one disjoint entry population (a radical, a kanji and a word are never the
 * same entry; a bare number and a counted form are never the same entry; a
 * hiragana and a katakana character are never the same entry), so no entry is
 * ever double-counted.
 *
 * ITS PANEL IS THE SAME UNION (SAK-78 follow-up review). Clicking the
 * parent's own met count opens `metEntries` run over every child and
 * concatenated — safe for the identical disjointness reason the summed `met`
 * above already relies on, so this is not a second argument, just the same
 * one applied to a list instead of a length. It's a FLAT union of child
 * SUBJECTS, not grouped by subject — see entry-breakdown.tsx's header comment
 * for why: it matches bucket-breakdown.tsx's panel, which never subdivides by
 * subject either, so both breakdown kinds on this page read as one pattern.
 * SAK-78 round 5 groups that union by STATUS instead (`metGroupsForSubjects`,
 * same disjointness argument extended to entryFacts lookups) — a different
 * axis from "by child subject", not a reversal of this call. */
function GroupRow({
  label,
  subjects,
  facts,
  claims,
  now,
  onOpen,
}: {
  label: string;
  subjects: Subject[];
  facts: Record<FactId, FactAggregate>;
  claims: Claims;
  now: number;
  onOpen?: (label: string, groups: { standing: Standing; entries: EntryId[] }[]) => void;
}) {
  const allFacts = subjects.flatMap((s) => s.facts);
  const tally = tallyFacts(allFacts, facts, claims, now);
  const met = subjects.reduce((n, s) => n + metCount(s, facts, claims), 0);
  const entryCount = subjects.reduce((n, s) => n + s.entries.length, 0);

  return (
    <>
      <tr>
        <th scope="row" className="py-2 pr-2 text-left font-normal">
          {/* SAK-78 review: the name is the click target, not the count
           * beside it — same guard as SubjectRow's. */}
          {met > 0 && onOpen ? (
            <button
              type="button"
              data-testid={`by-subject-met-group-${label}`}
              onClick={() =>
                onOpen(
                  `${met.toLocaleString()} of ${entryCount.toLocaleString()} ${label}`,
                  metGroupsForSubjects(subjects, facts, claims, now),
                )
              }
              className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-text"
            >
              {label}
            </button>
          ) : (
            label
          )}
        </th>
        <td className="w-[92px] py-2">
          <span
            aria-hidden="true"
            className="flex h-1.5 overflow-hidden rounded-full bg-panel"
          >
            {barSegments(tally, allFacts.length).map((seg) => (
              <span
                key={seg.bucket}
                className={`block h-full ${seg.fill}`}
                style={{ flex: seg.flex }}
              />
            ))}
          </span>
        </td>
        <td className="w-[104px] whitespace-nowrap py-2 text-right tabular-nums text-text-muted">
          {met.toLocaleString()} of {entryCount.toLocaleString()}
        </td>
      </tr>
      {subjects.map((s) => (
        <SubjectRow
          key={s.id}
          subject={s}
          facts={facts}
          claims={claims}
          now={now}
          indent
          onOpen={onOpen}
        />
      ))}
    </>
  );
}
