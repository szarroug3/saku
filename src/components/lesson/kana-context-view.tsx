"use client";

// "How it's said in context" — the aside for the two kana whose sound is
// decided by what follows them (ん, っ). One presentation, rendered identically
// on the lesson card where the kana is met and on its Library entry page, so a
// learner looking ん up reads exactly what they were taught.
//
// It reads as a small labelled table rather than prose: each row is one
// following-sound and the sound the kana takes there, with a real word beneath.
// The summary line up top is DRAFT copy for Sam to finalise (see
// src/data/kana-context.ts); the per-row facts are pronunciation, not copy.

import type { ContextPronunciation } from "@/data/kana-context";

export function KanaContextView({ ctx }: { ctx: ContextPronunciation }) {
  return (
    <div>
      <p className="text-[13px] font-medium">How it&apos;s said in context</p>
      {/* DRAFT copy — flagged for Sam to finalise. */}
      <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{ctx.summary}</p>
      <dl className="mt-3 flex flex-col gap-2.5">
        {ctx.rules.map((rule) => (
          <div key={rule.when} className="border-l-2 border-accent pl-3.5">
            <dt className="text-[13px] leading-relaxed text-text">
              <span>{rule.when[0].toUpperCase() + rule.when.slice(1)}</span>: said{" "}
              <span className="font-medium">{rule.sounds}</span>
            </dt>
            <dd className="mt-0.5 font-kana text-[13px] leading-relaxed text-text-muted">
              {rule.example}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
