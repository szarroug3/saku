"use client";

// Naming a recipe, in the one place that knows how (SAK-395).
//
// Two screens save a recipe: the Practice page, which saves what is on
// screen, and a run's results, which save what was just run. They asked the
// same question and one of them used to answer it by navigating to the other,
// which threw away the results to do something that had nothing to do with
// them.
//
// It also settles what a name that already exists means. Both screens used to
// replace it without saying so, which is the worst of the three answers: the
// button reads "Replace" instead of "Save" when the name is taken, so nothing
// is overwritten without being asked for by name.

import { SkyButton } from "@/sky/components/sky-button";
import { SkyInput } from "@/sky/components/sky-input";
import { useState } from "react";

export interface RecipeNameFormProps {
  /** The names already taken, so an overwrite can announce itself. */
  taken: readonly string[];
  onSave: (name: string) => void;
  onCancel: () => void;
  /** Sits inline in a row of buttons rather than filling its own line. */
  className?: string;
}

export function RecipeNameForm({ taken, onSave, onCancel, className = "" }: RecipeNameFormProps) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const replacing = taken.includes(trimmed);
  return (
    <form
      className={`flex w-full gap-2 ${className}`}
      onSubmit={(e) => { e.preventDefault(); if (trimmed) onSave(trimmed); }}
    >
      <SkyInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="A name for this recipe"
        className="min-w-0 flex-1 !py-1.5 text-[14px]"
        autoFocus
      />
      <SkyButton onClick={() => { if (trimmed) onSave(trimmed); }} disabled={!trimmed}>
        {replacing ? "Replace" : "Save"}
      </SkyButton>
      <SkyButton variant="outline" onClick={onCancel}>Cancel</SkyButton>
    </form>
  );
}
