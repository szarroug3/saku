// POST /api/delete — drop sessions by ts (or all) and rebuild the per-char
// aggregate. Port of the legacy Python /api/delete branch.
//
// `reset: true` is a different, heavier request: a FULL wipe back to the day-one
// shell — sessions AND claims AND seen AND the derived aggregate. deleteSessions
// deliberately keeps claims/seen (see history.ts); resetAll deliberately does
// not. The reset takes precedence over ids/all if both are somehow sent.

import { historyErrorResponse } from "@/lib/api-error";
import { deleteSessions, resetAll } from "@/lib/history";

const NO_STORE = { "Cache-Control": "no-store" };

interface DeleteBody {
  // Stable per-record identities to drop: a record's `id` when it has one, else
  // its `ts` for legacy records. See history.deleteSessions — keying on `ts`
  // alone deleted two same-millisecond sessions together.
  ids?: (number | string)[];
  all?: boolean;
  reset?: boolean;
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
  // `reset` deliberately still works when history.json is unreadable — it is
  // the way out of that state, and it copies the damaged file aside before it
  // writes. Only `deleteSessions` can throw here, because only it reads first.
  try {
    const hist = body.reset
      ? resetAll()
      : deleteSessions(body.ids ?? null, body.all ?? false);
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
