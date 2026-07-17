"use client";

// Your lists — the third verb on a slice, and the one place the app writes down
// something you decided rather than something you did.
//
// TWO KINDS, AND THE SPLIT IS NARROWER THAN IT LOOKS
// ==================================================
// The model everywhere else in the app is that a list is ONE object with several
// sources: a file you imported, a search you saved, a session you did. That is
// true for READING one and false for WRITING to one, and the false half is a
// real hole rather than a rough edge:
//
//   You can add か to "Core 2k". Core 2k is a SET — someone decided what is in
//   it, and か is now in it because you said so.
//
//   You cannot add か to "Kanji I miss". That is not a set, it is a RULE, and it
//   recomputes every time you look at it. A hand-added item there has exactly
//   two possible fates, and both are lies: it vanishes the next time the rule
//   runs, or it silently freezes your live rule into a dead list.
//
// So there are two kinds after all, and the split is exactly whether YOU or a
// RULE decides what is in it. `Fixed` is writable. `Derived` is not offered —
// the popover says why in one line, rather than showing a row you can tick and
// then quietly dropping what you put in it.
//
// They stay one object everywhere else: the same drill bar, the same sidebar,
// the same counts. The distinction exists at the moment you try to write, and
// nowhere else. That is why `List` is a union rather than two types with two
// screens.
//
// WHERE THIS LIVES, AND WHY IT IS THE WRONG PLACE
// ===============================================
// localStorage, keyed `kanaquiz-lists`, next to the config and the active
// session. It matches the app's existing idiom and it needs no API route.
//
// It is wrong, and the reason is worth stating rather than discovering: these
// are the only user DECISIONS the app holds, and history.json — which holds
// everything you have done — is synced by git while this is not. A list you
// spend an hour building from the Library dies with the browser profile. The
// right home is the server, beside history; that is a change to a file this task
// does not own, and it is a move, not a redesign — `useLists` is the only reader
// and writer, and it would keep its shape.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { EntryId } from "@/types";

const STORAGE_KEY = "kanaquiz-lists";

/**
 * A list you decide the contents of: made here from a slice, or imported from a
 * file. THE SAME OBJECT — a list built by hand and a deck imported from a file
 * differ in where their first members came from and in nothing else, so there is
 * no "my lists" feature separate from the import feature.
 */
export interface FixedList {
  readonly kind: "fixed";
  readonly id: string;
  readonly name: string;
  /** Entries, not facts. You file 生, not 生's セイ — filing is a thing you do
   * to something you looked up, and what you look up is an entry. */
  readonly entries: readonly EntryId[];
  readonly createdAt: number;
}

/**
 * A list a RULE decides the contents of — "Kanji I miss", a saved search, the
 * facts from a past session. Readable, drillable, not writable.
 *
 * NOT PRODUCED YET. The type is here because the popover has to explain the
 * split whether or not any derived list exists, and an explanation of a
 * distinction the code does not make is a comment pretending to be a feature.
 * The moment Home's saved queries or a "save this search" button lands, this is
 * what they mint, and the write path already refuses them.
 */
export interface DerivedList {
  readonly kind: "derived";
  readonly id: string;
  readonly name: string;
  /** How the rule is described to a person. "Everything you've missed twice." */
  readonly rule: string;
}

export type List = FixedList | DerivedList;

/** Can you add to it? The one question the two kinds answer differently, asked
 * as a function so that no call site re-derives it from `kind` and gets the
 * polarity backwards. */
export function isWritable(list: List): list is FixedList {
  return list.kind === "fixed";
}

interface ListsContextValue {
  lists: readonly List[];
  /** False until localStorage has been read — the popover must not flash "you
   * have no lists yet" at someone who has eleven. */
  loaded: boolean;
  /** Which of `entries` a list already holds — drives the tick states. */
  countIn(list: List, entries: readonly EntryId[]): number;
  /** Add entries to a fixed list, ignoring duplicates. A no-op on a derived one
   * (which the UI never offers), so a future caller cannot corrupt a rule. */
  addTo(listId: string, entries: readonly EntryId[]): void;
  removeFrom(listId: string, entries: readonly EntryId[]): void;
  /** Make a list and put `entries` in it. Returns its id. */
  create(name: string, entries: readonly EntryId[]): string;
}

const ListsContext = createContext<ListsContextValue | null>(null);

function load(): List[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(raw)) return [];
    // Shape-check rather than trust: this is the one store the user can corrupt
    // by hand, and a bad entry here would throw inside a render.
    return raw.filter(
      (l: unknown): l is List =>
        !!l &&
        typeof l === "object" &&
        typeof (l as List).id === "string" &&
        typeof (l as List).name === "string" &&
        ((l as List).kind === "fixed" || (l as List).kind === "derived"),
    );
  } catch {
    return [];
  }
}

export function ListsProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<List[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Post-mount hydration, same pattern as quiz-config and quiz-session:
    // localStorage does not exist on the server, so the first render must be
    // the empty one or hydration mismatches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLists(load());
    setLoaded(true);
  }, []);

  const persist = useCallback((next: List[]) => {
    setLists(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage full or blocked — the list stays for this session and is lost
      // on reload. Better than throwing inside a click handler.
    }
  }, []);

  const countIn = useCallback((list: List, entries: readonly EntryId[]) => {
    if (!isWritable(list)) return 0;
    const have = new Set(list.entries);
    return entries.filter((e) => have.has(e)).length;
  }, []);

  const addTo = useCallback(
    (listId: string, entries: readonly EntryId[]) => {
      persist(
        lists.map((l) => {
          if (l.id !== listId || !isWritable(l)) return l;
          const merged = new Set([...l.entries, ...entries]);
          return { ...l, entries: [...merged] };
        }),
      );
    },
    [lists, persist],
  );

  const removeFrom = useCallback(
    (listId: string, entries: readonly EntryId[]) => {
      const drop = new Set(entries);
      persist(
        lists.map((l) => {
          if (l.id !== listId || !isWritable(l)) return l;
          return { ...l, entries: l.entries.filter((e) => !drop.has(e)) };
        }),
      );
    },
    [lists, persist],
  );

  const create = useCallback(
    (name: string, entries: readonly EntryId[]) => {
      const id = `list-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const list: FixedList = {
        kind: "fixed",
        id,
        name: name.trim() || "Untitled list",
        entries: [...new Set(entries)],
        createdAt: Date.now(),
      };
      persist([...lists, list]);
      return id;
    },
    [lists, persist],
  );

  const value = useMemo(
    () => ({ lists, loaded, countIn, addTo, removeFrom, create }),
    [lists, loaded, countIn, addTo, removeFrom, create],
  );
  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

export function useLists(): ListsContextValue {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error("useLists outside ListsProvider");
  return ctx;
}
