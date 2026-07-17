// GET/POST/DELETE /api/lists — the saved lists file. Same shape of handler as
// /api/history and /api/session, over lists.json instead of history.json.

import { addToList, deleteList, loadLists, saveList } from "@/lib/lists";
import type { EntryId, SavedList } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  return Response.json(loadLists(), { headers: NO_STORE });
}

/** Body is either a whole list (create/replace) or `{ addTo, entries }`. */
type Body =
  | { addTo: string; entries: EntryId[] }
  | (SavedList & { addTo?: undefined });

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
  // addToList refuses derived lists itself — see the doc there. This route does
  // not re-check, because two places deciding the same rule is how they drift.
  const file =
    body.addTo !== undefined
      ? addToList(body.addTo, body.entries)
      : saveList(body);
  return Response.json(file, { headers: NO_STORE });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400, headers: NO_STORE });
  }
  return Response.json(deleteList(id), { headers: NO_STORE });
}
