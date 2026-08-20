// Progress route — a thin Server Component wrapper (SAK-104). The actual
// page is StatsPageClient (components/stats/stats-page-client.tsx); the only
// reason this file exists as a Server Component rather than being the client
// page itself is `totalFacts`: ALL_FACTS.length is a plain read of the
// (guarded) fact registry, and a Server Component can import that directly —
// no client bundle, no Server Action round trip, no loading gap for a number
// that's the same for every visitor. See StatsPageClient's own header for the
// rest of this page's reasoning.

import { ALL_FACTS } from "@/lib/facts";
import { StatsPageClient } from "@/components/stats/stats-page-client";

export default function StatsPage() {
  return <StatsPageClient totalFacts={ALL_FACTS.length} />;
}
