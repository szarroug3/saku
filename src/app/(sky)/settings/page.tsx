// Settings, under the sky. Route: /settings. The values live in
// the app's own config store (localStorage, mirrored to the learner's
// settings blob when signed in), so this page and the app's agree.

import { SettingsClient } from "../settings-client";

export const metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

export default function SkySettingsPage() {
  return (
    <>
      <SettingsClient />
    </>
  );
}
