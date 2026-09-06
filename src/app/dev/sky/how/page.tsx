// How Saku works, under the sky. Route: /dev/sky/how. The words are the
// app's own (src/data/how-it-works.ts).

import { SkyReading } from "@/sky/components/sky-reading";

import { howItWorksPage } from "../reading";
import { SkyPage } from "../sky-page";

export default function SkyHowPage() {
  return (
    <SkyPage note="The same words as the app's page. Where the Sky has changed a thing (the standings' names, what enters rotation), the words still describe the app.">
      <SkyReading page={howItWorksPage()} height="100%" />
    </SkyPage>
  );
}
