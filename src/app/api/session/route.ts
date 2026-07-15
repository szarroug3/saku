// POST /api/session — append a quiz session record and fold its per-char
// stats into the aggregate. Port of the legacy Python /api/session branch.

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
  const hist = saveSession(body);
  return Response.json(
    { ok: true, sessions: hist.sessions.length },
    { headers: NO_STORE },
  );
}
