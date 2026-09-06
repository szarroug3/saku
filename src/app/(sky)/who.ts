// Whose history a Sky action reads: the pretend learner's (`sample`), the
// browser's own copy handed up by a signed-out visitor (`local`), or, with
// neither, the signed-in account's. Sign-in is preferred, never required
// (Sam, 2026-09-06): a visitor's sky is real, kept in the browser and
// carried up on sign-in, the way the app has always done it.

import type { HistoryFile } from "@/types";

export interface Who {
  sample?: boolean;
  local?: HistoryFile;
}

/** The browser's history with its sessions left out, for the reads that
 * only need standings (everything but the home sky's mix-ups and the
 * sessions page): the sessions are most of the bytes. */
export function lean(history: HistoryFile): HistoryFile {
  return { ...history, sessions: [] };
}
