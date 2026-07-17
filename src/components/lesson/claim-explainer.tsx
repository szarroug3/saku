"use client";

// The sentence that used to ride under EVERY lesson card, forever — now shown
// once and dismissible.
//
// THE PRINCIPLE, THE OWNER'S WORDS
// ================================
// "This should be dismissible and maybe introduced when the app first starts so
// the user knows about it but doesn't have to see it all the time." It is the
// no-permanent-narration rule the whole app runs on, applied to itself: a new
// user needs to learn what "I already know these" does; a returning user does
// not need it re-explained on every lesson card of every session.
//
// So this wraps each card's own copy (kept verbatim — the wording isn't being
// reworked, just made dismissible) with a ✕, and hides ALL of them on the first
// dismissal. One shared flag, not one per card: seen the explanation on the
// kanji card, you don't need it again on the words card. See src/lib/claim-hint.ts.
//
// WHY useState + useEffect AND NOT read-during-render
// ===================================================
// localStorage can't be read during SSR or the first client paint without a
// hydration mismatch, so it starts shown (the honest default) and hides after
// mount if the flag is set. The ✕ is a plain <button>: the ui kit's Chip `part`
// prop is broken (see ui.tsx), and this needs nothing a Chip would give it.
//
// WHY THE WINDOW EVENT — ONE DISMISSAL, ALL CARDS, RIGHT AWAY
// ===========================================================
// Every lesson card mounts its OWN ClaimExplainer, so the dismissal has to be
// shared or dismissing under the kanji card would leave the sentence under the
// words and grammar cards until a reload. localStorage IS shared, but a write
// to it doesn't re-render a sibling that already read it. So a dismissal both
// persists (localStorage, for the next visit) AND broadcasts a window event (for
// the siblings in THIS render): every instance listens, and the first "Got it"
// takes them all down at once. This is the "one shared dismissal across all
// lesson cards" the brief asks for, without threading a context through cards
// that other agents own.

import { useEffect, useState, type ReactNode } from "react";

import { Card, Hint } from "@/components/ui";
import { dismissClaimHint, isClaimHintDismissed } from "@/lib/claim-hint";

/** Fired on the first dismissal so every mounted ClaimExplainer hides at once,
 * not just the one whose button was pressed. */
const DISMISS_EVENT = "kanaquiz:claim-hint-dismissed";

export function ClaimExplainer({ children }: { children: ReactNode }) {
  // Shown by default so a first-time user meets the explanation; hidden after
  // mount if they've already dismissed it once. `null` is "haven't checked yet"
  // — kept distinct from false so the card doesn't flash in for a returning user
  // who dismissed it (we render nothing until the read has happened).
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(
      isClaimHintDismissed(
        typeof window === "undefined" ? null : window.localStorage,
      ),
    );
    // A sibling's dismissal takes this one down too — the shared-dismissal rule,
    // live in the same render rather than only on the next reload.
    const onSiblingDismiss = () => setDismissed(true);
    window.addEventListener(DISMISS_EVENT, onSiblingDismiss);
    return () => window.removeEventListener(DISMISS_EVENT, onSiblingDismiss);
  }, []);

  if (dismissed !== false) return null;

  const onDismiss = () => {
    dismissClaimHint(typeof window === "undefined" ? null : window.localStorage);
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(DISMISS_EVENT));
    }
  };

  return (
    <Card className="flex items-start gap-3 px-[15px] py-[13px]">
      <Hint>{children}</Hint>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Got it — don't show this again"
        className="kq-material -my-0.5 shrink-0 cursor-pointer rounded-lg border border-border bg-card px-2 py-0.5 text-xs text-text-muted hover:bg-panel"
      >
        Got it
      </button>
    </Card>
  );
}
