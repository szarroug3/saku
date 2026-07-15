"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ResultsView } from "@/components/results/results-view";
import { useQuizSession } from "@/lib/quiz-session";

export default function ResultsPage() {
  const router = useRouter();
  const { results, restored } = useQuizSession();

  useEffect(() => {
    if (restored && !results) router.replace("/");
  }, [restored, results, router]);
  if (!results) return null;

  // Keyed by ts so reopening a different stored session resets the
  // forgiving/strict toggle and the mount-time "recent" timestamp check.
  return <ResultsView key={results.ts} results={results} />;
}
