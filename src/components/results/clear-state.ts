import type { FactId } from "@/types";

export function addClearedFact(prev: ReadonlySet<FactId>, fact: FactId): Set<FactId> {
  const next = new Set(prev);
  next.add(fact);
  return next;
}

export function clearActionLabel(cleared: boolean): "Clear now" | "Cleared" {
  return cleared ? "Cleared" : "Clear now";
}
