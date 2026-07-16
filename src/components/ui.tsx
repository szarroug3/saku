"use client";

// Small hand-rolled UI kit matching the dota-data aesthetic and the legacy
// app's look: cards, uppercase section labels, chip toggles, settings rows.
// Every screen builds from these so the pages stay visually consistent.

import { type ButtonHTMLAttributes, type ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "mb-3.5 rounded-xl border border-border bg-card p-[18px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Uppercase section label ("QUIZ", "MISSED CHARACTERS", …). */
export function Lbl({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-text-muted">
      {children}
    </p>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <span className="text-xs text-text-muted">{children}</span>;
}

/** Background on a setting, behind a focusable (i).
 *
 * A real button, not a bare hover target: hover-only info is unreachable by
 * keyboard and on touch, and this is the only place some of it is written
 * down. Radix handles focus, Escape, and the aria wiring. */
export function Info({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label="More about this setting"
        className="ml-1 inline-flex size-3.5 cursor-help items-center justify-center rounded-full border border-border align-[1px] text-[9px] leading-none text-text-muted hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        i
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[280px]">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/** A settings row: label left, controls right, top border between rows.
 * `dim` grays it out (setting doesn't apply to the chosen mode).
 *
 * Two kinds of explanation, deliberately separated:
 *   `hint` — changes what you'd PICK, so it stays inline and always visible
 *   `info` — background or a why, so it hides behind an (i)
 * That line is what keeps the page from being a wall of grey text. */
export function Row({
  label,
  hint,
  info,
  dim,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  info?: ReactNode;
  dim?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-2.5 py-2",
        "border-t border-border first:border-t-0",
        dim && "pointer-events-none opacity-45",
      )}
    >
      <span>
        {label} {hint ? <Hint>{hint}</Hint> : null}
        {info ? <Info>{info}</Info> : null}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { sel?: boolean };

/** Standard button; `sel` gives it the accent selected state. */
export function Btn({ sel, className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        "cursor-pointer rounded-lg text-sm text-text hover:bg-panel",
        sel
          ? "border-2 border-accent bg-accent-bg px-[13px] py-1.5 text-accent hover:bg-accent-bg"
          : "border border-border bg-card px-3.5 py-[7px]",
        className,
      )}
    />
  );
}

export function SmallBtn({ sel, className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        "cursor-pointer rounded-lg text-xs text-text hover:bg-panel disabled:cursor-default disabled:opacity-45",
        sel
          ? "border-2 border-accent bg-accent-bg px-[9px] py-[3px] text-accent hover:bg-accent-bg"
          : "border border-border bg-card px-2.5 py-1",
        className,
      )}
    />
  );
}

export function GhostBtn({ className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        "cursor-pointer rounded-lg border-none bg-transparent text-sm text-text-muted hover:bg-panel",
        className,
      )}
    />
  );
}

export function PrimaryBtn({ className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        "w-full cursor-pointer rounded-lg bg-text p-3 text-base text-bg",
        "disabled:cursor-default disabled:opacity-40",
        className,
      )}
    />
  );
}

/** Pill chip toggle; `part` is the dashed/amber partial state. */
export function Chip({
  on,
  part,
  className,
  ...props
}: BtnProps & { on?: boolean; part?: boolean }) {
  return (
    <button
      {...props}
      className={cx(
        "cursor-pointer select-none rounded-full border px-3 py-1 text-[13px]",
        on
          ? "border-accent bg-accent-bg text-accent"
          : part
            ? "border-warning bg-warning-bg text-warning"
            : "border-border bg-card text-text-muted",
        className,
      )}
    />
  );
}

export function Metric({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="rounded-[10px] bg-panel px-3.5 py-3">
      <p className="mb-0.5 text-xs text-text-muted">{k}</p>
      <p className="text-2xl font-semibold">{v}</p>
    </div>
  );
}

export function MetricsGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
      {children}
    </div>
  );
}

/** Thin progress bar; pct=null renders full (endless mode). */
export function ProgressBar({ pct }: { pct: number | null }) {
  return (
    <div className="mb-[18px] h-(--bar-h) rounded-full bg-panel">
      <div
        className="h-(--bar-h) rounded-full bg-accent transition-[width] duration-200"
        style={{ width: `${pct === null ? 100 : Math.min(100, pct)}%` }}
      />
    </div>
  );
}

export function PageTitle({
  title,
  sub,
}: {
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <>
      <h1 className="mb-0.5 text-[22px] font-semibold">{title}</h1>
      {sub ? <p className="mb-[18px] text-[13px] text-text-muted">{sub}</p> : null}
    </>
  );
}
