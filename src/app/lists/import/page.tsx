"use client";

// Import a list — where lists come from, so it lives with the lists.
//
// The design has said for a while that lists are imported from files the user
// provides, and no screen did it. This is that screen, and it lives in the list
// view because that is where a person goes to see and build their lists. It is
// deliberately two states and no wizard: pick a file, see what didn't match,
// press Import.
//
// It shows you the failures BEFORE anything is added, because that is the only
// part you might need to do something about. What matched is a number; what
// didn't is a table with reasons.
//
// Nothing is uploaded anywhere: the file is read in the browser, matched
// against the dictionary already in the bundle, and only the resulting list of
// entry ids is POSTed. The file itself never leaves the machine.

import { useRef, useState } from "react";

import { Btn, Card, Hint, Lbl, PageTitle } from "@/components/ui";
import { factsOf, glyphOf } from "@/lib/facts";
import { KIND_LABEL, libEntry } from "@/lib/library/entries";
import { applySuggestion, readList, type ImportReport } from "@/lib/import";
import { useHistoryWrites } from "@/lib/history-writes";
import { useLists } from "@/lib/use-lists";
import { useQuizSession } from "@/lib/quiz-session";
import type { EntryId } from "@/types";

/** "core2k.csv" → "Core2k". A default you can overwrite, not a decision. */
function nameFromFile(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base ? base[0].toUpperCase() + base.slice(1) : "Imported list";
}

