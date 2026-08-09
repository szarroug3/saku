import { entryId } from "@/lib/fact-id";
import type { EntryId } from "@/types";

/** The shared subject for a number-construction reference and its drillable fact. */
export const NUMBER_CONSTRUCTION_SUBJECT = "numbers";

/**
 * One identity for the rule in the Library and the generated category in Drill.
 * Keeping those as separate entries made the visible Library row factless while
 * an invisible `word:counter:cat:*` entry owned the question.
 */
export function numberConstructionEntry(id: string): EntryId {
  return entryId(NUMBER_CONSTRUCTION_SUBJECT, id);
}
