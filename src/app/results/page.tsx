"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PageTitle } from "@/components/ui";
import { useQuizSession } from "@/lib/quiz-session";

// TODO(agent:results): forgiving/strict toggle, metric cards, missed / slow /
// mix-up lists, redrill / again / setup buttons. Data comes from
// useQuizSession().results (live or stored). See CONVERSION_PROMPT.md "Results".
export default function ResultsPage() {
  const router = useRouter();
  const { results, restored } = useQuizSession();

  useEffect(() => {
    if (restored && !results) router.replace("/");
  }, [restored, results, router]);
  if (!results) return null;

  return <PageTitle title="Results" sub="Results screen coming up." />;
}
