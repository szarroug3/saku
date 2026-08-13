import { SettingsCard } from "@/components/settings/settings-card";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    // Settings is a READING-WIDTH column, not full bleed. On a wide monitor the
    // rows are label-left / control-right, so at 1400px the control ends up a
    // screen away from the label it belongs to. Capping the column keeps each
    // setting and its control together — the same "don't strand content across
    // the whole width" rule the Learn feed follows.
    <div className="max-w-3xl">
      <PageTitle title="Settings" sub="Saved as you go." />
      <SettingsCard />
    </div>
  );
}
