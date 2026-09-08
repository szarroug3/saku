// Where the data comes from, and the resources list, under the sky.
// Route: /about. The words are the app's own (src/data/attribution.ts,
// src/data/resources.ts).

import { SkyReading } from "@/sky/components/sky-reading";

import { aboutPage } from "../reading";

export const metadata = { title: "About" };

export default function SkyAboutPage() {
  return <SkyReading page={aboutPage()} />;
}
