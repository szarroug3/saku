"use client";

// Import a list — the door that did not exist.
//
// The design has said for a while that lists are imported from files the user
// provides, and no screen did it. This is that screen, and it is deliberately
// two states and no wizard: pick a file, see what didn't match, press Import.
//
// It shows you the failures BEFORE anything is added, because that is the only
// part you might need to do something about. What matched is a number; what
// didn't is a table with reasons.
//
// Nothing is uploaded anywhere: the file is read in the browser, matched
// against the dictionary already in the bundle, and only the resulting list of
// entry ids is POSTed. The file itself never leaves the machine.

import Link from "next/link";
import { useRef, useState } from "react";

import { Btn, Card, Hint, Lbl, PageTitle, PrimaryBtn } from "@/components/ui";
import { glyphOf } from "@/lib/facts";
import { applySuggestion, readList, type ImportReport } from "@/lib/import";
import { useLists } from "@/lib/use-lists";

/** "core2k.csv" → "Core2k". A default you can overwrite, not a decision. */
function nameFromFile(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base ? base[0].toUpperCase() + base.slice(1) : "Imported list";
}

export default function ImportPage() {
  const { lists, save } = useLists();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [filename, setFilename] = useState("");
  const [name, setName] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    setReport(readList(text));
    setShowAll(false);
  };

  const doImport = async () => {
    if (!report?.entries.length) return;
    const listName = name.trim() || nameFromFile(filename);
    await save({
      kind: "fixed",
      id: `import-${Date.now()}`,
      name: listName,
      created: Date.now(),
      entries: report.entries,
      origin: "import",
    });
    setDone(listName);
    setReport(null);
  };

  return (
    <>
      <PageTitle
        title="Import a list"
        sub="A file you already have. Nothing is uploaded anywhere."
      />

      {done ? (
        <Card>
          <span className="text-[15px] font-semibold">
            “{done}” is now one of your lists.
          </span>
          <Hint>
            It is on Home under List, and you can add to it from anywhere.
          </Hint>
          <span className="mt-2.5 block">
            <Link href="/">
              <Btn sel>Go and drill it</Btn>
            </Link>
          </span>
        </Card>
      ) : null}

      {!report ? (
        <>
          <Card>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) void take(f);
              }}
              className="flex flex-col items-center rounded-lg border border-dashed border-border px-4 py-8 text-center"
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
          </Card>
          <Card>
            <Hint>
              You can also build a list without a file: search on Home and drill
              what comes back.
            </Hint>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <span className="text-[15px] font-semibold">{filename}</span>
            <Hint>
              {report.rows.length} rows · nothing has been added yet.
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
                {report.matched.length} matched the dictionary
              </span>
              <span>
                <i className="mr-1.5 inline-block size-2 rounded-full bg-warning align-middle" />
                {report.unmatched.length} didn&apos;t
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
                                setReport(applySuggestion(report, row.raw))
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

          <Lbl>Name</Lbl>
          <Card>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={nameFromFile(filename)}
              className="kq-material w-[280px] rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] text-text outline-none focus:border-accent"
            />
            {/* The count that matters is ENTRIES, not rows: a file listing 生
                twice is one thing to drill, and saying "2,000" over a list of
                1,983 would be the screen lying in its last sentence. */}
            <Hint>
              {report.entries.length} distinct{" "}
              {report.entries.length === 1 ? "thing" : "things"}
              {report.entries.length !== report.matched.length
                ? ` · ${report.matched.length - report.entries.length} duplicate rows folded`
                : ""}
              {report.entries.length
                ? ` · ${report.entries
                    .slice(0, 6)
                    .map(glyphOf)
                    .join(" ")}${report.entries.length > 6 ? " …" : ""}`
                : ""}
            </Hint>
          </Card>

          <div className="kq-band sticky bottom-0 -mx-3 mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-accent px-3 py-2.5">
            <span className="text-[13px] text-text-muted">
              Add <b className="text-text">{report.entries.length} things</b> as a
              list called <b className="text-text">{name.trim() || nameFromFile(filename)}</b>
              {report.unmatched.length ? ` · ${report.unmatched.length} left out` : ""}
            </span>
            <span className="ml-auto flex flex-none items-center gap-2">
              <Btn onClick={() => setReport(null)}>Cancel</Btn>
              <PrimaryBtn onClick={doImport} disabled={!report.entries.length}>
                Import {report.entries.length}
              </PrimaryBtn>
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
