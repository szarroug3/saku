"use client";

// The question box under a card (#BuildHybridAI): a learner who doesn't
// follow something asks about it, and Gemini answers from the card and what
// they've learned. A view and nothing else: the asking and the check are
// src/sky/lib/page-ask.ts, and the route hands this an `ask` that does them,
// the way the mix-up coach gets its `explain`.

import { useState } from "react";

import { SkyButton, SkyTextButton } from "@/sky/components/sky-button";
import { SkyInput } from "@/sky/components/sky-input";
import { QUESTION_MAX, type PageAnswer } from "@/sky/lib/page-ask";

/** Asks a question about a card, given as plain text. Null when nothing
 * usable came back. */
export type AskAboutPage = (page: string, question: string) => Promise<PageAnswer | null>;

const WHERE = {
  on_device: "Answered by Gemini Nano on your device.",
  in_cloud: "Answered by Gemini in the cloud.",
  replaced: "Gemini Nano's answer used Japanese you haven't learned yet. Gemini in the cloud answered instead.",
} as const;

type State = { at: "closed" | "open" | "asking" | "failed" } | { at: "answered"; answer: PageAnswer };

/** `page` is the card as plain text (`cardText`). The caller keys this by it,
 * so a new card starts closed. */
export function SkyPageAsk({ page, ask }: { page: string; ask: AskAboutPage }) {
  const [state, setState] = useState<State>({ at: "closed" });
  const [question, setQuestion] = useState("");
  const send = async () => {
    if (!question.trim()) return;
    setState({ at: "asking" });
    const answer = await ask(page, question).catch(() => null);
    setState(answer ? { at: "answered", answer } : { at: "failed" });
  };

  if (state.at === "closed") {
    return <SkyTextButton onClick={() => setState({ at: "open" })}>Don&apos;t follow something? Ask about this card</SkyTextButton>;
  }
  return (
    <div className="flex flex-col gap-2">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <SkyInput
          aria-label="Your question about this card"
          placeholder="What don't you follow?"
          value={question}
          maxLength={QUESTION_MAX}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={state.at === "asking"}
          className="flex-1 text-[14px]"
        />
        <SkyButton onClick={() => void send()} disabled={state.at === "asking" || !question.trim()}>Ask</SkyButton>
      </form>
      {state.at === "asking" && <p className="text-[13px] text-sky-muted" role="status">Asking Gemini…</p>}
      {state.at === "failed" && (
        <p className="text-[13px] text-sky-muted" role="status">
          Gemini couldn&apos;t answer that from this card and what you&apos;ve learned.{" "}
          <SkyTextButton onClick={() => void send()}>Try again</SkyTextButton>
        </p>
      )}
      {state.at === "answered" && (
        <div className="flex flex-col gap-1" role="status">
          <p className="text-[14px] leading-relaxed text-sky-ink">{state.answer.text}</p>
          <p className="text-[12px] text-sky-muted">{state.answer.replaced ? WHERE.replaced : WHERE[state.answer.source]}</p>
        </div>
      )}
    </div>
  );
}
