"use client";

// The one place the app admits that your work has not been saved.
//
// WHY IT IS ON EVERY PAGE
// =======================
// The failure it reports is not local to a screen. A round that could not be
// posted makes Progress, Practice and the Library all quietly wrong — "Kana 0
// of 214" after eighteen correct answers — and those are exactly the screens a
// learner goes to in order to find out whether their work counted. A banner
// that only appeared on the session screen would be absent from every page
// where the lie is visible.
//
// WHY IT IS NOT A DIALOG
// ======================
// Nothing is lost when this shows. The record is on this device, it is retried
// on the next mount and whenever the network comes back, and it is dropped only
// when the server acknowledges it. So this is a statement of fact and an offer,
// not an interruption — it must not stand between a learner and the next
// question. It renders nothing at all in the normal case.

import { Btn } from "@/components/ui";
import { useQuizSession } from "@/lib/quiz-session";

export function SaveStatus() {
  const { saveError, retrySave } = useQuizSession();
  if (!saveError) return null;
  return (
    <div
      // `status`, not `alert`: assertive would interrupt a screen reader
      // mid-question, and this is never urgent enough to earn that.
      role="status"
      className="kq-material mb-3.5 flex items-center gap-3 rounded-xl border border-danger/40 bg-card p-[18px]"
    >
      <p className="min-w-0 flex-1 text-[13px] text-text-muted">{saveError}</p>
      <Btn onClick={retrySave}>Try again</Btn>
    </div>
  );
}
