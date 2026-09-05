// The Sky's home, on the signed-in learner's real progress. Route: /dev/sky/home
//
// One call: the route loads the learner's sky through the adapter and hands
// it to SkyHome. Per request, never prerendered: what it shows is the
// session's history. `?sample` shows a pretend learner instead, for a look
// at a full sky without an account.

import Link from "next/link";

import { SkyHome } from "@/sky/components/sky-home";

import { SkyPage } from "../sky-page";

import { getStatsRows } from "@/lib/library/server-lookups";

import { learnerSky, skyFromHistory } from "../learner";
import { sampleHistory } from "../sample-learner";

export const dynamic = "force-dynamic";

export default async function SkyHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const everything = params.all !== undefined;
  const options = { everything };
  const data = sample ? skyFromHistory(sampleHistory(), undefined, await getStatsRows(), options) : await learnerSky(undefined, options);
  const href = (s: boolean, a: boolean) => `/dev/sky/home${s || a ? "?" : ""}${[s ? "sample" : "", a ? "all" : ""].filter(Boolean).join("&")}`;
  return (
    <SkyPage
      note={
        <>
          <span>
            {sample ? "A pretend learner. " : "Your own progress. "}
            <Link href={href(!sample, everything)} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
          </span>
          <span className="ml-4">
            {everything ? "Every kana, piece and kanji is up there. " : "Only what has been discovered. "}
            <Link href={href(sample, !everything)} className="underline">{everything ? "Show only what's discovered" : "Show everything"}</Link>
          </span>
        </>
      }
    >
      <SkyHome data={data} planetariumHref="/dev/sky/planetarium" height="100%" />
    </SkyPage>
  );
}
