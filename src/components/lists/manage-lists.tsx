"use client";

// MANAGE LISTS — the one place you see every list you have and can act on it.
//
// The app could file things into lists (the Add-to-list popover) and drill one
// (the What-to-drill "List" row) long before it could SHOW you the shelf. This
// is that missing shelf: all four sources of a SavedList in one column — the
// decks you imported, the lists you named, the searches and sessions you saved —
// each with what is in it, and the verbs that make sense for its kind.
//
// THE FIXED/DERIVED SPLIT, ON SCREEN. A fixed list is a set a person curates, so
// it gets the full hand: rename, drill, delete, and pull a single entry out. A
// derived list is a RULE that recomputes every read (see SavedList) — there is
// no member to rename-around or remove, so it is view/drill/delete only. That is
// the same rule the Add-to-list popover renders by refusing to show derived
// lists as tickable; here it decides which controls a row is allowed.

import { useMemo, useState } from "react";

import Link from "next/link";

import { Btn, Card, Hint, PageTitle, SmallBtn } from "@/components/ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { KANA_GROUP_FACTS } from "@/lib/lesson";
import { planFacts, planSession } from "@/lib/budget";
import { factInfo } from "@/lib/facts";
import { entryHref } from "@/lib/library/href";
import { libEntry, type LibEntry } from "@/lib/library/entries";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { emptySelection, resolve } from "@/lib/selection";
import { useHistory } from "@/lib/use-history";
import { isWritable, useLists } from "@/lib/use-lists";
import type { EntryId, HistoryFile, SavedList } from "@/types";

/** How many tiles a card draws before it stops and counts the rest. An imported
 * deck can be thousands of entries; the point of this screen is to SEE a list,
 * not to paint all of it, and the count in the header already tells the truth. */
const TILE_CAP = 80;

/** A word for where a list came from, for the little tag by its name. Says what
 * a person would say — "imported deck", "saved search" — never `origin`/`kind`. */
function sourceWord(list: SavedList): string {
  if (list.kind === "fixed") {
    return list.origin === "import" ? "imported deck" : "your list";
  }
  return list.origin === "search" ? "saved search" : "past session";
}

/** The entries a list points at, for BOTH kinds. A fixed list carries its set;
 * a derived one is a rule, so it is resolved to facts and folded back to the
 * entries those facts belong to — the same entries the Library would show. */
function entriesOf(
  list: SavedList,
  history: HistoryFile,
  lists: SavedList[],
): EntryId[] {
  if (list.kind === "fixed") return list.entries;
  const seen = new Set<EntryId>();
  for (const f of resolve(list.query, history, lists)) {
    const info = factInfo(f);
    if (info) seen.add(info.entry);
  }
  return [...seen];
}

/** A LibEntry's one-line label — its reading when it has just one, else its
 * meaning. "生 · せい" would be picking one of nine readings and calling it THE
 * reading, the mistake the Library tiles already refuse. */
function subOf(entry: LibEntry): string {
  return entry.readings.length === 1
    ? entry.readings[0]
    : (entry.meanings[0] ?? "—");
}

export function ManageLists() {
  const { lists, loaded, rename, remove, removeFrom } = useLists();
  const { history } = useHistory();
  const { cfg } = useQuizConfig();
  const { startSession } = useQuizSession();
  const confirm = useConfirm();

  // One clock for the visit, like every other screen that resolves a selection:
  // the plan a Drill builds and the counts a card shows must agree about what is
  // solid, and two Date.now() calls a render apart cannot promise that.
  const [now] = useState(() => Date.now());

  // Entries for every list, cut once per (lists, history). Derived lists cost a
  // resolve() each; fixed ones are free. Keyed here so a rename or a single
  // entry-remove re-cuts exactly the lists that changed and nothing re-resolves
  // on an unrelated keystroke.
  const entriesByList = useMemo(() => {
    const m = new Map<string, EntryId[]>();
    for (const l of lists) m.set(l.id, entriesOf(l, history, lists));
    return m;
  }, [lists, history]);

  const drill = (list: SavedList) => {
    // The What-to-drill "List" row's own path: name the list in a selection,
    // resolve it, and let the budget draw the run. random:true because this is a
    // user-built selection — the owner's rule, "randomize everything, nothing by
    // rote". startSession then routes to the drill itself.
    const facts = resolve(
      { ...emptySelection(), list: list.id },
      history,
      lists,
      cfg.accuracyMetric,
    );
    const plan = planSession({
      candidates: facts,
      history,
      groups: KANA_GROUP_FACTS,
      length:
        cfg.length === "limited" && cfg.limType === "count"
          ? cfg.limCount
          : null,
      random: true,
      now,
    });
    startSession(planFacts(plan), plan.teach, list.name);
  };

  const del = async (list: SavedList) => {
    const count = entriesByList.get(list.id)?.length ?? 0;
    const ok = await confirm({
      title: `Delete “${list.name}”?`,
      body:
        list.kind === "fixed"
          ? `This removes the list and its ${count} ${count === 1 ? "entry" : "entries"}. The characters themselves stay in the app.`
          : "This removes the saved list. The rule it was built from, your search or that session, is untouched.",
      confirmLabel: "Delete list",
    });
    if (ok) await remove(list.id);
  };

  return (
    <>
      <PageTitle
        title="Lists"
        sub="Every list you have: decks you imported, lists you named, searches and sessions you saved. Rename, drill, or clear them out."
      />

      {!loaded ? null : lists.length === 0 ? (
        <Card>
          <p className="text-[13px]">You don&rsquo;t have any lists yet.</p>
          <p className="mt-1.5">
            <Hint>
              Search something in the{" "}
              <Link
                href="/library"
                className="text-accent no-underline hover:underline"
              >
                Library
              </Link>{" "}
              and add it to a list, or import a deck. They&rsquo;ll show up here.
            </Hint>
          </p>
        </Card>
      ) : (
        lists.map((list) => (
          <ListCard
            key={list.id}
            list={list}
            entries={entriesByList.get(list.id) ?? []}
            voice={cfg.voiceName}
            onDrill={() => drill(list)}
            onDelete={() => void del(list)}
            onRename={(name) => void rename(list.id, name)}
            onRemoveEntry={(id) => void removeFrom(list.id, [id])}
          />
        ))
      )}
    </>
  );
}

