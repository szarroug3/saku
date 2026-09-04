// The Sky's home, on the signed-in learner's real progress. Route: /dev/sky/home
//
// One call: the route loads the learner's sky through the adapter and hands
// it to SkyHome. Per request, never prerendered: what it shows is the
// session's history. `?sample` shows a pretend learner instead, for a look
// at a full sky without an account.

import Link from "next/link";

import { SkyHome } from "@/sky/components/sky-home";

import { getStatsRows } from "@/lib/library/server-lookups";

import { learnerSky, skyFromHistory } from "../learner";
import { sampleHistory } from "../sample-learner";

export const dynamic = "force-dynamic";

export default async function SkyHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const data = sample ? skyFromHistory(sampleHistory(), undefined, await getStatsRows()) : await learnerSky();
  return (
    <div className="sky-wash -mx-6 -my-8 min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="mx-auto max-w-[1180px]">
        <p className="mb-4 font-sky-ui text-[12px] text-sky-muted">
          {sample ? "A pretend learner. " : "Your own progress. "}
          <Link href={sample ? "/dev/sky/home" : "/dev/sky/home?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </p>
        <SkyHome data={data} planetariumHref="/learn" />
      </div>
    </div>
  );
}
