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
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { markEntry } from "@/data/marks";
import type { Claims } from "@/lib/claims";
import { KIND_LABEL } from "@/lib/library/kinds";
import {
  getStatsRows,
  type StatsRow,
  type StatsSubject,
} from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
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

/** A StatsSubject with its display label attached. The label is a plain
 * string lookup (SUBJECT_LABEL, no guarded dependency) so it stays a
 * client-side concern even though the subject's facts/entries themselves are
 * now fetched from getStatsRows (SAK-104) rather than walked at module scope
 * here. */
type Subject = StatsSubject & { label: string };

function withLabel(s: StatsSubject): Subject {
  return { ...s, label: SUBJECT_LABEL[s.id] ?? s.id };
}

const EMPTY_ARGS: [] = [];

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

  // SAK-104: the ROWS structure — a static walk over the (now server-only)
  // fact registry — is fetched once via a Server Action instead of being
  // built at module scope. Every visitor gets the identical structure (see
  // getStatsRows's own header), so one fetch per mount, cached like
  // library-page.tsx's getLibraryShelves, is the whole cost.
  const statsData = useServerLookup(getStatsRows, EMPTY_ARGS);
  const rows = statsData?.rows ?? [];
  const sentenceTierCount = statsData?.sentenceTierCount ?? 0;

  return (
    <section>
      <Lbl>By subject</Lbl>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {!statsData ? (
            <tr>
              <td className="py-2 text-[13px] text-text-muted">Loading…</td>
            </tr>
          ) : (
            rows.map((row: StatsRow) =>
              row.kind === "subject" ? (
                <SubjectRow
                  key={row.subject.id}
                  subject={withLabel(row.subject)}
                  facts={facts}
                  claims={claims}
                  now={now}
                  onOpen={onOpen}
                />
              ) : (
                <GroupRow
                  key={row.label}
                  label={row.label}
                  subjects={row.children.map(withLabel)}
                  facts={facts}
                  claims={claims}
                  now={now}
                  onOpen={onOpen}
                />
              ),
            )
          )}
          {statsData ? (
            <SentenceSubjectRow
              learnedIds={learnedSentenceIds}
              total={sentenceTierCount}
              onOpen={onOpen}
            />
          ) : null}
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
  total,
  onOpen,
}: {
  learnedIds: string[];
  /** SENTENCE_ORDERING_TIERS.length — fetched via getStatsRows (SAK-104),
   * since data/assembly.ts is guarded (it imports lib/facts.ts). */
  total: number;
  onOpen?: (label: string, groups: { standing: Standing; entries: EntryId[] }[]) => void;
}) {
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
    (subject.entryFacts[e as unknown as string] ?? []).some((f) => facts[f]?.seen || claims[f]),
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
    (e) => subject.entryFacts[e as unknown as string] ?? [],
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
  const lookup: Record<string, readonly FactId[]> = {};
  for (const s of subjects) {
    for (const [e, fs] of Object.entries(s.entryFacts)) lookup[e] = fs;
  }
  const entries = subjects.flatMap((s) => metEntries(s, facts, claims));
  return groupEntriesByStanding(
    entries,
    (e) => lookup[e as unknown as string] ?? [],
    facts,
    claims,
    now,
  );
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
