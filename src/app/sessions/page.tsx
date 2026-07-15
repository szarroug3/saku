import { SessionsList } from "@/components/results/sessions-list";
import { PageTitle } from "@/components/ui";

export default function SessionsPage() {
  return (
    <>
      <PageTitle
        title="Recent sessions"
        sub="Click a row to reopen its results · select with the dot to delete"
      />
      <SessionsList />
    </>
  );
}
