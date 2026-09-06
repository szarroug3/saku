// The Sky's Observatory, on the learner's real progress. Route:
// /observatory. `?sample` shows a pretend learner; `?picks=a,b`
// opens with those picked (the Atlas's "Add to tonight's picks"). Signed
// out, the browser's own progress.

import { currentUserId } from "@/lib/auth";

import { loadObservatory } from "../actions";
import { ObservatoryClient } from "../observatory-client";

export const dynamic = "force-dynamic";

export default async function SkyObservatoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const picks = String(params.picks ?? "").split(",").filter(Boolean);
  const userId = sample ? null : await currentUserId();
  const initial = sample ? await loadObservatory({ sample: true }) : userId ? await loadObservatory({}) : null;
  return (
    <>
      <ObservatoryClient sample={sample} signedIn={userId !== null} initial={initial} picks={picks} />
    </>
  );
}
