// The Sky's Observatory, on the learner's real progress. Route:
// /observatory. `?sample` shows a pretend learner; `?picks=a,b`
// opens with those picked (the Atlas's "Add to tonight's picks"). Signed
// out, the browser's own progress.

import { loadObservatory } from "../actions";
import { idsFrom } from "../hrefs";
import { initialFor, whoFor } from "../page-data";
import { ObservatoryClient } from "../observatory-client";

export const metadata = { title: "Observatory" };

export const dynamic = "force-dynamic";

export default async function SkyObservatoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { sample, signedIn, who } = await whoFor(params);
  const initial = await initialFor(who, loadObservatory);
  return <ObservatoryClient sample={sample} signedIn={signedIn} initial={initial} picks={idsFrom(params.picks)} />;
}
