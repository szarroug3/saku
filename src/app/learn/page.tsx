import { HomeFeed } from "@/components/home/home-feed";

// The learn screen — the curriculum feed, and the app's real home base. Open to
// everyone: a signed-out visitor can try the lessons here (their progress just
// isn't saved, which the banner says), and a signed-in learner is sent here from
// / (which is the landing for the signed out). Dynamic, since what HomeFeed
// shows depends on the session's history.
export const dynamic = "force-dynamic";

export default function LearnPage() {
  return <HomeFeed />;
}
