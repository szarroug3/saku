import { CurrentSessions } from "@/components/current/current-sessions";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Current sessions" };

export default function CurrentPage() {
  return (
    // Capped to a reading width like the other de-boxed pages, so the row's
    // right-aligned actions sit near its content instead of stranding at the far
    // edge of a wide viewport now that the card no longer bounds the row.
    <div className="max-w-4xl">
      <PageTitle
        title="Current sessions"
        sub="Everything you have in progress. Continue any one, or discard it."
      />
      <CurrentSessions />
    </div>
  );
}
