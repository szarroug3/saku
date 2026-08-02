import type { EntryId, FactId } from "@/types";

export interface GroupedEntryRow {
  entry: EntryId;
  facts: FactId[];
}

export interface DisplayGroupedRow {
  key: string;
  heading: string;
  facts: FactId[];
}

export function groupRowsByDisplayLabel(
  rows: GroupedEntryRow[],
  glyphOfEntry: (entry: EntryId) => string,
  displayEntry?: (entry: EntryId, fact: FactId) => string,
): DisplayGroupedRow[] {
  return rows.flatMap((row) => {
    if (!displayEntry) {
      return [
        {
          key: row.entry,
          heading: glyphOfEntry(row.entry),
          facts: row.facts,
        },
      ];
    }
    const buckets = new Map<string, FactId[]>();
    for (const fact of row.facts) {
      const heading = displayEntry(row.entry, fact);
      const list = buckets.get(heading) ?? [];
      list.push(fact);
      buckets.set(heading, list);
    }
    return [...buckets.entries()].map(([heading, groupedFacts]) => ({
      key: `${row.entry}:${heading}`,
      heading,
      facts: groupedFacts,
    }));
  });
}
