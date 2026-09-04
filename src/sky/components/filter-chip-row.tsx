"use client";

// Filter chips: a row of choices with live counts. Tracked as SAK-298.
//
// Three shapes, one look:
//   multi    pick any number (Practice's collections, the Atlas's kinds)
//   single   pick one, or "any" (component lookup)
//   toggle   one chip, on or off (the amber "only ones I have missed")
//
// Every chip carries its own computed count, and the count is the honesty:
// a chip whose count is 0 says "none" and cannot be picked, so a filter that
// would return nothing says so instead of silently returning an empty page.
// It can still be un-picked if it is already on, so a learner is never stuck
// with a selection they cannot undo. A chip that does not apply to the
// current selection is disabled by the caller and says why in its title.

import { useId } from "react";

export interface ChipOption {
  value: string;
  label: string;
  /** How many results picking this gives, computed by the caller. */
  count?: number;
  /** Not applicable right now; say why. */
  disabled?: boolean | string;
}

interface Common {
  options: readonly ChipOption[];
  /** What the row filters, for assistive tech: "Collections". */
  label: string;
  className?: string;
}

export type FilterChipRowProps = Common & (
  | { mode: "multi"; selected: readonly string[]; onChange: (selected: string[]) => void }
  | { mode: "single"; selected: string | null; anyLabel?: string; onChange: (selected: string | null) => void }
);

const CHIP = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sky-ui text-[12.5px] font-semibold transition-colors";
const OFF = "border-sky-line text-sky-ink hover:bg-sky-card";
const ON = "border-sky-ink bg-sky-ink text-sky-ground-0";
const DEAD = "cursor-not-allowed opacity-45";

function Count({ n }: { n: number | undefined }) {
  if (n === undefined) return null;
  return <span className="font-normal tabular-nums opacity-80">{n === 0 ? "none" : n}</span>;
}

/** A multi-select or single-select row of chips. */
export function FilterChipRow(props: FilterChipRowProps) {
  const { options, label, className = "" } = props;
  const groupId = useId();
  const isOn = (value: string) => (props.mode === "multi" ? props.selected.includes(value) : props.selected === value);
  const pick = (value: string) => {
    if (props.mode === "multi") props.onChange(props.selected.includes(value) ? props.selected.filter((v) => v !== value) : [...props.selected, value]);
    else props.onChange(props.selected === value ? null : value);
  };
  const single = props.mode === "single";
  return (
    <div role={single ? "radiogroup" : "group"} aria-labelledby={groupId} className={`flex flex-wrap gap-1.5 ${className}`}>
      <span id={groupId} className="sr-only">{label}</span>
      {single && (
        <button
          type="button"
          role="radio"
          aria-checked={props.selected === null}
          onClick={() => props.onChange(null)}
          className={`${CHIP} ${props.selected === null ? ON : OFF}`}
        >
          {props.anyLabel ?? "any"}
        </button>
      )}
      {options.map((o) => {
        const on = isOn(o.value);
        const empty = o.count === 0 && !on;
        const dead = Boolean(o.disabled) || empty;
        const why = typeof o.disabled === "string" ? o.disabled : empty ? "Nothing here right now" : undefined;
        return (
          <button
            key={o.value}
            type="button"
            role={single ? "radio" : undefined}
            aria-checked={single ? on : undefined}
            aria-pressed={single ? undefined : on}
            aria-disabled={dead || undefined}
            disabled={dead}
            title={why}
            onClick={() => { if (!dead) pick(o.value); }}
            className={`${CHIP} ${on ? ON : OFF} ${dead ? DEAD : ""}`}
          >
            {o.label}
            <Count n={o.count} />
          </button>
        );
      })}
    </div>
  );
}

export interface ToggleChipProps {
  label: string;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  count?: number;
  disabled?: boolean | string;
  className?: string;
}

/** One chip, on or off, in amber: "only ones I have missed". */
export function ToggleChip({ label, pressed, onChange, count, disabled, className = "" }: ToggleChipProps) {
  const empty = count === 0 && !pressed;
  const dead = Boolean(disabled) || empty;
  const why = typeof disabled === "string" ? disabled : empty ? "Nothing here right now" : undefined;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-disabled={dead || undefined}
      disabled={dead}
      title={why}
      onClick={() => { if (!dead) onChange(!pressed); }}
      className={`${CHIP} ${pressed ? "border-sky-amber bg-sky-amber text-sky-gold-ink" : "border-sky-amber/50 text-sky-amber hover:bg-sky-card"} ${dead ? DEAD : ""} ${className}`}
    >
      {label}
      <Count n={count} />
    </button>
  );
}
