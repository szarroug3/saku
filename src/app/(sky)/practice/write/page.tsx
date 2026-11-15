// The writing drill (#BuildHybridAI). Route: /practice/write. An English
// sentence from the grammar corpus, written in Japanese in the learner's own
// words, graded by Firebase AI Logic on the device or in the cloud. It reads
// no learner and writes nothing, so the page is the same for everyone and
// nothing here asks who is signed in.

import { skyHref } from "../../hrefs";
import { WriteDrillClient } from "../../write-client";
import { writeDrill } from "../../write-drill";

export const metadata = { title: "Write it in Japanese" };

export default function WriteDrillPage() {
  return <WriteDrillClient pool={writeDrill()} backHref={skyHref("/practice")} />;
}
