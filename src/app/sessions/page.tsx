import { SessionsList } from "@/components/results/sessions-list";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Recent sessions" };

export default function SessionsPage() {
  return (
    <>
      <PageTitle
        title="Recent sessions"
        sub="Every quiz you've finished, newest first."
      />
      <SessionsList />
    </>
  );
}
