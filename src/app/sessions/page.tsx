import { SessionsList } from "@/components/results/sessions-list";
import { PageTitle } from "@/components/ui";

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
