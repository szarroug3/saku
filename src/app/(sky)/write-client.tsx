"use client";

// The writing drill's grader, handed to the Sky's screen. A server page
// cannot hand a function to a client component, so this client wrapper does,
// the way quiz-client.tsx hands the quiz its grader.

import { SkyWriteDrill, type WriteGrader } from "@/sky/components/sky-write-drill";
import type { WriteItem } from "@/sky/lib/write-drill";

import { deviceModelState, gradeAnswer, graderConfigured, prepareDeviceModel } from "./hybrid-grader";
import { typeKana } from "./typing";

/** One object for the life of the page, so the screen checks the device once. */
const GRADER: WriteGrader = {
  configured: graderConfigured(),
  deviceState: deviceModelState,
  prepareDevice: prepareDeviceModel,
  grade: gradeAnswer,
};

export function WriteDrillClient({ pool, backHref }: { pool: readonly WriteItem[]; backHref: string }) {
  return <SkyWriteDrill pool={pool} backHref={backHref} grader={GRADER} toKana={typeKana} />;
}
