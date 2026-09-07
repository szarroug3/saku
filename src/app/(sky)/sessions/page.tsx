// Recent sessions, under the sky. Route: /sessions (`?sample`
// shows the pretend learner's). Signed out, the browser's own.

import { currentUserId } from "@/lib/auth";

import { loadSessions } from "../actions";
import { ServerTimingMeta } from "../server-timing-meta";
import { SessionsClient } from "../sessions-client";

export const metadata = { title: "Sessions" };

export const dynamic = "force-dynamic";

export default async function SkySessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const userId = sample ? null : await currentUserId();
  const initial = sample ? await loadSessions({ sample: true }) : userId ? await loadSessions({}) : null;
  return (
    <>
      <SessionsClient initial={initial} sample={sample} signedIn={userId !== null} />
      <ServerTimingMeta />
    </>
  );
}
