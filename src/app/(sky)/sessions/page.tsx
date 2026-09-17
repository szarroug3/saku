// Recent sessions, under the sky. Route: /sessions (`?sample`
// shows the pretend learner's). Signed out, the browser's own.

import { loadPlace, loadSessions } from "../actions";
import { initialFor, whoFor } from "../page-data";
import { ServerTimingMeta } from "../server-timing-meta";
import { SessionsClient } from "../sessions-client";

export const metadata = { title: "Sessions" };

export const dynamic = "force-dynamic";

export default async function SkySessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sample, signedIn, who } = await whoFor(await searchParams);
  // the sessions and what is not finished at the same time (SAK-444); a
  // visitor's place is in their browser, so there is nothing to read here
  const [initial, accountPlace] = await Promise.all([
    initialFor(who, loadSessions),
    sample || !signedIn ? undefined : loadPlace(),
  ]);
  return (
    <>
      <SessionsClient initial={initial} sample={sample} signedIn={signedIn} accountPlace={accountPlace} />
      <ServerTimingMeta />
    </>
  );
}
