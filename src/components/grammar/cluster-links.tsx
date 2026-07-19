// A cluster's Links card, in the Library's idiom.
//
// Same card, same "LINKS" label, same label-column/value-column definition list
// that `EntryLinks` uses, and the row is labelled "Read about it" because that
// is what the SAME link is called on a pattern's entry page. A reader who
// followed the Family row here finds the outbound link under the heading it had
// on the page they came from.
//
// It is not `EntryLinks` itself because that component's first argument is
// `Mixups` — the two confusion lines that are its whole reason for existing, and
// that hold their positions on every kind's page so the eye learns one place to
// look. A cluster has no mixups and can never have any: confusions are recorded
// against FACTS, and a cluster is not asked about. Handing it an empty Mixups to
// borrow the wrapper would put a cluster in a population it is not in.
//
// ONE ROW IS ALL THERE IS, AND THAT IS THE WHOLE CARD.
// ===================================================
// There is no "Members" or "Other ways to say this" row. Every pattern page
// already carries a full `Ways to say this` table listing the same patterns, and
// the Forms table two inches to the left of this card lists them again with
// their builds. A third copy of one list is not a link. The first column of the
// Forms table is the way in.
//
// The CALLER decides whether this card exists at all: 7 of the 12 clusters have
// no link, and a card whose only row is missing is furniture. See clusters.ts.

import { LinkSlot } from "@/components/grammar/link-slot";
import { Card, Lbl } from "@/components/ui";
import type { Link } from "@/data/grammar/clusters";

export function ClusterLinks({ link }: { link: Link }) {
  return (
    <Card>
      <Lbl>Links</Lbl>
      <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-[13px] max-[700px]:grid-cols-1">
        <dt className="text-text-muted">Read about it</dt>
        <dd className="m-0">
          {/* `lastVerified` is NOT printed and neither is "opens in a new tab".
              The first is a maintenance fact about our bet on someone else's
              site; the second is what the ↗ already says. See link-slot.tsx. */}
          <LinkSlot link={link} />
        </dd>
      </dl>
    </Card>
  );
}
