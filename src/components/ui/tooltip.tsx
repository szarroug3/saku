"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

// SAK-149: Radix's Tooltip.Root only opens on hover (`pointermove` — it
// explicitly ignores `pointerType === "touch"`) or keyboard focus. A
// tap-and-release fires neither, so on a touch device every tooltip in the
// app (all 12 call sites, since they all funnel through this one file) was
// permanently unreachable — not slow to open, literally dead.
//
// Rather than reimplement Radix's hover/keyboard/Escape machinery, `Tooltip`
// lifts `open` into state it owns and shares with `TooltipTrigger` and
// `TooltipContent` via context, so those two can layer an explicit tap
// toggle ON TOP of Radix's existing behavior instead of replacing it. Every
// branch that does this is gated on the pointerdown's `pointerType` being
// "touch" or "pen" — a mouse click or a keyboard Enter/Space (which also
// fire `click`, but with no `pointerType: touch` pointerdown ahead of them)
// never enters any of it, so hover-to-open, focus-to-open and Escape-to-close
// are byte-for-byte what they were before this file changed.
//
// Three edits, one per open/close path a tap needs to win against:
//
//   TooltipTrigger's onPointerDown — Radix's own Trigger closes an
//   already-open tooltip right on pointerdown. On a mouse that IS the
//   "click to dismiss" behavior this file wants to keep; on touch it fires
//   before the tap's matching `click` even exists, racing the toggle below.
//   Blocked for touch/pen only.
//
//   TooltipTrigger's onFocus — some browsers focus a tapped <button> before
//   its `click` fires, and Radix opens on any focus unconditionally. Left
//   alone, a tap would open it via focus and then the toggle below would
//   immediately read that as "already open" and close it again. Blocked for
//   touch/pen only (keyboard Tab never sets the pointerType this checks, so
//   real keyboard focus is untouched).
//
//   TooltipContent's onPointerDownOutside — a tap on the TRIGGER counts as
//   "outside" the content panel by Radix's own logic, so left alone it
//   closes the tooltip on pointerdown, before the trigger's own onClick can
//   toggle it — which is exactly the "second tap closes it" behavior this
//   file wants, just arriving one event too early and leaving onClick to
//   read a stale "still open" state and reopen what just closed. Suppressed
//   only when the outside tap landed on the trigger itself; a tap anywhere
//   else still closes the tooltip exactly as before.
//
// With all three narrowly blocked, TooltipTrigger's onClick is left as the
// single source of truth for a tap: block Radix's default "click always
// closes" (same touch/pen-only gate) and flip `ctx.open` — closed to open on
// the first tap, open to closed on the next — with a real, un-raced read of
// the current state.
const TooltipOpenContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
} | null>(null)

function Tooltip({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false)
  const open = openProp ?? uncontrolledOpen
  const triggerRef = React.useRef<HTMLElement | null>(null)

  const setOpen = React.useCallback(
    (next: boolean) => {
      setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  const contextValue = React.useMemo(
    () => ({ open, setOpen, triggerRef }),
    [open, setOpen],
  )

  return (
    <TooltipOpenContext.Provider value={contextValue}>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </TooltipOpenContext.Provider>
  )
}

/** Assign one DOM node to several refs at once — TooltipTrigger needs the
 * node itself (so TooltipContent's onPointerDownOutside above can tell "a
 * tap on the trigger" apart from "a tap outside it") without taking over the
 * ref slot from a caller that also passes its own. */
function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === "function") ref(node)
      else (ref as React.RefObject<T | null>).current = node
    }
  }
}

function TooltipTrigger({
  ref,
  onPointerDown,
  onFocus,
  onClick,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const ctx = React.useContext(TooltipOpenContext)
  // Set on every pointerdown, read by the focus/click handlers that follow
  // it in the same gesture, cleared once the click is handled. A mouse click
  // or a keyboard Enter/Space never has a touch/pen pointerdown ahead of it,
  // so they always read this as neither and fall through untouched.
  const pointerTypeRef = React.useRef<string | undefined>(undefined)

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      ref={mergeRefs(ref, ctx?.triggerRef)}
      onPointerDown={(event) => {
        pointerTypeRef.current = event.pointerType
        if (event.pointerType === "touch" || event.pointerType === "pen") {
          event.preventDefault()
        }
        onPointerDown?.(event)
      }}
      onFocus={(event) => {
        if (pointerTypeRef.current === "touch" || pointerTypeRef.current === "pen") {
          event.preventDefault()
        }
        onFocus?.(event)
      }}
      onClick={(event) => {
        if (pointerTypeRef.current === "touch" || pointerTypeRef.current === "pen") {
          event.preventDefault()
          ctx?.setOpen(!ctx.open)
          pointerTypeRef.current = undefined
        }
        onClick?.(event)
      }}
      {...props}
    />
  )
}

function TooltipContent({
  className,
  sideOffset = 0,
  onPointerDownOutside,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const ctx = React.useContext(TooltipOpenContext)
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        onPointerDownOutside={(event) => {
          const target = event.target
          if (
            ctx?.triggerRef.current &&
            target instanceof Node &&
            ctx.triggerRef.current.contains(target)
          ) {
            event.preventDefault()
          }
          onPointerDownOutside?.(event)
        }}
        className={cn(
          // THE TOOLTIP IS A CARD.
          //
          // Not shadcn's inverted chip, and not the opaque `bg-bg` panel that
          // replaced it — both gave this one surface a look of its own, which
          // is precisely what four themes cannot afford. It is built from the
          // same four tokens ui.tsx's `Card` uses — --card, --border,
          // --radius, --shadow-card — so each theme draws it the way that
          // theme already draws a surface, and all four come out for free:
          //
          //   aizome ... washi fill, 3px, hairline, --shadow-card: none
          //   graphite . white/near-black, 5px, hairline, no shadow
          //   momentum . 12px and the hard 0 3px 0 --border bottom edge
          //   kiri ..... 14px translucent glass + the frost below, and
          //              --shadow-card's `inset 0 1px 0 rgba(255,255,255,…)`
          //              lights its top edge, same as every other kiri card
          //
          // The radius is `rounded-(--radius)` and NOT `rounded-lg` (which
          // resolves to the identical value) on purpose: globals.css's
          // signature effects hook the class PAIRS this file would otherwise
          // spell — `rounded-lg`+`bg-card` is the Btn selector and would
          // override --shadow-card with --shadow-btn, and `rounded-xl`
          // +`bg-card` is the Card selector, whose aizome rule dissolves the
          // fill into two hairline rules. That is right for a card in the
          // page flow and wrong for a panel floating over text. Taking the
          // tokens directly says "a surface" without claiming to be either.
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-(--radius) border border-border bg-card px-3 py-1.5 text-xs text-balance text-text shadow-card",
          // kiri alone has a translucent --card, and its glass surfaces earn
          // their read from a blur behind the fill rather than from the fill.
          // Same values globals.css frosts kiri's cards, buttons and chips
          // with, scoped the same way — <html> carries data-theme, and the
          // portal still lands inside it.
          "[[data-theme=kiri]_&]:backdrop-blur-[18px] [[data-theme=kiri]_&]:backdrop-saturate-150",
          "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {/* No arrow, deliberately — do not add one back. A Radix arrow is a
         * rotated square that has to carry the panel's own fill, border and
         * (in kiri) backdrop-filter: the blur composites a second time where
         * it overlaps the body, and its two faked borders never quite line up
         * with the panel's. Invisible while the tooltip was opaque; impossible
         * to hide once it is glass. The panel opens 6px off the (i) that
         * triggered it, so nothing is ambiguous without a pointer. */}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
