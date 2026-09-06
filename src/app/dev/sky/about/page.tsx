// Where the data comes from, and the resources list, under the sky.
// Route: /dev/sky/about. The words are the app's own (src/data/attribution.ts,
// src/data/resources.ts).

import { SkyReading } from "@/sky/components/sky-reading";

import { aboutPage } from "../reading";
import { SkyPage } from "../sky-page";

export default function SkyAboutPage() {
  return (
    <SkyPage note="The app's attribution page and its resources list, as one page.">
      <SkyReading page={aboutPage()} height="100%" />
    </SkyPage>
  );
}
