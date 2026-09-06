// Recent sessions, under the sky. Route: /dev/sky/sessions (`?sample`
// shows the pretend learner's). Signed out, the browser's own.

import Link from "next/link";

import { currentUserId } from "@/lib/auth";

import { loadSessions } from "../actions";
import { SessionsClient } from "../sessions-client";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

export default async function SkySessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const userId = sample ? null : await currentUserId();
  const initial = sample ? await loadSessions({ sample: true }) : userId ? await loadSessions({}) : null;
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner. " : userId ? "Your own sessions. " : "Your sessions, kept in this browser. "}
          <Link href={sample ? "/dev/sky/sessions" : "/dev/sky/sessions?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <SessionsClient initial={initial} sample={sample} signedIn={userId !== null} />
    </SkyPage>
  );
}
