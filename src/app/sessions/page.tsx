import { PageTitle } from "@/components/ui";

// TODO(agent:results): session list with selection dots + delete flows.
// See CONVERSION_PROMPT.md "Recent sessions".
export default function SessionsPage() {
  return (
    <PageTitle
      title="Recent sessions"
      sub="Click a row to reopen its results · select with the dot to delete"
    />
  );
}
