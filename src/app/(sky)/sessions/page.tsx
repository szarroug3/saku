// Recent sessions, under the sky. Route: /sessions (`?sample`
// shows the pretend learner's). Signed out, the browser's own.

import { loadSessions } from "../actions";
import { initialFor, whoFor } from "../page-data";
import { ServerTimingMeta } from "../server-timing-meta";
import { SessionsClient } from "../sessions-client";

export const metadata = { title: "Sessions" };

export const dynamic = "force-dynamic";

export default async function SkySessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sample, signedIn, who } = await whoFor(await searchParams);
  const initial = await initialFor(who, loadSessions);
  return (
    <>
      <SessionsClient initial={initial} sample={sample} signedIn={signedIn} />
      <ServerTimingMeta />
    </>
  );
}
