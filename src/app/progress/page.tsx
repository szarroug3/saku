// Progress route — a thin Server Component wrapper (SAK-104). The actual
// page is StatsPageClient (components/stats/stats-page-client.tsx); the only
// reason this file exists as a Server Component rather than being the client
// page itself is `totalFacts`: ALL_FACTS.length is a plain read of the
// (guarded) fact registry, and a Server Component can import that directly —
// no client bundle, no Server Action round trip, no loading gap for a number
// that's the same for every visitor. See StatsPageClient's own header for the
// rest of this page's reasoning.
//
// SAK-152: this route lives at /progress now, not /stats. The component name
// (StatsPageClient) and the components/stats/ directory are unchanged — this
// is a URL move, not a rename of the underlying "stats" model. The old
// /stats path is kept as a redirect shim (src/app/stats/page.tsx) so
// existing bookmarks/links still land here.

import { ALL_FACTS } from "@/lib/facts";
import { StatsPageClient } from "@/components/stats/stats-page-client";

export default function ProgressPage() {
  return <StatsPageClient totalFacts={ALL_FACTS.length} />;
}
