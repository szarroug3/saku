// The kana chart is a shelf in the Library now.
//
// The page is gone rather than kept alongside it: it was a search field over 214
// characters and a grid of speakable tiles, which is exactly what the Library's
// kana shelf is — the same tiles, the same 100px grid, the same click-to-hear,
// the same sticky field (lifted wholesale into
// src/components/library/sticky-search.tsx, comments and all, because that field
// took four passes to get right and none of that reasoning was about kana).
// What it gains there is the rest of the app: every tile is a link to an entry
// page now, and the bar at the bottom will drill the row you are looking at.
//
// A REDIRECT AND NOT A DELETE. /chart is a URL that has been in this app since
// it was a Python script, it is in the user's history and possibly a bookmark,
// and another agent's branch may still link to it. A redirect costs one file and
// keeps every one of those working. `permanent: false` is the honest flag: this
// is a decision about the app's shape and not a fact about the internet, and a
// 308 is cached by browsers forever — if the chart ever comes back, a permanent
// redirect is a bug you cannot fix from the server.
//
// The Tofugu guide links the chart carried are NOT lost — see the kana shelf.

import { redirect } from "next/navigation";

export default function ChartPage() {
  redirect("/library");
}
