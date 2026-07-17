// The one link out — or the visibly empty slot where it isn't.
//
// AN EMPTY SLOT IS A FEATURE. It renders. It is not hidden, not filled with an
// approximate page, and not quietly dropped from the card. `obligation` — the
// biggest and most useful cluster in the file — has no link that covers all
// seven, and the honest render of that is the gap plus the reason, because a
// link we made up teaches the user that our links are decorative. See the
// header of clusters.ts.
//
// target="_blank" is not optional and not the caller's choice: the Link type
// says the renderer enforces it, so it is spelled here, once, and there is no
// prop to get it wrong with. rel="noopener" rides along for the same reason.

import type { Link } from "@/data/grammar/clusters";

export function LinkSlot({ link, reason }: { link: Link | null; reason?: string }) {
  if (link) {
    return (
      <p className="text-[13px]">
        <a href={link.url} target="_blank" rel="noopener" className="text-accent no-underline">
          {link.label} ↗
        </a>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="rounded-full border border-warning bg-warning-bg px-2.5 py-0.5 text-[11px] text-warning">
        No link
      </span>
      {reason ? <span className="flex-1 text-xs text-text-muted">{reason}</span> : null}
    </div>
  );
}
