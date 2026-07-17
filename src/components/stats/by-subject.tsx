"use client";

// Where you are in each subject — four rows, and every number on them is a count
// of something you could point at.
//
// TWO QUESTIONS PER ROW, AND EACH ONE ANSWERED ONCE
// =================================================
//   the bar     how is my memory of what I've met? — FACTS. A memory holds
//               facts. 生 is not in one condition; its nine readings are in
//               nine.
//   the number  how much of this subject have I met? — ENTRIES. You meet 生,
//               once. "70 of 2,136 kanji" is a sentence. "154 of 5,314 kanji"
//               is not: there are not 5,314 kanji, and nobody could name what
//               there are 5,314 of.
//
// THE BAR DOES NOT CARRY COVERAGE, AND THE MOCK SAYS IT SHOULD
// ============================================================
// The approved design draws a fourth, empty segment for material you have never
// touched, so the bar shows coverage AND mix at once. It was drawn at roughly
// half-covered. Against the real library it does not survive: 2,136 kanji and
// 8,045 words mean a real learner is 3% covered, so the untouched segment takes
// 97% of the bar and every colour in it collapses into a two-pixel smudge. On
// screen, three of the four rows rendered as an empty track. The bar's one job —
// the mix — was the thing that disappeared.
//
// So the bar is drawn over what you have MET, full width, and coverage is the
// number beside it. Nothing is lost: "70 of 2,136" states coverage exactly,
// which is better than a bar can, and the bar now states the mix, which the
// number cannot. The two readings that looked redundant in the mock were only
// redundant at the mock's scale.
//
// AN ENTRY IS STILL NEVER GIVEN A STANDING. The alternative row was "生 is solid
// if all nine readings are", and it is the move this codebase has already
// deleted once, in decks.weakestEntries(). A min over nine predictions is an
// average with the arithmetic filed off, and it would put 生 in a bucket that no
// fact of 生 is in. `met` counts entries, and counting is all it does.

import { Card, Lbl } from "@/components/ui";
import { BUCKETS, fillFor, tallyFacts } from "@/components/stats/tally";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import type { Claims } from "@/lib/claims";
import { ALL_FACTS, entryOf, factInfo } from "@/lib/facts";
import { KIND_LABEL } from "@/lib/library/entries";
import type { AccuracyMetric, EntryId, FactAggregate, FactId } from "@/types";

/** What each subject is called. KIND_LABEL is the Library's, and reusing it is
 * the point: the Library and Progress calling the same shelf two things is a bug
 * nobody would file and everybody would feel. Grammar has no Library shelf yet,
 * so its word is added here rather than invented there. */
const SUBJECT_LABEL: Record<string, string> = {
  ...KIND_LABEL,
  [GRAMMAR_SUBJECT]: "Grammar",
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
  metric,
  now,
}: {
  facts: Record<FactId, FactAggregate>;
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
}) {
  return (
    <Card>
      <Lbl>By subject</Lbl>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {SUBJECTS.map((s) => (
            <SubjectRow
              key={s.id}
              subject={s}
              facts={facts}
              claims={claims}
              metric={metric}
              now={now}
            />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SubjectRow({
  subject,
  facts,
  claims,
  metric,
  now,
}: {
  subject: Subject;
  facts: Record<FactId, FactAggregate>;
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
}) {
  const tally = tallyFacts(subject.facts, facts, claims, metric, now);

  // Met: entries with any record behind them — one showing, or one claim. A
  // count, and the only thing about an entry this page asserts. It says nothing
  // about how the entry is GOING, which is the question an entry cannot answer.
  const met = subject.entries.filter((e) =>
    factsOfEntry(subject, e).some((f) => facts[f]?.seen || claims[f]),
  ).length;

  return (
    <tr className="border-b border-border last:border-b-0">
      <th
        scope="row"
        className="py-2 pr-2 text-left font-normal"
      >
        {subject.label}
      </th>
      <td className="w-[92px] py-2">
        {/* `tally["not-seen"]` is deliberately not drawn — see the header. The
         * track shows through when a subject has no record at all, which is the
         * one case where "nothing here" is the whole answer. */}
        <span
          aria-hidden="true"
          className="flex h-1.5 overflow-hidden rounded-full bg-panel"
        >
          {BUCKETS.filter((b) => tally[b] > 0).map((b) => (
            <span
              key={b}
              className={`block h-full ${fillFor(b)}`}
              style={{ flex: tally[b] }}
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
