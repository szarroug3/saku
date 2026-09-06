// Settings, under the sky. Route: /dev/sky/settings. The values live in
// the app's own config store (localStorage, mirrored to the learner's
// settings blob when signed in), so this page and the app's agree.

import { SettingsClient } from "../settings-client";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

export default function SkySettingsPage() {
  return (
    <SkyPage note="The same settings the app keeps: change one here and the app sees it.">
      <SettingsClient />
    </SkyPage>
  );
}
