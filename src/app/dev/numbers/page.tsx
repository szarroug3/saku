// DEV verification page for the numbers/counters content-model migration.
//
// Not shipped UI — a window onto what the NEW shared scheduler
// (nextLesson + numbersTrack) actually produces, so the curriculum can be
// eyeballed before the viewport swap (Stage 2) makes it live. It walks the track
// from an empty history, "learning" each lesson's facts and re-scheduling, so the
// whole sequence is visible: which items, in what order, carrying which facts,
// pulling which prereqs, at what cost.
//
// Route: /dev/numbers

import { numbersTrack } from "@/lib/content/numbers-track";
import { nextLesson } from "@/lib/content/scheduler";
import { resolveItem } from "@/lib/content/resolve";
import { itemCost } from "@/lib/content/cost";
import { emptyHistory, applyClaims } from "@/lib/history-ops";
import { glyphOf } from "@/lib/facts";
import type { EntryId } from "@/types";

const RANGE = { min: 5, max: 7 };
const MAX_LESSONS = 300;

interface Row {
  glyph: string;
  kind: string;
  cost: number;
  facts: number;
  prereqs: string[];
}

function sequence(): { items: Row[] }[] {
  const track = numbersTrack();
  let history = emptyHistory();
  const lessons: { items: Row[] }[] = [];
  for (let i = 0; i < MAX_LESSONS; i++) {
    const lesson = nextLesson(track, resolveItem, history, RANGE);
    if (!lesson) break;
    lessons.push({
      items: lesson.items.map((it) => ({
        glyph: it.glyph,
        kind: it.kind,
        cost: itemCost(it),
        facts: it.facts.length,
        prereqs: it.prereqs.map((p: EntryId) => glyphOf(p)),
      })),
    });
    const facts = lesson.items.flatMap((it) => it.facts.map((f) => f.id));
    history = applyClaims(history, facts, i + 1);
  }
  return lessons;
}

export default function NumbersTrackDevPage() {
  const lessons = sequence();
  const totalItems = lessons.reduce((n, l) => n + l.items.length, 0);

  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1>Numbers / counters — new scheduler output</h1>
      <p style={{ color: "#666" }}>
        {lessons.length} lessons, {totalItems} items, walked from an empty history through{" "}
        <code>nextLesson(numbersTrack())</code>. Range {RANGE.min}–{RANGE.max}, cost = facts.
        Not live — a preview of the migrated curriculum.
      </p>
      {lessons.map((lesson, i) => {
        const cost = lesson.items.reduce((n, it) => n + it.cost, 0);
        return (
          <section
            key={i}
            style={{ margin: "1rem 0", border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem 1rem" }}
          >
            <h2 style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>
              Lesson {i + 1} · {lesson.items.length} items · cost {cost}
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#888" }}>
                  <th>Glyph</th>
                  <th>Kind</th>
                  <th>Facts</th>
                  <th>Cost</th>
                  <th>Prereqs (taught first)</th>
                </tr>
              </thead>
              <tbody>
                {lesson.items.map((it, j) => (
                  <tr key={j} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ fontSize: "1.2rem" }}>{it.glyph}</td>
                    <td>{it.kind}</td>
                    <td>{it.facts}</td>
                    <td>{it.cost}</td>
                    <td style={{ color: "#666" }}>{it.prereqs.join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
