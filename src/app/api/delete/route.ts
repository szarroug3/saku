// POST /api/delete — drop sessions by ts (or all) and rebuild the per-char
// aggregate. Port of the legacy Python /api/delete branch.

import { deleteSessions } from "@/lib/history";

const NO_STORE = { "Cache-Control": "no-store" };

interface DeleteBody {
  ids?: number[];
  all?: boolean;
}

export async function POST(request: Request) {
  let body: DeleteBody;
  try {
    // The Python handler treated an empty body as {}; match that.
    const text = await request.text();
    body = text ? (JSON.parse(text) as DeleteBody) : {};
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400, headers: NO_STORE },
    );
  }
  const hist = deleteSessions(body.ids ?? null, body.all ?? false);
  return Response.json(
    { ok: true, sessions: hist.sessions.length },
    { headers: NO_STORE },
  );
}
