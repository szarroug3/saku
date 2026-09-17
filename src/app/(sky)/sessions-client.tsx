"use client";

// Recent sessions' client side: rerun through the Quiz's `?cards=`, and
// forget through the app's own delete, which rebuilds the schedule
// without that session.
//
// AND WHAT IS NOT FINISHED, at the top (SAK-444). The place this learner left
// off is read live from the browser, with the account's standing in when this
// browser holds none, exactly as the Planetarium reads it. The newest of the
// two is already on the Continue button beside every heading, so this page
// lists the OTHER one, which is the whole point: an unfinished quiz that a
// newer lesson pushed off the button is still one click away here. Forgetting
// one clears its slot and nothing else.

import { useRouter } from "next/navigation";

import { postDelete } from "@/lib/progress-fetch";
import { SkySessions, type UnfinishedRow } from "@/sky/components/sky-sessions";
import { hasPlace, newestPlace, NO_PLACE, placeEntries, type SavedPlace } from "@/sky/lib/place";
import type { SkySession } from "@/sky/lib/sessions";

import { loadSessions } from "./actions";
import { placeHref, skyHref } from "./hrefs";
import { useSkyData } from "./local";
import { keepLesson, keepRun, useSavedPlace } from "./quiz-run-store";

export function SessionsClient({ initial, sample, signedIn, accountPlace = NO_PLACE }: { initial: readonly SkySession[] | null; sample: boolean; signedIn: boolean; accountPlace?: SavedPlace }) {
  const router = useRouter();
  const { data: sessions, loading } = useSkyData({ sample, signedIn, full: true, load: loadSessions, initial, eyebrow: "Sessions", title: "What have you done lately?" });
  const local = useSavedPlace();
  const place = sample ? NO_PLACE : hasPlace(local) ? local : accountPlace;
  // An unfinished QUIZ is listed whether or not it is the one on the button:
  // this is the page that says what you have been doing, a quiz is the thing
  // with answers in it, and letting one go belongs beside the sessions it
  // would have become. An unfinished LESSON is listed only when the button is
  // not already offering it, since two Continues for the same lesson on one
  // screen is a question rather than an offer.
  const onButton = newestPlace(place);
  const unfinished: UnfinishedRow[] = placeEntries(place)
    .filter((entry) => entry.kind === "quiz" || onButton?.kind !== "lesson")
    .map((entry) => ({
      entry,
      href: placeHref(entry, sample),
      onForget: () => (entry.kind === "quiz" ? keepRun(null, signedIn) : keepLesson(null, signedIn)),
    }));
  if (!sessions) return loading;
  const rerun = (ids: readonly string[]) => router.push(skyHref("/quiz", { sample, from: "sessions", cards: ids }));
  const forget = async (id: string) => {
    await postDelete({ ids: [/^\d+$/.test(id) ? Number(id) : id] });
    router.refresh();
  };
  return <SkySessions sessions={sessions} unfinished={unfinished} onRerun={rerun} onDelete={sample ? undefined : forget} />;
}
