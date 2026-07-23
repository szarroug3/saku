// GET/POST/DELETE /api/lists — the saved lists file. Same shape of handler as
// /api/history and /api/session, over lists.json instead of history.json.

import { historyErrorResponse } from "@/lib/api-error";
import { getUserId } from "@/lib/auth";
import {
  addToList,
  deleteList,
  loadLists,
  removeFromList,
  renameList,
  saveList,
} from "@/lib/lists";
import type { EntryId, SavedList } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const userId = await getUserId();
    return Response.json(await loadLists(userId), { headers: NO_STORE });
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

/**
 * Body is one of four writes, discriminated by which key is present:
 *   - `{ addTo, entries }`     add entries to a fixed list
 *   - `{ removeFrom, entries }` drop entries from a fixed list
 *   - `{ rename, name }`        relabel a list
 *   - a whole SavedList         create or replace
 * The three verbs mirror addTo deliberately — one shape per operation, each
 * refused at its one server helper rather than re-checked here.
 */
type Body =
  | { addTo: string; entries: EntryId[] }
  | { removeFrom: string; entries: EntryId[] }
  | { rename: string; name: string }
  | (SavedList & { addTo?: undefined; removeFrom?: undefined; rename?: undefined });

export async function POST(request: Request) {
  let body: Body;
  try {
    body = JSON.parse(await request.text()) as Body;
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400, headers: NO_STORE },
    );
  }
  // Each helper refuses what it must itself (a derived list rejects addTo /
  // removeFrom — see the docs there). This route does not re-check, because two
  // places deciding the same rule is how they drift.
  try {
    const userId = await getUserId();
    const file =
      "addTo" in body && body.addTo !== undefined
        ? await addToList(userId, body.addTo, body.entries)
        : "removeFrom" in body && body.removeFrom !== undefined
          ? await removeFromList(userId, body.removeFrom, body.entries)
          : "rename" in body && body.rename !== undefined
            ? await renameList(userId, body.rename, body.name)
            : await saveList(userId, body);
    return Response.json(file, { headers: NO_STORE });
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400, headers: NO_STORE });
  }
  try {
    const userId = await getUserId();
    return Response.json(await deleteList(userId, id), { headers: NO_STORE });
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
