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

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
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
