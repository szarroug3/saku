"use client";

// What "I already know this" means — said ONCE, at the top of home, and
// dismissible.
//
// THE PRINCIPLE, THE OWNER'S WORDS
// ================================
// "This can be a general thing we put at the top of the page instead of in
// multiple places throughout the page, make it more noticeable and it should
// continue to be dismissible. It can say something more general about whenever
// you mark anything as something you know." It is the no-permanent-narration
// rule the whole app runs on, applied to itself: a new user needs to learn what
// claiming does, and needs to learn it once — not once per track.
//
// WHY ONE, AND WHY AT THE TOP
// ===========================
// This used to ride under every lesson card, each card wording it again in its
// own terms. Four near-identical sentences down one page read as noise, and
// each one only claimed to speak for the card above it — so the rule looked
// local when it is global. It is the SAME rule everywhere: kana, kanji, words,
// grammar. So it is stated once, generally, above the cards it governs, and
// carries accent weight rather than the muted-footnote styling it had when it
// was an aside to a single card.
//
// THE WORDING IS THE OWNER'S, VERBATIM, AND IT MAKES THREE PROMISES
// =================================================================
// "Saying you already know something (a kana, a kanji, a word, a grammar
// pattern) lets you skip its lesson and quizzes. It goes into your knowledge
// base so anything that requires it is no longer blocked by it. You can choose
// to completely skip the lesson and quiz or skip just the lesson and go straight
// to the quiz."
//
// Sentence by sentence, because each one is load-bearing and each one is
// checkable against code:
//
//  1. "lets you skip its lesson and quizzes" — claimedFact in src/lib/claims.ts
//     writes CLAIMED_DAYS = 90 of stability, so weakness ranking treats it as
//     known and stops surfacing it. This is why claiming is worth doing at all.
//     Note "skip", not "gone": an EXPLICIT scope still sweeps it back in. "Quiz
//     me on all hiragana so far" resolves through scriptSoFar() in
//     src/lib/lesson.ts, which is built from KANA_GROUPS in curriculum order and
//     reads no history at all, so a kana you claimed IS in that set and WILL be
//     asked. Same for any deck you build by hand in the Library, which selects
//     by query, not by what you drilled. The app stops CHOOSING it for you; it
//     does not refuse to ask it when YOU choose it. Do not reword toward "stops
//     coming up" (reads as gone for good) or toward "fair game for future
//     lessons" (reads as a promise it keeps coming up).
//  2. "anything that requires it is no longer blocked by it" — the payoff.
//     Claiming counts through effectiveState, so everything GATED on it becomes
//     teachable: claim a kanji and the words needing it open (word-lesson.ts),
//     claim a word and the readings it attests unlock (word-unlock.ts).
//  3. "completely skip the lesson and quiz OR skip just the lesson" — this one
//     is a promise about the BUTTONS, not the model, and it is the reason every
//     lesson card now carries two routes into the material beside the claim:
//     "I already know these" (skip both) and "Quiz me" (skip the teach walk,
//     drill now). Kana always had that fork; next-kanji-lesson.tsx,
//     next-word-lesson.tsx and next-grammar-lesson.tsx grew it so this sentence
//     is true on every card the explainer sits above rather than on one of four.
//     If a track ever loses its skip-the-lesson route, this sentence is a lie
//     and has to go with it.
//
// No em dashes in the copy: the owner dislikes them, hence the parentheses in
// the first sentence where a pair of dashes would be the usual choice.
//
// The sentence this replaced ("takes your word for it now, and checks back in a
// few months") was TRUE — CLAIMED_DAYS decays to a probe in a season — and it
// dodged the scope traps by simply not making a claim about scope. But it spent
// the one paragraph we get on the app's own bookkeeping instead of on what
// claiming buys you. The recheck still happens; it introduces itself when it
// arrives.
//
// WHY useState + useEffect AND NOT read-during-render
// ===================================================
// localStorage can't be read during SSR or the first client paint without a
// hydration mismatch, so it starts hidden and appears after mount if the flag
// is unset. `null` is "haven't checked yet", kept distinct from false so a
// returning user who dismissed it never sees it flash in. The ✕ is a plain
// <button>: the ui kit's Chip `part` prop is broken (see ui.tsx), and this needs
// nothing a Chip would give it.
//
// The dismissal flag lives in src/lib/claim-hint.ts, and is registered in
// DISMISSIBLE_HINT_KEYS so the Settings knowledge-base reset un-dismisses it and
// a genuinely-restarting user meets the explanation again.

import { useEffect, useState } from "react";

import { dismissClaimHint, isClaimHintDismissed } from "@/lib/claim-hint";

export function ClaimExplainer() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(
      isClaimHintDismissed(
        typeof window === "undefined" ? null : window.localStorage,
      ),
    );
  }, []);

  if (dismissed !== false) return null;

  const onDismiss = () => {
    dismissClaimHint(typeof window === "undefined" ? null : window.localStorage);
    setDismissed(true);
  };

  return (
    <div className="kq-material mb-3.5 flex items-start gap-3 rounded-xl border border-accent bg-accent-bg p-[18px]">
      <p className="flex-1 text-[13px] leading-relaxed text-text">
        Saying you already know something (a kana, a kanji, a word, a grammar
        pattern) lets you skip its lesson and quizzes. It counts as learned, so
        anything that was waiting on it is no longer waiting.
        You can choose to completely skip the lesson and quiz or skip just the
        lesson and go straight to the quiz.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Got it, don't show this again"
        className="kq-material -my-0.5 shrink-0 cursor-pointer rounded-lg border border-accent bg-card px-2 py-0.5 text-xs text-accent hover:bg-panel"
      >
        Got it
      </button>
    </div>
  );
}
