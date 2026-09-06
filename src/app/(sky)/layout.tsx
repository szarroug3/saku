// The Sky's shell around every Sky page: the wash under everything, the bar
// along the top, the page below (see src/sky/components/sky-shell.tsx).

import { currentUserId } from "@/lib/auth";
import { isSupabaseStore } from "@/lib/store/mode";

import { SkyShellClient } from "./shell-client";

export default async function SkyLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = isSupabaseStore();
  const signedIn = authEnabled && (await currentUserId()) !== null;
  return <SkyShellClient signedIn={signedIn} authEnabled={authEnabled}>{children}</SkyShellClient>;
}
