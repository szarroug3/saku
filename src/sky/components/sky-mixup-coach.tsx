"use client";

// The mix-up coach's button and answer (#BuildHybridAI): "What's the
// difference?" under a missed quiz card, and on each row of the home's
// Mix-ups panel. One click asks Gemini how to tell the two apart, from Saku's
// own facts about them, and the answer says where it was worked out.
//
// A view and nothing else. The asking, the check that the answer stands on
// the facts, and the order the models are tried in are
// src/sky/lib/mixup-coach.ts; the route hands this an `explain` that does
// them, the way the writing drill gets its grader.

import { useState } from "react";

import { SkyTextButton } from "@/sky/components/sky-button";
import type { CoachAnswer } from "@/sky/lib/mixup-coach";

/** Asks how two entries differ. Null when nothing usable came back. */
export type ExplainMixup = (asked: string, other: string) => Promise<CoachAnswer | null>;

const WHERE = {
  on_device: "Explained by Gemini Nano on your device.",
  in_cloud: "Explained by Gemini in the cloud.",
  replaced: "Gemini Nano's answer went past what Saku knows about these two, so Gemini in the cloud explained it instead.",
} as const;

export function SkyMixupCoach({ asked, other, explain, label = "What's the difference?" }: {
  /** The entry the card asked about, or the pair's first side. */
  asked: string;
  /** The entry it was mixed up with. */
  other: string;
  explain: ExplainMixup;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "asking" | "failed" | CoachAnswer>("idle");
  const ask = async () => {
    setState("asking");
    setState((await explain(asked, other).catch(() => null)) ?? "failed");
  };

  if (state === "idle") return <SkyTextButton onClick={() => void ask()}>{label}</SkyTextButton>;
  if (state === "asking") return <p className="text-[13px] text-sky-muted" role="status">Asking Gemini…</p>;
  if (state === "failed") {
    return (
      <p className="text-[13px] text-sky-muted" role="status">
        Gemini couldn&apos;t explain this pair right now.{" "}
        <SkyTextButton onClick={() => void ask()}>Try again</SkyTextButton>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1" role="status">
      <p className="text-[14px] leading-relaxed text-sky-ink">{state.text}</p>
      <p className="text-[12px] text-sky-muted">{state.replaced ? WHERE.replaced : WHERE[state.source]}</p>
    </div>
  );
}
