"use client";

// The app's confirm. Replaces window.confirm at every call site.
//
// WHY THIS EXISTS AT ALL: a native window.confirm is drawn by the browser
// chrome, not the page. It is not in the DOM, so nothing that drives this app
// through the DevTools protocol — an agent, a test — can see it or click it.
// It does not merely look wrong; it is a wall that halts the tab until a human
// with a mouse arrives. Everything below is ordinary DOM, so a driver clicks
// [data-testid="confirm-dialog-confirm"] the way a person clicks the button.
//
// Radix's AlertDialog carries the parts that are tedious and easy to get
// subtly wrong: the focus trap, Escape, focus restored to whatever opened the
// dialog, aria-modal and the title/description wiring, and inert-ing the page
// behind it. It is already a dependency (see ui/tooltip.tsx).

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { Btn } from "@/components/ui";

export type ConfirmOptions = {
  /** The question, as a question. Rendered as the dialog's title. */
  title: string;
  /** What confirming will cost. Rendered under the title. */
  body?: React.ReactNode;
  /** Names the ACTION ("Discard quiz"), never "OK" — the button should read
   * as what it does, because that is all a returning eye re-reads. */
  confirmLabel?: string;
  cancelLabel?: string;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<Confirm | null>(null);

/** `const confirm = useConfirm()` → `if (await confirm({...})) ...`
 *
 * Reads like the window.confirm it replaces, minus the blocking. Every caller
 * becomes async: that is the real cost of the change and there is no way
 * around it, since a dialog that yields to the event loop cannot return a
 * boolean to a synchronous frame. */
export function useConfirm(): Confirm {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<ConfirmOptions | null>(null);

  // The resolver lives in a ref and NOT in the state object on purpose. A
  // setState updater must be pure, and resolving a promise from inside one is
  // a side effect that React runs twice under StrictMode.
  const resolverRef = React.useRef<((ok: boolean) => void) | null>(null);

  // Whatever had focus when the dialog was asked for, so we can hand it back.
  //
  // Radix restores focus to its <Trigger>, not to the previously focused
  // element — and there is no Trigger here, because a promise-returning
  // confirm() is opened from an event handler rather than by wrapping a
  // button. With triggerRef null, Radix's restore is a no-op and focus lands
  // on <body>: keyboard users get dropped at the top of the page every time
  // they dismiss a dialog. Verified over CDP, then fixed here.
  const openerRef = React.useRef<HTMLElement | null>(null);

  const confirm = React.useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // A second confirm while one is open supersedes it, and the superseded
        // caller hears "no". Leaving it unresolved would hang that await
        // forever — the exact failure this component was written to delete.
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        openerRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setPending(options);
      }),
    [],
  );

  const settle = React.useCallback((ok: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPending(null);
    resolve?.(ok);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialogPrimitive.Root
        open={pending !== null}
        // Every close that is not the confirm button — Escape, or Radix's own
        // dismissal — is a "no". One funnel, so no path can leave the promise
        // pending.
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <AlertDialogPrimitive.Portal>
          {/* PORTALLED TO <body>, and that is load-bearing rather than tidy.
           * An element with a backdrop-filter becomes a BACKDROP ROOT, so the
           * frost on a .kq-material nested inside another .kq-material — i.e.
           * inside any Card — silently filters nothing. See globals.css's
           * --card-frost note. At the top of <body> the dialog's backdrop is
           * the page, which is precisely what .kq-material asks for. */}
          <AlertDialogPrimitive.Overlay
            data-testid="confirm-dialog-overlay"
            // No backdrop-filter here: the scrim is a flat wash, and the panel
            // in front of it does the theme's frosting. Two stacked filters
            // would blur the blur.
            className="fixed inset-0 z-50 bg-(--scrim) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          />
          <AlertDialogPrimitive.Content
            data-testid="confirm-dialog"
            // FOCUS LANDS ON CANCEL, which is Radix's default for an
            // AlertDialog and is deliberate here rather than inherited.
            //
            // I first focused the CONFIRM button, reasoning that window.confirm
            // put Enter on OK and the replacement should keep that muscle
            // memory. Driving it proved that wrong inside a minute: pressing
            // Enter on "Discard" opened the dialog AND the very same keystroke
            // reached the confirm button that had just taken focus, so the quiz
            // was gone before the dialog could be read. A key-repeat from a
            // held Enter does the same thing on real hardware.
            //
            // Every question this component asks is destructive and two of them
            // are irreversible ("Delete all session history"). The default must
            // be the harmless answer, so an Enter that arrives before the user
            // has read anything costs nothing. Confirming is Tab-then-Enter, or
            // a click — deliberate, which is the point.
            // Hand focus back to whatever opened the dialog. See openerRef.
            // `isConnected` because the confirmed action often removes its own
            // opener from the page — discarding the quiz unmounts the Resume
            // card the Discard button lives on — and focusing a detached node
            // silently drops focus to <body>, which is what we are fixing.
            onCloseAutoFocus={(e) => {
              const opener = openerRef.current;
              openerRef.current = null;
              if (opener?.isConnected) {
                e.preventDefault();
                opener.focus();
              }
            }}
            aria-describedby={pending?.body ? undefined : ""}
            className={[
              "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-24px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2",
              // THE DIALOG IS A CARD — same reasoning, and the same four
              // tokens, as ui/tooltip.tsx's panel: --card, --border, --radius,
              // --shadow-card. Each theme then draws it the way that theme
              // already draws a surface, and all four come out for free.
              //
              // `rounded-(--radius)` and NOT `rounded-xl`/`rounded-lg`, which
              // resolve to the same value: globals.css hooks its signature
              // effects on class PAIRS, and `rounded-xl`+`bg-card` is the Card
              // recipe (whose aizome rule dissolves the fill into two hairline
              // rules) while `rounded-lg`+`bg-card` is the Btn recipe (which
              // would swap --shadow-card for --shadow-btn). Both are right for
              // a thing in the page flow and wrong for a panel over text — a
              // dialog must occlude what it covers, aizome included.
              "rounded-(--radius) border border-border bg-card p-[18px] shadow-card",
              // The frost, asked for BY NAME. kq-material alone no longer carries
              // one in kiri (the scrolling cards gave the backdrop-filter up for
              // scroll perf — see globals --material-frost), so a portalled dialog
              // adds kq-overlay to get it back: kiri's blur(18px) saturate(150%),
              // `none` in the three opaque themes (aizome's "my material is
              // nothing" included, which is why there is no aizome special case).
              // Without it a dialog goes see-through and the page reads through it.
              "kq-material kq-overlay",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            ].join(" ")}
          >
            <AlertDialogPrimitive.Title
              data-testid="confirm-dialog-title"
              className="text-[15px] font-semibold text-text"
            >
              {pending?.title}
            </AlertDialogPrimitive.Title>
            {pending?.body ? (
              <AlertDialogPrimitive.Description className="mt-1.5 text-[13px] leading-snug text-text-muted">
                {pending.body}
              </AlertDialogPrimitive.Description>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              {/* Cancel first in the DOM: it holds the initial focus, so one
               * Tab reaches the confirm, and a screen reader hears the way out
               * before the way through. */}
              <AlertDialogPrimitive.Cancel asChild>
                <Btn data-testid="confirm-dialog-cancel">
                  {pending?.cancelLabel ?? "Cancel"}
                </Btn>
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action asChild>
                <Btn
                  danger
                  data-testid="confirm-dialog-confirm"
                  onClick={() => settle(true)}
                >
                  {pending?.confirmLabel ?? "Confirm"}
                </Btn>
              </AlertDialogPrimitive.Action>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </ConfirmContext.Provider>
  );
}
