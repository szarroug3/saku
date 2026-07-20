import { CurrentSessions } from "@/components/current/current-sessions";
import { PageTitle } from "@/components/ui";

export default function CurrentPage() {
  return (
    <>
      <PageTitle
        title="Current sessions"
        sub="Everything you have in progress. Continue any one, or discard it."
      />
      <CurrentSessions />
    </>
  );
}
