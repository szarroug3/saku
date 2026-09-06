"use client";

// The one switch in the Sky: on or off, in the accent when on. A setting's
// control, beside its label. Tracked under Sky: Settings.

export function SkyToggle({ on, onClick, label, disabled = false }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border transition-colors ${disabled ? "cursor-not-allowed opacity-40" : ""} ${on ? "border-sky-accent bg-sky-accent" : "border-sky-line bg-sky-card hover:border-sky-accent"}`}
    >
      <span aria-hidden className={`absolute top-[2px] h-4 w-4 rounded-full transition-[left] ${on ? "left-[18px] bg-sky-accent-ink" : "left-[2px] bg-sky-muted"}`} />
    </button>
  );
}
