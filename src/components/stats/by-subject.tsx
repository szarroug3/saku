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

import { Lbl } from "@/components/ui";
import { barSegments, tallyFacts } from "@/components/stats/tally";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import type { Claims } from "@/lib/claims";
import { ALL_FACTS, entryOf, factInfo } from "@/lib/facts";
import { KIND_LABEL } from "@/lib/library/entries";
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
}

/** Every subject in the app, in data order, with its facts and its entries.
 *
 * Module scope, so the 21,753-fact walk happens once per page load rather than
 * once per render. It reads ALL_FACTS and factInfo — the registry — rather than
 * importing the four data modules directly, which is what keeps a fifth subject
 * from needing a line here: facts.ts's SUBJECTS list is already the contract. */
const SUBJECTS: Subject[] = (() => {
  const out: Subject[] = [];
  const byId = new Map<string, Subject>();
  for (const f of ALL_FACTS) {
    const id = factInfo(f)?.subject;
    if (!id) continue;
    let s = byId.get(id);
    if (!s) {
      s = { id, label: SUBJECT_LABEL[id] ?? id, facts: [], entries: [] };
      byId.set(id, s);
      out.push(s);
    }
    s.facts.push(f);
  }
  for (const s of out) s.entries = [...new Set(s.facts.map(entryOf))];
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
  const learnedSentenceCount = learnedSentenceTierIds(history).length;
  return (
    <section>
      <Lbl>By subject</Lbl>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {SUBJECTS.map((s) => (
            <SubjectRow
              key={s.id}
              subject={s}
              facts={facts}
              claims={claims}
              now={now}
            />
          ))}
          <SentenceSubjectRow learned={learnedSentenceCount} />
        </tbody>
      </table>
    </section>
  );
}

function SentenceSubjectRow({ learned }: { learned: number }) {
  const total = SENTENCE_ORDERING_TIERS.length;
  return (
    <tr>
      <th scope="row" className="py-2 pr-2 text-left font-normal">
        Sentences
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

function SubjectRow({
  subject,
  facts,
  claims,
  now,
}: {
  subject: Subject;
  facts: Record<FactId, FactAggregate>;
  claims: Claims;
  now: number;
}) {
  const tally = tallyFacts(subject.facts, facts, claims, now);

  // Met: entries with any record behind them — one showing, or one claim. A
  // count, and the only thing about an entry this page asserts. It says nothing
  // about how the entry is GOING, which is the question an entry cannot answer.
  const met = subject.entries.filter((e) =>
    factsOfEntry(subject, e).some((f) => facts[f]?.seen || claims[f]),
  ).length;

  return (
    <tr>
      <th
        scope="row"
        className="py-2 pr-2 text-left font-normal"
      >
        {subject.label}
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

/** An entry's facts, from the subject's own list. `factsOf` in facts.ts answers
 * this too, and does it with a map lookup; the difference is that this stays
 * inside the population the row is already about. */
function factsOfEntry(subject: Subject, entry: EntryId): FactId[] {
  return (INDEX.get(subject.id) ?? new Map<EntryId, FactId[]>()).get(entry) ?? [];
}

/** subject → entry → its facts. Built once, beside SUBJECTS, for the same
 * reason: `met` asks this question 10,476 times per render and it must not be a
 * scan. */
const INDEX: Map<string, Map<EntryId, FactId[]>> = (() => {
  const m = new Map<string, Map<EntryId, FactId[]>>();
  for (const s of SUBJECTS) {
    const inner = new Map<EntryId, FactId[]>();
    for (const f of s.facts) {
      const e = entryOf(f);
      const list = inner.get(e);
      if (list) list.push(f);
      else inner.set(e, [f]);
    }
    m.set(s.id, inner);
  }
  return m;
})();
