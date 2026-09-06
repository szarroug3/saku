// Settings, under the sky. Route: /settings. The values live in
// the app's own config store (localStorage, mirrored to the learner's
// settings blob when signed in), so this page and the app's agree.

import { SettingsClient } from "../settings-client";
import { SkyNote } from "../sky-note";

export const dynamic = "force-dynamic";

export default function SkySettingsPage() {
  return (
    <>
      <SkyNote>{"The same settings the app keeps: change one here and the app sees it."}</SkyNote>
      <SettingsClient />
    </>
  );
}
