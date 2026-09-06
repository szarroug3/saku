"use client";

// Recent sessions' client side: rerun through the Quiz's `?cards=`, and
// forget through the app's own delete, which rebuilds the schedule
// without that session.

import { useRouter } from "next/navigation";

import { postDelete } from "@/lib/progress-fetch";
import { SkySessions } from "@/sky/components/sky-sessions";
import type { SkySession } from "@/sky/lib/sessions";

export function SessionsClient({ sessions, sample }: { sessions: readonly SkySession[]; sample: boolean }) {
  const router = useRouter();
  const rerun = (ids: readonly string[]) => router.push(`/dev/sky/quiz?${sample ? "sample&" : ""}cards=${encodeURIComponent(ids.join(","))}`);
  const forget = async (id: string) => {
    await postDelete({ ids: [/^\d+$/.test(id) ? Number(id) : id] });
    router.refresh();
  };
  return <SkySessions sessions={sessions} onRerun={rerun} onDelete={sample ? undefined : forget} height="100%" />;
}