function ListCard({
  list,
  entries,
  onDrill,
  onDelete,
  onRename,
  onRemoveEntry,
}: {
  list: SavedList;
  entries: EntryId[];
  voice: string;
  onDrill(): void;
  onDelete(): void;
  onRename(name: string): void;
  onRemoveEntry(id: EntryId): void;
}) {
  const writable = isWritable(list);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.name);

  const shown = entries.slice(0, TILE_CAP);
  const overflow = entries.length - shown.length;

  const commit = () => {
    const name = draft.trim();
    if (name && name !== list.name) onRename(name);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(list.name);
    setEditing(false);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              aria-label={`Rename ${list.name}`}
              className="min-w-0 flex-1 rounded-(--radius) border border-border bg-transparent px-2.5 py-1 text-[15px] font-semibold text-text"
            />
            <SmallBtn onClick={commit} disabled={!draft.trim()}>
              Save
            </SmallBtn>
            <SmallBtn onClick={cancel}>Cancel</SmallBtn>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="min-w-0 truncate text-[15px] font-semibold text-text">
              {list.name}
            </h2>
            {writable ? (
              <SmallBtn
                onClick={() => {
                  setDraft(list.name);
                  setEditing(true);
                }}
                aria-label={`Rename ${list.name}`}
              >
                Rename
              </SmallBtn>
            ) : null}
          </div>
        )}
        <span className="flex-none text-xs text-text-muted">
          {sourceWord(list)} · {entries.length}{" "}
          {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Derived lists say why they can't be edited, once — the same line the
          Add-to-list popover uses, so the rule reads the same in both places. */}
      {!writable ? (
        <p className="mt-1">
          <Hint>
            This one builds itself from a rule, so there&rsquo;s nothing to
            rename around. Drill it or clear it out.
          </Hint>
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-3">
          <Hint>Nothing in here yet.</Hint>
        </p>
      ) : (
        <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(74px,1fr))]">
          {shown.map((id) => {
            const entry = libEntry(id);
            if (!entry) return null;
            return (
              <div
                key={id}
                className="relative rounded-[10px] border border-border bg-card px-1.5 pb-2 pt-2.5 text-center"
              >
                {writable ? (
                  <button
                    type="button"
                    onClick={() => onRemoveEntry(id)}
                    aria-label={`Remove ${entry.glyph} from ${list.name}`}
                    className="absolute right-1 top-1 flex size-4 cursor-pointer items-center justify-center rounded-full border border-border text-[10px] leading-none text-text-muted hover:border-danger hover:text-danger"
                  >
                    ✕
                  </button>
                ) : null}
                <Link
                  href={entryHref(entry.id)}
                  className="block no-underline"
                  aria-label={`Open ${entry.glyph}`}
                >
                  <div className="text-[26px] leading-[1.25] text-text">
                    {entry.glyph}
                  </div>
                  <div className="truncate text-xs text-text-muted">
                    {subOf(entry)}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
      {overflow > 0 ? (
        <p className="mt-2">
          <Hint>＋ {overflow} more not shown</Hint>
        </p>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        <Btn sel onClick={onDrill} disabled={entries.length === 0}>
          Drill
        </Btn>
        <Btn danger onClick={onDelete}>
          Delete
        </Btn>
      </div>
    </Card>
  );
}
