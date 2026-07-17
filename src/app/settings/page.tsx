import Link from "next/link";

import { SettingsCard } from "@/components/settings/settings-card";
import { Card, Hint, Lbl, PageTitle } from "@/components/ui";

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" sub="Saved as you go." />
      <SettingsCard />

      {/* The import door, from the one place the design put it. Its own screen
          rather than a control here: importing is a task with a result you read,
          not a preference you set. */}
      <Lbl>Your lists</Lbl>
      <Card>
        <Link href="/settings/import" className="text-[13px] text-accent">
          Import a list →
        </Link>
        <Hint>
          A file you already have — a .csv or .txt with one word per line. Every
          row is looked up in the dictionary, and you see what didn&apos;t match
          before anything is added.
        </Hint>
      </Card>
    </>
  );
}
