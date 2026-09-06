// Recent sessions, under the sky. Route: /dev/sky/sessions (`?sample`
// shows the pretend learner's).

import Link from "next/link";

import { learnerHistory } from "../atlas";
import { sampleHistory } from "../sample-learner";
import { sessionsFromHistory } from "../sessions";
import { SessionsClient } from "../sessions-client";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

export default async function SkySessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const history = sample ? sampleHistory() : await learnerHistory();
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner. " : "Your own sessions. "}
          <Link href={sample ? "/dev/sky/sessions" : "/dev/sky/sessions?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <SessionsClient sessions={sessionsFromHistory(history)} sample={sample} />
    </SkyPage>
  );
}
