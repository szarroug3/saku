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
        Say you already know something — a kana, a kanji, a word, a grammar
        pattern — and it goes into your knowledge base and stops coming up. The
        app takes your word for it now, and checks back in a few months.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Got it — don't show this again"
        className="kq-material -my-0.5 shrink-0 cursor-pointer rounded-lg border border-accent bg-card px-2 py-0.5 text-xs text-accent hover:bg-panel"
      >
        Got it
      </button>
    </div>
  );
}
