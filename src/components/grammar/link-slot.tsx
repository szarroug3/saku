// The one link out of a cluster page.
//
// THERE IS NO EMPTY STATE ANY MORE. This component used to render a "No link"
// chip plus the cluster's `noLinkReason` whenever `link` was null, on the
// argument that an honest gap beats an invented URL. The first half of that
// argument still holds and is why no cluster has ever been given an approximate
// link. The second half did not survive contact with the shelf: 7 of the 12
// clusters have no link, so the empty slot was on most pages, and a notice that
// appears almost everywhere reads as furniture rather than as a finding.
//
// So the CALLER decides. The cluster page renders no card at all when there is
// no link, and this component only ever sees a real one. The reason strings
// stay in clusters.ts as data. See that file's header.
//
// target="_blank" is not optional and not the caller's choice: the Link type
// says the renderer enforces it, so it is spelled here, once, and there is no
// prop to get it wrong with. rel="noopener" rides along for the same reason.
// `lastVerified` is NOT printed. It is a maintenance fact about our bet on
// someone else's site, and it means nothing to a reader.

import type { Link } from "@/data/grammar/clusters";

export function LinkSlot({ link }: { link: Link }) {
  return (
    <p className="text-[13px]">
      <a href={link.url} target="_blank" rel="noopener" className="text-accent no-underline">
        {link.label} ↗
      </a>
    </p>
  );
}
