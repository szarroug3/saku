import { SettingsCard } from "@/components/settings/settings-card";
import { PageTitle } from "@/components/ui";

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" sub="Saved as you go." />
      <SettingsCard />
    </>
  );
}
