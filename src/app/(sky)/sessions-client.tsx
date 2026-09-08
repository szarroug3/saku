"use client";

// Recent sessions' client side: rerun through the Quiz's `?cards=`, and
// forget through the app's own delete, which rebuilds the schedule
// without that session.

import { useRouter } from "next/navigation";

import { postDelete } from "@/lib/progress-fetch";
import { SkySessions } from "@/sky/components/sky-sessions";
import type { SkySession } from "@/sky/lib/sessions";

import { loadSessions } from "./actions";
import { skyHref } from "./hrefs";
import { useSkyData } from "./local";

export function SessionsClient({ initial, sample, signedIn }: { initial: readonly SkySession[] | null; sample: boolean; signedIn: boolean }) {
  const router = useRouter();
  const { data: sessions, loading } = useSkyData({ sample, signedIn, full: true, load: loadSessions, initial, eyebrow: "Sessions", title: "What have you done lately?" });
  if (!sessions) return loading;
  const rerun = (ids: readonly string[]) => router.push(skyHref("/quiz", { sample, from: "sessions", cards: ids }));
  const forget = async (id: string) => {
    await postDelete({ ids: [/^\d+$/.test(id) ? Number(id) : id] });
    router.refresh();
  };
  return <SkySessions sessions={sessions} onRerun={rerun} onDelete={sample ? undefined : forget} />;
}
