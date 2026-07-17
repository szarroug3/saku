// /lists — manage every saved list. A thin route over ManageLists, which is a
// client screen (it reads history, config and the session, and drives the
// confirm dialog). The nav entry that points here is wired separately; until
// then the Add-to-list popover links in.

import { ManageLists } from "@/components/lists/manage-lists";

export default function ListsPage() {
  return <ManageLists />;
}
