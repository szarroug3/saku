// How Saku works, under the sky. Route: /how-it-works. The words are the
// app's own (src/data/how-it-works.ts).

import { SkyReading } from "@/sky/components/sky-reading";

import { howItWorksPage } from "../reading";
import { SkyNote } from "../sky-note";

export default function SkyHowPage() {
  return (
    <>
      <SkyNote>{"The same words as the app's page. Where the Sky has changed a thing (the standings' names, what enters rotation), the words still describe the app."}</SkyNote>
      <SkyReading page={howItWorksPage()} height="100%" />
    </>
  );
}
