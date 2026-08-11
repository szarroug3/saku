"use client";

// Shared building blocks for the redesigned Library entry pages, so every page
// type (character, word, counter, grammar, …) speaks ONE visual language:
//
//   Section   — a titled block under a hairline divider. tone="accent" colours
//               the eyebrow like the header's role tags (used for the per-role
//               sections); default white is for universal blocks.
//   SubLabel  — a muted sub-heading inside a Section (On'yomi, Etymology, …).
//   Lead      — a muted one-line description opening a Section, framing what
//               follows. It teaches (says something true about Japanese); it does
//               not narrate the app.
//   EntrySurface — the glass card + sheen + flat-surface context every page sits
//               in, so shared section components render flat (no box-in-box).

import { FlatSurfaceProvider, Info } from "@/components/ui";
import { GlassSheen, glassSurface } from "@/components/ui/frost";

export function Section({
  title,
  help,
  tone = "default",
  children,
}: {
  title: string;
  help?: string;
  tone?: "default" | "accent";
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-border/50 pt-5">
      <p
        className={`mb-3 flex items-center text-[11px] font-medium uppercase tracking-[0.06em] ${
          tone === "accent" ? "text-accent" : "text-text"
        }`}
      >
        {title}
        {help ? <Info>{help}</Info> : null}
      </p>
      {children}
    </div>
  );
}

export function SubLabel({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <p className="mb-2 flex items-center text-[11px] font-medium uppercase tracking-[0.06em] text-text-muted">
      {children}
      {help ? <Info>{help}</Info> : null}
    </p>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[12.5px] leading-relaxed text-text">{children}</p>;
}

/** The glass card every entry page sits in. Flat surface so shared section
 * components (How it's written, …) drop their own fill and sit inside the glass
 * rather than as a box within a box. */
export function EntrySurface({ children }: { children: React.ReactNode }) {
  return (
    // borderless: reused components (NumberConstructionView, KeigoSetView, …) that
    // render their own <Card> drop the box entirely here, so nothing reads as a
    // box-within-a-box against these pages' divider-separated sections.
    <FlatSurfaceProvider borderless>
      <article className={`${glassSurface} p-6`}>
        <GlassSheen />
        {children}
      </article>
    </FlatSurfaceProvider>
  );
}
