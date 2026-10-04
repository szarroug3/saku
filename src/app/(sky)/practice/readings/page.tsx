// The readings drill (SAK-495). Route: /practice/readings. Any kanji in the
// table, in the drill's order, sorted reading by reading as kun'yomi or
// on'yomi. It reads no learner and writes nothing, so the page is the same
// for everyone and nothing here asks who is signed in.

import { SkyReadingsDrill } from "@/sky/components/sky-readings-drill";

import { skyHref } from "../../hrefs";
import { readingsDrill } from "../../readings-drill";

export const metadata = { title: "Kun'yomi or on'yomi" };

export default function ReadingsDrillPage() {
  return <SkyReadingsDrill pool={readingsDrill().pool} backHref={skyHref("/practice")} />;
}
