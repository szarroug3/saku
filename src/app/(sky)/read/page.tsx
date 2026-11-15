// The reader (#BuildHybridAI). Route: /read. Japanese the learner pastes or
// brings in from a web page, shown in the colors of what they know, with
// each word's card a click away and Gemini to translate or explain any part.

import { whoFor } from "../page-data";
import { ReaderClient } from "../reader-client";

export const metadata = { title: "Reader" };

export const dynamic = "force-dynamic";

export default async function SkyReaderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sample, signedIn } = await whoFor(await searchParams);
  return <ReaderClient sample={sample} signedIn={signedIn} />;
}
