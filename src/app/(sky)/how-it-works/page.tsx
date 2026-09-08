// How Saku works, under the sky. Route: /how-it-works. The words are the
// app's own (src/data/how-it-works.ts).

import { SkyReading } from "@/sky/components/sky-reading";

import { howItWorksPage } from "../reading";

export const metadata = { title: "How Saku works" };

export default function SkyHowPage() {
  return <SkyReading page={howItWorksPage()} />;
}
