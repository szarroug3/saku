"use client";

// A generic checkbox dropdown — the Library's Kind and Status filters
// (SAK-63's second round of feedback), and the shape either row wants: a
// trigger chip that reads at a glance how much of the list is checked, and a
// popover of checkboxes with Select all / Clear so a learner can narrow to a
// handful of kinds or statuses without a click-per-item round trip through the
// URL for every intermediate state.
//
// NOT INVENTED FROM SCRATCH. ui.tsx has no popover/dropdown primitive, but the
// app already depends on `radix-ui` for exactly this class of problem (see
// ui/tooltip.tsx, ui/confirm-dialog.tsx) — Popover carries the parts that are
// tedious and easy to get subtly wrong: outside-click and Escape to dismiss,
// focus trapped and returned to the trigger, and the aria wiring a hand-rolled
// `<div style={{display: open ? …}}>` would have to reinvent badly.
//
// A PLAIN `<input type="checkbox">`, NOT Radix's Checkbox primitive. Radix's
// Checkbox exists for a styled custom box (Root + Indicator, ARIA wired
// underneath); a native checkbox in a `<label>` is already a real control with
// no extra wiring needed, and the dropdown's own list is the only styled
// surface here that earns the dependency.

import type { ReactNode } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { Chip } from "@/components/ui";

export function FilterDropdown<T extends string>({
  label,
  items,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: {
  /** The trigger's name ("Kind", "Status") and the popover's own heading. */
  label: string;
  items: readonly { value: T; label: ReactNode }[];
  selected: ReadonlySet<T>;
  onToggle(value: T): void;
  onSelectAll(): void;
  onClear(): void;
}) {
  const checkedCount = items.filter((i) => selected.has(i.value)).length;
  const allOn = checkedCount === items.length;
  const noneOn = checkedCount === 0;
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        {/* SAK-167 FLIPPED THIS: unchecked is now the default and means "no
            filter for this dimension", so the chip reads inactive/plain in
            that state instead of highlighted. `on` when ANYTHING is checked —
            a real, active narrowing, even if every box happens to be checked
            — `partial`, the same dashed/amber language a shelf section's
            select-all button already wears (see shelves.tsx's sectionState),
            for a checked-but-not-every-item subset. A fully-cleared dropdown
            is the one state that reads as a plain unselected chip, because it
            is the one state that is actually unfiltered now. */}
        <Chip type="button" on={!noneOn} partial={!noneOn && !allOn}>
          {label}
          {noneOn ? null : allOn ? " · all" : ` · ${checkedCount}`}
        </Chip>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          // A PORTALLED OVERLAY PANEL — same category as ui/confirm-dialog.tsx's
          // AlertDialogPrimitive.Content and slice-bar.tsx's QuizPreStart, and
          // it needs the same fix those got: `kq-overlay` alongside
          // `kq-material`. kq-material alone no longer carries kiri's frost —
          // the scrolling shelf cards gave up their backdrop-filter for scroll
          // perf (see globals.css's --material-frost) — so a lone .kq-material
          // panel is just kiri's translucent --card with nothing blurring what
          // sits behind it. A portalled panel is ONE element, not a wall of
          // cards, so kq-overlay buys the blur back for free, which is what
          // lifts the panel off the page instead of letting it read straight
          // through. Without it, kiri's shelf — kana tiles, section headers —
          // showed through the checkbox rows clearly enough to be unreadable
          // where they overlapped (SAK-63 follow-up). The three opaque themes
          // already have a solid --card, so this is a no-op for them.
          //
          // `rounded-(--radius)` + `shadow-card`, not `rounded-xl` + `shadow-lg`,
          // for the same reason confirm-dialog.tsx spells out: `rounded-xl` +
          // `bg-card` is the Card recipe (whose aizome rule dissolves the fill
          // into hairline rules), which is right for something in the page flow
          // and wrong for a panel floating over text that must occlude it.
          className="kq-material kq-overlay z-20 w-60 rounded-(--radius) border border-border bg-card p-2 shadow-card"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted">
              {label}
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={onSelectAll}
                className="cursor-pointer text-accent hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={onClear}
                className="cursor-pointer text-text-muted hover:text-text hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex max-h-[60vh] flex-col overflow-y-auto">
            {items.map((item) => {
              const on = selected.has(item.value);
              return (
                <label
                  key={item.value}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] text-text hover:bg-panel"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(item.value)}
                    className="size-3.5 shrink-0 accent-accent"
                  />
                  {item.label}
                </label>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
