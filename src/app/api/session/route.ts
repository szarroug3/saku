// POST /api/session — append a quiz session record and fold its per-char
// stats into the aggregate. Port of the legacy Python /api/session branch.

import { historyErrorResponse } from "@/lib/api-error";
import { saveSession } from "@/lib/history";
import type { QuizSessionRecord } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: QuizSessionRecord;
  try {
    // The Python handler treated an empty body as {}; match that.
    const text = await request.text();
    body = text ? (JSON.parse(text) as QuizSessionRecord) : ({} as QuizSessionRecord);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400, headers: NO_STORE },
    );
  }
  // The save is allowed to fail now, and the client is listening. A record that
  // cannot be written must come back as an error, not as `{ ok: true }` over a
  // history the server refused to touch — the client drops a record from its
  // retry queue on exactly one signal, and this is it.
  try {
    const hist = saveSession(body);
    return Response.json(
      { ok: true, sessions: hist.sessions.length },
      { headers: NO_STORE },
    );
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
