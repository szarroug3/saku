// A REDIRECT AND NOT A DELETE (SAK-152). The Progress page moved to
// /progress — see src/app/progress/page.tsx and its header — because the
// route should match what the page actually is, not what it used to be. But
// /stats has been this app's URL for that page since before the "Progress"
// rename (see the sidebar's old comment, which argued for keeping it), it may
// be bookmarked, and another agent's branch may still link to it. A redirect
// costs one file and keeps every one of those working, same convention as
// /chart -> /library. `permanent: false` is the honest flag: this is a
// decision about the app's shape and not a fact about the internet, and a 308
// is cached by browsers forever — if this path ever needs to change again,
// a permanent redirect is a bug you cannot fix from the server.

import { redirect } from "next/navigation";

export default function StatsPage() {
  redirect("/progress");
}
