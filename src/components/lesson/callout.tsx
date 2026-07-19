"use client";

// The irregularity call-out — one treatment, wherever a lesson has to admit
// that the pattern it just taught has a hole in it.
//
// Two screens raise one: the character card (し is "shi", not "si") and the
// conversion card (ぢ and づ sound exactly like じ and ず). They must not look
// like two different kinds of remark, and — the reason this is a component and
// not a copied className — the call-out must not read as part of the story it
// interrupts. A left rule in the accent and a labelled opener does that: it
// belongs to the thing above it, but it is visibly an aside about the rule
// rather than more of the rule.

import type { ReactNode } from "react";

export function Callout({
  label = "Heads up.",
  children,
}: {
  /** The opener. Overridable because "Heads up." is right beside a character
   * and flat next to a rule that has a named exception. Pass an empty string to
   * suppress the opener entirely, for asides whose own text already announces
   * itself. The glyph-variant note passes its "Note:" opener as the label, so
   * the aside still gets a bold opener without the string carrying the prefix. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <p className="border-l-2 border-accent pl-3.5 text-[13px] leading-relaxed text-text-muted">
      {label ? <span className="font-medium text-text">{label} </span> : null}
      {children}
    </p>
  );
}
