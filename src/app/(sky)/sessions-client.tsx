"use client";

// Recent sessions' client side: rerun through the Quiz's `?cards=`, and
// forget through the app's own delete, which rebuilds the schedule
// without that session.

import { useRouter } from "next/navigation";

import { postDelete } from "@/lib/progress-fetch";
import { SkySessions } from "@/sky/components/sky-sessions";
import type { SkySession } from "@/sky/lib/sessions";

import { loadSessions } from "./actions";
import { SkyLoading, useLoaded, useWho } from "./local";

export function SessionsClient({ initial, sample, signedIn }: { initial: readonly SkySession[] | null; sample: boolean; signedIn: boolean }) {
  const router = useRouter();
  const who = useWho(sample, signedIn, true);
  const sessions = useLoaded(who, loadSessions, initial);
  if (!sessions) return <SkyLoading />;
  const rerun = (ids: readonly string[]) => router.push(`/quiz?${sample ? "sample&" : ""}from=sessions&cards=${encodeURIComponent(ids.join(","))}`);
  const forget = async (id: string) => {
    await postDelete({ ids: [/^\d+$/.test(id) ? Number(id) : id] });
    router.refresh();
  };
  return <SkySessions sessions={sessions} onRerun={rerun} onDelete={sample ? undefined : forget} height="100%" />;
}
