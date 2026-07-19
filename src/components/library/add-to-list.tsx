"use client";

// "＋ Add to list" — the popover, and the place the fixed/derived split is a
// visible thing rather than a comment in src/types/index.ts.
//
// The rule it renders: a derived list is never shown as a row you could tick.
// One line says why instead. Showing it disabled would be worse than showing it
// working — a greyed row invites you to work out what you did wrong, when the
// answer is that the thing you want is not a thing.

import { useState } from "react";

import Link from "next/link";

import { Btn, Hint, Lbl, SmallBtn } from "@/components/ui";
import { countIn, isWritable, listToggle, useLists } from "@/lib/use-lists";
import type { EntryId } from "@/types";

export function AddToList({
  entries,
  label,
  onDone,
}: {
  entries: readonly EntryId[];
  /** What is being filed — "か き く け こ", "生". */
  label: string;
  onDone(): void;
}) {
  const { lists, loaded, addTo, removeFrom, create } = useLists();
  const [name, setName] = useState("");
  const fixed = lists.filter(isWritable);
  const derived = lists.filter((l) => !isWritable(l));

  const submitNew = () => {
    if (!name.trim()) return;
    void create(name, entries);
    setName("");
    onDone();
  };

  return (
    // Not a Card: a Card is `kq-material`, and this pops over the page while the
    // drill bar under it is a `kq-band` — two backdrop roots stacked, and the
    // inner one's blur is a no-op in Chromium. kq-surface is the card's material
    // rebuilt opaque, which is what a popover wants anyway: you should not be
    // able to read the table through the thing you are typing a name into.
    <div className="kq-surface mb-2 rounded-(--radius) border border-border p-[18px] shadow-card">
      <Lbl>Add {label} to…</Lbl>

      {!loaded ? null : fixed.length === 0 ? (
        // Day one you have none, because the app ships none. So it skips the
        // picking and asks for a name.
        <>
          <p className="mb-3 text-[13px] text-text-muted">
            You don&rsquo;t have any lists yet.
          </p>
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNew()}
              placeholder="Name your first list…"
              className="min-w-0 flex-1 rounded-(--radius) border border-border bg-transparent px-2.5 py-1.5 text-[13px] text-text"
            />
            <Btn onClick={submitNew} disabled={!name.trim()}>
              Create
            </Btn>
          </div>
          <p className="mt-3 border-t border-border pt-2.5">
            <Hint>
              A list you make here and a deck you import are the same thing.
              This one just starts empty.
            </Hint>
          </p>
        </>
      ) : (
        <>
          {fixed.map((list) => {
            const have = countIn(list, entries);
            const all = have === entries.length;
            // The row is a TOGGLE, not just an add: the same tick that says
            // "these are all in here" is the thing that clicking takes them back
            // out. listToggle reads the indicator and returns the one write a
            // click should make, so the two can never drift apart.
            const onClick = () => {
              const t = listToggle(list, entries);
              if (t.kind === "remove") void removeFrom(list.id, t.entries);
              else void addTo(list.id, t.entries);
            };
            return (
              <button
                key={list.id}
                type="button"
                onClick={onClick}
                aria-label={`${all ? "Remove" : "Add"} ${label} ${all ? "from" : "to"} ${list.name}`}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-(--radius) px-1.5 py-1.5 text-left hover:bg-panel"
              >
                <span
                  className={`flex size-4 flex-none items-center justify-center rounded-[3px] border text-[10px] ${
                    all
                      ? "border-accent bg-accent-bg text-accent"
                      : have > 0
                        ? "border-warning text-warning"
                        : "border-border"
                  }`}
                >
                  {all ? "✓" : have > 0 ? "–" : ""}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {list.name}
                </span>
                <span className="flex-none text-xs tabular-nums text-text-muted">
                  {list.entries.length}
                </span>
              </button>
            );
          })}
          <div className="mt-3 flex gap-1.5 border-t border-border pt-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNew()}
              placeholder="＋ Name a new list…"
              className="min-w-0 flex-1 rounded-(--radius) border border-border bg-transparent px-2.5 py-1.5 text-[13px] text-text"
            />
            <SmallBtn onClick={submitNew} disabled={!name.trim()}>
              Create
            </SmallBtn>
          </div>
        </>
      )}

      {/* The one line the callout in the design asks for. It prints whenever a
          derived list exists, because that is when its absence from the rows
          above is a question. */}
      {derived.length > 0 ? (
        <p className="mt-2.5">
          <Hint>
            {derived.map((l) => l.name).join(", ")}{" "}
            {derived.length === 1 ? "isn't" : "aren't"} here. They build
            themselves from a rule, so there&rsquo;s nothing to add to.
          </Hint>
        </p>
      ) : null}

      {/* The way out to the full management view — rename, delete, drill, and
          see what is in each. Only meaningful once loaded, and always offered
          then: even with no writable lists there may be derived ones to manage. */}
      {loaded ? (
        <p className="mt-3 border-t border-border pt-2.5 text-right">
          <Link
            href="/lists"
            className="text-xs text-accent no-underline hover:underline"
          >
            Manage lists →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