export default function ImportPage() {
  const { lists, save } = useLists();
  const { startSession } = useQuizSession();
  const writes = useHistoryWrites();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [filename, setFilename] = useState("");
  const [name, setName] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // The list just imported, kept so "Go and drill it" can quiz exactly it.
  const [doneEntries, setDoneEntries] = useState<EntryId[]>([]);
  const [error, setError] = useState<string | null>(null);
  // True while a file is dragged over the drop zone, so it can read as a solid
  // filled target instead of the resting dashed outline.
  const [dragging, setDragging] = useState(false);
  // The ids we'll actually import: starts as everything that matched, and the
  // checklist lets you drop any before pressing Import. Reset with every report
  // so a second file doesn't inherit the first file's un-checks.
  const [included, setIncluded] = useState<Set<EntryId>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  // Every report change (new file, applied suggestion, cancel) resets the
  // checklist to "all in", so this is the one place that sets report.
  const putReport = (r: ImportReport | null) => {
    setReport(r);
    setIncluded(new Set(r?.entries ?? []));
  };

  const toggle = (id: EntryId) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const take = async (file: File) => {
    setError(null);
    setDone(null);
    // .apkg is a zip around a SQLite database — see readList's doc. Refused
    // with the way out rather than half-parsed into nonsense.
    if (/\.apkg$/i.test(file.name)) {
      setError(
        "An .apkg is a database, and this can't open one yet. In Anki: File → Export → Notes in Plain Text, then bring that file here.",
      );
      return;
    }
    const text = await file.text();
    setFilename(file.name);
    setName(nameFromFile(file.name));
    putReport(readList(text));
    setShowAll(false);
  };

  const doImport = async () => {
    if (!report) return;
    const chosen = report.entries.filter((e) => included.has(e));
    if (!chosen.length) return;
    const listName = name.trim() || nameFromFile(filename);
    await save({
      kind: "fixed",
      id: `import-${Date.now()}`,
      name: listName,
      created: Date.now(),
      entries: chosen,
      origin: "import",
    });
    setDone(listName);
    setDoneEntries(chosen);
    putReport(null);
  };

  // "Go and drill it": quiz the freshly imported list right now, the same path
  // the list view's Drill takes. Mark the entries seen (the app only quizzes what
  // it has shown) and drill them directly; startSession routes to the drill.
  const drillDone = () => {
    // Entries expand to the facts a drill actually asks (a word's reading and
    // meaning), the same expansion the list view's Drill makes.
    const facts = doneEntries.flatMap((e) => factsOf(e));
    if (!facts.length) return;
    writes.markSeen(facts);
    startSession(facts, [], done ?? "Imported list", "lesson", facts);
  };

  // The count that drives the bar and the button: only the checked entries.
  const checkedCount = report
    ? report.entries.filter((e) => included.has(e)).length
    : 0;

  return (
    <>
      <PageTitle
        title="Import a list"
        sub="A file you already have. Nothing is uploaded anywhere."
      />

      {done ? (
        <Card>
          <span className="block text-[15px] font-semibold">
            “{done}” is now one of your lists.
          </span>
          <span className="mt-1 block">
            <Hint>
              It is in your Lists, and you can add to it from anywhere.
            </Hint>
          </span>
          <span className="mt-2.5 block">
            <Btn sel onClick={drillDone}>
              Go and drill it
            </Btn>
          </span>
        </Card>
      ) : null}

      {!report ? (
        <>
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) void take(f);
            }}
            className={`flex flex-col items-center rounded-lg border px-4 py-8 text-center ${
              dragging
                ? "border-solid border-accent bg-accent-bg"
                : "border-dashed border-border"
            }`}
          >
            <span className="text-[30px] leading-none opacity-50">＋</span>
            <span className="mt-2 text-sm">Drop a file here</span>
            <Hint>a .csv / .tsv / .txt with one word per line</Hint>
            <span className="mt-3.5">
              <Btn onClick={() => fileRef.current?.click()}>Choose a file</Btn>
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.text"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void take(f);
              }}
            />
          </div>
          {error ? (
            <span className="mt-2.5 block text-[13px] text-danger">{error}</span>
          ) : null}
          <Card className="mt-3.5">
            <Hint>
              You can also build a list without a file: search the Library and
              add what you find to a list.
            </Hint>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <span className="text-[15px] font-semibold">{filename}</span>
            <Hint>
              {" · "}
              {report.rows.length} {report.rows.length === 1 ? "row" : "rows"} ·
              nothing has been added yet.
            </Hint>
            {/* One bar, two numbers, no legend to decode. */}
            <span className="mt-2.5 mb-2 flex h-1.5 overflow-hidden rounded-full">
              <i
                className="block bg-success"
                style={{ flex: Math.max(report.matched.length, 0.001) }}
              />
              <i
                className="block bg-warning"
                style={{ flex: Math.max(report.unmatched.length, 0.001) }}
              />
            </span>
            <span className="flex flex-wrap gap-3.5 text-[13px] text-text-muted">
              <span>
                <i className="mr-1.5 inline-block size-2 rounded-full bg-success align-middle" />
                {report.matched.length}
                {" matched the dictionary"}
              </span>
              <span>
                <i className="mr-1.5 inline-block size-2 rounded-full bg-warning align-middle" />
                {report.unmatched.length}
                {" didn’t match"}
              </span>
            </span>
          </Card>

          {report.unmatched.length ? (
            <>
              <Lbl>The {report.unmatched.length} that didn&apos;t match</Lbl>
              <Card>
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="text-text-muted">
                      <th className="w-[38%] pb-1.5 font-normal">
                        What the file said
                      </th>
                      <th className="pb-1.5 font-normal">Why it didn&apos;t match</th>
                      <th className="w-[110px] pb-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {(showAll
                      ? report.unmatched
                      : report.unmatched.slice(0, 5)
                    ).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1.5 font-kana">
                          {row.raw || (
                            <span className="text-text-muted">&lt;empty&gt;</span>
                          )}
                        </td>
                        <td className="py-1.5 text-text-muted">
                          {row.why}
                          {row.suggest ? (
                            <span className="text-success">
                              {" "}
                              Strip it and this is {row.suggest.text}.
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1.5">
                          {row.suggest ? (
                            <Btn
                              sel
                              className="!px-2 !py-0.5 !text-[11px]"
                              onClick={() =>
                                putReport(applySuggestion(report, row.raw))
                              }
                            >
                              Use {row.suggest.text}
                            </Btn>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.unmatched.length > 5 && !showAll ? (
                  <span className="mt-2 block text-[13px] text-text-muted">
                    ＋ {report.unmatched.length - 5} more ·{" "}
                    <button
                      onClick={() => setShowAll(true)}
                      className="cursor-pointer text-accent"
                    >
                      show them →
                    </button>{" "}
                    · anything left alone is simply not imported.
                  </span>
                ) : null}
              </Card>
            </>
          ) : null}

          {report.entries.length ? (
            <>
              <Lbl>What&apos;s going in</Lbl>
              <Card>
                {/* One grid for the whole list so every row's columns line up:
                    glyph, reading, type, then meaning. Each row is a
                    display:contents label, so its five cells land on the shared
                    tracks and clicking anywhere on the row toggles its checkbox.
                    Checked by default; uncheck to leave one out. */}
                <div className="grid grid-cols-[auto_auto_auto_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-[13px]">
                  {report.entries.map((e) => {
                    const on = included.has(e);
                    const entry = libEntry(e);
                    const glyph = glyphOf(e);
                    // The kana reading, blank when it just repeats the glyph (a
                    // kana word reads as itself); the empty cell keeps the columns
                    // after it aligned.
                    const reading = entry?.readings[0];
                    const type = entry ? KIND_LABEL[entry.kind] : "";
                    const meaning = entry?.meanings.join(", ") ?? "";
                    return (
                      <label key={e} className="contents cursor-pointer">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(e)}
                          className="size-4 accent-accent"
                        />
                        <span className="font-kana text-[15px] text-text">{glyph}</span>
                        <span className="text-text-muted">
                          {reading && reading !== glyph ? reading : ""}
                        </span>
                        <span className="justify-self-start rounded bg-card px-1.5 py-0.5 text-[11px] text-text-muted">
                          {type}
                        </span>
                        <span className="min-w-0 truncate text-text-muted">{meaning}</span>
                      </label>
                    );
                  })}
                </div>
                {/* The count that matters is ENTRIES, not rows: a file listing 生
                    twice is one thing to drill, and saying "2,000" over a list of
                    1,983 would be the screen lying in its last sentence. */}
                <Hint>
                  {report.entries.length} distinct{" "}
                  {report.entries.length === 1 ? "thing" : "things"}
                  {report.entries.length !== report.matched.length
                    ? ` · ${report.matched.length - report.entries.length} duplicate ${report.matched.length - report.entries.length === 1 ? "row" : "rows"} folded`
                    : ""}
                </Hint>
              </Card>
            </>
          ) : null}

          <Lbl>Name</Lbl>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={nameFromFile(filename)}
            className="kq-material w-[280px] rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] text-text outline-none focus:border-accent"
          />

          <div className="kq-band sticky bottom-0 -mx-3 mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-accent px-3 py-2.5">
            <span className="text-[13px] text-text-muted">
              Add{" "}
              <b className="text-text">
                {checkedCount} {checkedCount === 1 ? "thing" : "things"}
              </b>{" "}
              as a list called{" "}
              <b className="text-text">{name.trim() || nameFromFile(filename)}</b>
              {report.unmatched.length ? ` · ${report.unmatched.length} left out` : ""}
            </span>
            <span className="ml-auto flex flex-none items-center gap-2">
              <Btn onClick={() => putReport(null)}>Cancel</Btn>
              <Btn go onClick={doImport} disabled={!checkedCount}>
                Import {checkedCount}
              </Btn>
            </span>
          </div>
        </>
      )}

      {lists.length ? (
        <>
          <Lbl>Your lists</Lbl>
          <Card>
            {lists.map((l) => (
              <span key={l.id} className="block py-1 text-[13px]">
                {l.name}{" "}
                <span className="text-text-muted">
                  ·{" "}
                  {l.kind === "fixed"
                    ? `${l.entries.length} things`
                    : "a rule, not a set"}
                </span>
              </span>
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}
