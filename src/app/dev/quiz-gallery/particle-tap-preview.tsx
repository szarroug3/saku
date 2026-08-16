"use client";

// The one piece of this dev page that needs a Client Component boundary:
// ParticleTapCard takes a real onTap handler, and a Server Component can't
// pass a function prop to a Client Component inline. Isolated here so the
// page itself stays a Server Component — making the whole page client-side
// triggered a Next.js dev-mode false positive on the root layout's
// `<script dangerouslySetInnerHTML>` (the no-flash theme script) during
// client-side navigation.

import { ParticleTapCard } from "@/components/quiz/particle-tap-card";
import type { ParticleDrillQuestion } from "@/lib/engine/particle-drill";

export function ParticleTapPreview({ question }: { question: ParticleDrillQuestion }) {
  return <ParticleTapCard question={question} disabled={false} revealCorrect onTap={() => {}} />;
}
