// GET /api/history — the full history file. Port of the legacy Python
// handler's /api/history branch.

import { getUserId } from "@/lib/auth";
import { historyErrorResponse } from "@/lib/api-error";
import { loadHistory } from "@/lib/history";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  // An unreadable file is an ERROR here, where it used to be an empty history.
  // That difference is visible to a learner: "Nothing yet. Drill something and
  // it will show up here" over a history.json that is sitting right there with
  // everything in it is the app telling you your work is gone. A 503 lets the
  // client say the true thing instead.
  try {
    const userId = await getUserId();
    return Response.json(await loadHistory(userId), { headers: NO_STORE });
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
