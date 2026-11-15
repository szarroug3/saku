"use client";

// The question thread under a card (#BuildHybridAI): a learner who doesn't
// follow something asks about it, and can keep asking, each answer read in
// light of the ones before. The thread is the card's own: a new card starts
// a new one (the caller keys this by the card), and it stops at THREAD_MAX
// questions, since every turn goes back in the prompt.
//
// A view and nothing else: the asking and the check are
// src/sky/lib/page-ask.ts, and the route hands this an `ask` that does them,
// the way the mix-up coach gets its `explain`.

import { useState } from "react";

import { SkyButton, SkyTextButton } from "@/sky/components/sky-button";
import { SkyInput } from "@/sky/components/sky-input";
import { QUESTION_MAX, THREAD_MAX, type PageAnswer, type Turn } from "@/sky/lib/page-ask";

/** Asks a question about a card, given as plain text, with the thread so
 * far. Null when nothing usable came back. */
export type AskAboutPage = (page: string, question: string, earlier?: readonly Turn[]) => Promise<PageAnswer | null>;

const WHERE = {
  on_device: "Answered by Gemini Nano on your device.",
  in_cloud: "Answered by Gemini in the cloud.",
  replaced: "Gemini Nano's answer used Japanese you haven't learned yet. Gemini in the cloud answered instead.",
} as const;

type Answered = Turn & { where: string };

/** `page` is the card as plain text (`cardText`). */
export function SkyPageAsk({ page, ask }: { page: string; ask: AskAboutPage }) {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<readonly Answered[]>([]);
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<"ready" | "asking" | "failed">("ready");

  const send = async () => {
    const q = question.trim();
    if (!q || state === "asking") return;
    setState("asking");
    const answer = await ask(page, q, thread.map(({ question, answer }) => ({ question, answer }))).catch(() => null);
    if (!answer) return setState("failed");
    setThread((prev) => [...prev, { question: q, answer: answer.text, where: answer.replaced ? WHERE.replaced : WHERE[answer.source] }]);
    setQuestion("");
    setState("ready");
  };
  const startOver = () => { setThread([]); setQuestion(""); setState("ready"); };

  if (!open) {
    return <SkyTextButton onClick={() => setOpen(true)}>Don&apos;t follow something? Ask about this card</SkyTextButton>;
  }
  const full = thread.length >= THREAD_MAX;
  return (
    <div className="flex flex-col gap-3">
      {thread.length > 0 && (
        <ol className="flex flex-col gap-3" aria-label="Your questions about this card">
          {thread.map((t, i) => (
            <li key={i} className="flex flex-col gap-1">
              <p className="text-[13.5px] font-semibold text-sky-ink">{t.question}</p>
              <p className="text-[14px] leading-relaxed text-sky-ink">{t.answer}</p>
              <p className="text-[12px] text-sky-muted">{t.where}</p>
            </li>
          ))}
        </ol>
      )}
      {full ? (
        <p className="text-[13px] text-sky-muted">
          That&apos;s as long as a thread on one card goes.{" "}
          <SkyTextButton onClick={startOver}>Start over</SkyTextButton>
        </p>
      ) : (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <SkyInput
            aria-label={thread.length ? "Ask a follow-up" : "Your question about this card"}
            placeholder={thread.length ? "Ask a follow-up" : "What don't you follow?"}
            value={question}
            maxLength={QUESTION_MAX}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={state === "asking"}
            className="flex-1 text-[14px]"
          />
          <SkyButton onClick={() => void send()} disabled={state === "asking" || !question.trim()}>Ask</SkyButton>
        </form>
      )}
      {state === "asking" && <p className="text-[13px] text-sky-muted" role="status">Asking Gemini…</p>}
      {state === "failed" && (
        <p className="text-[13px] text-sky-muted" role="status">
          Gemini couldn&apos;t answer that from this card and what you&apos;ve learned.{" "}
          <SkyTextButton onClick={() => void send()}>Try again</SkyTextButton>
        </p>
      )}
      {thread.length > 0 && !full && <p><SkyTextButton onClick={startOver}>Start over</SkyTextButton></p>}
    </div>
  );
}
